from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
import secrets
import requests
import os
import json
import mimetypes
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

OMDB_API_KEY = os.getenv("OMDB_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI()

# ── Session store ─────────────────────────────────────────────────────────────
sessions: dict = {}


# ── Session middleware ────────────────────────────────────────────────────────
# Runs on EVERY request/response — guarantees:
#   1. Every request has a valid session (creates one if missing/unknown).
#   2. Every response writes the cookie back so the browser always knows its ID.
# Fixes the bug where /submit or /analyze hit without a prior GET / would create
# orphaned sessions the browser never learned about.
class SessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        session_id = request.cookies.get("session_id")

        if not session_id or session_id not in sessions:
            session_id = secrets.token_hex(16)
            sessions[session_id] = {"user_data": {}, "profile_data": {}}

        request.state.session_id = session_id
        request.state.session    = sessions[session_id]

        response = await call_next(request)

        # Always stamp the cookie on every response
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            samesite="lax",
        )
        return response


app.add_middleware(SessionMiddleware)


# ── Groq AI helper ────────────────────────────────────────────────────────────
def call_groq(prompt: str) -> dict:
    if not GROQ_API_KEY:
        return {}
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a hilariously dramatic psychological profiler. "
                    "Always respond ONLY with a valid JSON object — no markdown, "
                    "no backticks, no extra text before or after the JSON."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.9,
        "max_tokens": 600,
    }
    resp = None
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers, json=body, timeout=15,
        )
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        print("Groq raw:", raw)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        print(f"Groq failed: {e}")
        if resp is not None:
            print(f"Status: {resp.status_code} — {resp.text}")
        return {}


# ── Fallback data ─────────────────────────────────────────────────────────────
FALLBACK_NICKNAMES = {
    "coding":  ("The Joyful Debugger",  "You ship bugs AND smiles. Mostly bugs."),
    "art":     ("The Colour Prophet",   "Mondrian called. He wants his vibe back."),
    "gaming":  ("The Happy Camper",     "You're winning at life AND the game."),
    "cooking": ("The Flavour Wizard",   "You put paprika on everything and it WORKS."),
    "music":   ("The Walking Playlist", "Your life is already a banger."),
    "reading": ("The Lore Goblin",      "You've finished 3 books this week. Normal."),
    "sports":  ("The Endorphin Addict", "Runner's high is a lifestyle, not a phase."),
    "travel":  ("The Eternal Tourist",  "Home is wherever your carry-on lands."),
}
FALLBACK_MOTIVATIONS = {
    "coding":  "Keep shipping — the world needs more builders like you!",
    "art":     "Your creativity knows no bounds — keep making things!",
    "gaming":  "Level up in life the same way you level up in games.",
    "cooking": "Every great chef started with a single dish. Keep cooking.",
    "music":   "The world needs your soundtrack. Keep playing.",
    "reading": "Every book you read makes you a little wiser.",
    "sports":  "Every champion lost first. Keep going.",
    "travel":  "The world is big and waiting. Keep exploring.",
}


# ── Favicon — silences browser 404 ───────────────────────────────────────────
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    fav = Path("static/favicon.ico")
    if fav.exists():
        return FileResponse(str(fav), media_type="image/x-icon")
    return Response(status_code=204)


# ── Static files — replaces app.mount() ──────────────────────────────────────
@app.get("/static/{file_path:path}")
def serve_static(file_path: str):
    full_path = Path("static") / file_path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="Static file not found")
    mime, _ = mimetypes.guess_type(str(full_path))
    return FileResponse(str(full_path), media_type=mime or "application/octet-stream")


# ── Page routes ───────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def home():
    with open("index.html", encoding="utf-8") as f:
        return f.read()


@app.get("/form", response_class=HTMLResponse)
def get_form():
    with open("psycho.html", encoding="utf-8") as f:
        return f.read()


@app.get("/script.js")
def get_script():
    return FileResponse("static/script.js", media_type="application/javascript")


# ── Data routes ───────────────────────────────────────────────────────────────
@app.post("/submit")
async def submit(request: Request):
    session = request.state.session
    form    = await request.form()
    session["user_data"].clear()
    try:
        for key in form.keys():
            values = form.getlist(key)
            session["user_data"][key] = values[0] if len(values) == 1 else values
        if "pet" not in session["user_data"]:
            session["user_data"]["pet"] = []
        return {"message": "Form submitted successfully"}
    except Exception:
        raise HTTPException(status_code=500, detail="Submit failed")


@app.get("/analyze")
def analyze(request: Request):
    session   = request.state.session
    user_data = session["user_data"]

    if not user_data:
        raise HTTPException(
            status_code=400,
            detail="No form data found. Please fill and submit the form first.",
        )

    session["profile_data"].clear()

    hobby     = user_data.get("hobby", "coding")
    pets      = user_data.get("pet", [])
    overthink = user_data.get("overthink", "medium")
    character = user_data.get("character", "main")
    stress    = user_data.get("stress", "panic")
    energy    = user_data.get("energy", "normal")
    name      = user_data.get("name", "Anonymous")
    # New fields from teacher's form
    gender    = user_data.get("gender", "")
    birthyear = user_data.get("birthyear", "")
    birthplace = user_data.get("birthplace", "")
    residence  = user_data.get("residence", "")
    job        = user_data.get("job", "")
    message    = user_data.get("message", "")
    # Helper: read a question answer from user_data, defaulting to "3"
    def q(n):
        return int(user_data.get(f"question{n}", "3"))

    # Compute Big Five trait scores matching the form's actual question groupings:
    # Extraversion:      Q1(+), Q8(+), Q14(-reverse), Q16(-reverse)
    extraversion      = round((q(1) + q(8) + (6 - q(14)) + (6 - q(16))) / 4, 1)
    # Conscientiousness: Q2(+), Q5(-reverse), Q10(+), Q12(-reverse), Q15(-reverse)
    conscientiousness = round((q(2) + (6 - q(5)) + q(10) + (6 - q(12)) + (6 - q(15))) / 5, 1)
    # Openness:          Q3(+), Q7(+), Q11(+), Q20(+)
    openness          = round((q(3) + q(7) + q(11) + q(20)) / 4, 1)
    # Agreeableness:     Q4(+), Q9(-reverse), Q17(-reverse), Q18(-reverse)
    agreeableness     = round((q(4) + (6 - q(9)) + (6 - q(17)) + (6 - q(18))) / 4, 1)
    # Neuroticism:       Q6(-reverse), Q13(+), Q19(+)
    neuroticism       = round(((6 - q(6)) + q(13) + q(19)) / 3, 1)

    if isinstance(pets, str):
        pets = [pets]

    # ── Career label: dream job anchors the title; hobby is the fallback ─────
    hobby_career_labels = {
        "coding":  "Software Engineer",
        "art":     "Creative Director",
        "gaming":  "Game Designer",
        "cooking": "Chef / Food Scientist",
        "music":   "Music Producer",
        "reading": "Author / Researcher",
        "sports":  "Sports Analyst",
        "travel":  "Travel Journalist",
    }
    # Use the dream job field as the primary career label if provided;
    # otherwise fall back to a hobby-derived label.
    career = job.strip() if job and job.strip() else hobby_career_labels.get(hobby, "Philosopher")
    # career_desc will be written by Groq; placeholder used only if Groq fails.
    career_desc = ""

    hobby_movies = {
        "coding":  ["The Social Network", "Ex Machina", "Hackers"],
        "art":     ["Frida", "The Grand Budapest Hotel", "La La Land"],
        "gaming":  ["Ready Player One", "Free Guy", "Tron: Legacy"],
        "cooking": ["Julie & Julia", "Chef", "Ratatouille"],
        "music":   ["Whiplash", "Bohemian Rhapsody", "Almost Famous"],
        "reading": ["The Name of the Rose", "Adaptation", "Misery"],
        "sports":  ["Moneyball", "Rocky", "Rush"],
        "travel":  ["The Secret Life of Walter Mitty", "Into the Wild", "Eat Pray Love"],
    }
    movie_titles = hobby_movies.get(hobby, ["Inception", "The Grand Budapest Hotel", "Soul"])

    movies = []
    if OMDB_API_KEY:
        for title in movie_titles[:3]:
            try:
                url  = f"http://www.omdbapi.com/?apikey={OMDB_API_KEY}&t={title}"
                data = requests.get(url, timeout=5).json()
                if data.get("Response") == "True":
                    movies.append({
                        "title":  data.get("Title"),
                        "year":   data.get("Year"),
                        "plot":   data.get("Plot"),
                        "poster": data.get("Poster"),
                        "rating": data.get("imdbRating"),
                    })
            except Exception:
                pass
    else:
        for t in movie_titles[:3]:
            movies.append({"title": t, "year": "N/A", "plot": "Add OMDb key for details!", "poster": "", "rating": "N/A"})

    # ── Pet images: download bytes → save to disk → serve via /view/pet/ ────
    pet_dir = Path("static/pets") / request.state.session_id
    pet_dir.mkdir(parents=True, exist_ok=True)

    def _fetch_and_save(animal: str, image_url: str) -> dict | None:
        """Download image from image_url, save to pet_dir, return metadata."""
        try:
            img_resp = requests.get(image_url, timeout=10)
            img_resp.raise_for_status()
            # Derive a safe filename from the URL's last path segment
            suffix = Path(image_url.split("?")[0]).suffix or ".jpg"
            filename = f"{animal.lower()}{suffix}"
            filepath = pet_dir / filename
            filepath.write_bytes(img_resp.content)
            return {"animal": animal, "filename": filename}
        except Exception as e:
            print(f"Pet image save failed ({animal}): {e}")
            return None

    pet_images = []
    if "dog" in pets:
        try:
            meta = requests.get("https://dog.ceo/api/breeds/image/random", timeout=5).json()
            image_url = meta.get("message", "")
            result = _fetch_and_save("Dog", image_url)
            if result:
                pet_images.append(result)
        except Exception as e:
            print(f"Dog API failed: {e}")

    if "cat" in pets:
        try:
            meta = requests.get("https://api.thecatapi.com/v1/images/search", timeout=5).json()
            image_url = meta[0].get("url", "")
            result = _fetch_and_save("Cat", image_url)
            if result:
                pet_images.append(result)
        except Exception as e:
            print(f"Cat API failed: {e}")

    if "duck" in pets:
        try:
            meta = requests.get("https://random-d.uk/api/v2/random", timeout=5).json()
            image_url = meta.get("url", "")
            result = _fetch_and_save("Duck", image_url)
            if result:
                pet_images.append(result)
        except Exception as e:
            print(f"Duck API failed: {e}")

    groq_prompt = f"""
Generate a fun, slightly dramatic psychological profile for a person with these traits:
- Name: {name}
- Gender: {gender or "not specified"}
- Birth year: {birthyear or "not specified"}, born in {birthplace or "unknown"}, lives in {residence or "unknown"}
- Favourite hobby: {hobby}
- Dream job: {job or "not specified"}
- Overthinking level: {overthink}
- Main character energy: {character}
- Reaction to stress: {stress}
- Energy level: {energy}
- Pets they like: {", ".join(pets) if pets else "none"}
- Big Five personality scores (1=low, 5=high):
  Extraversion: {extraversion}, Conscientiousness: {conscientiousness},
  Openness: {openness}, Agreeableness: {agreeableness}, Neuroticism: {neuroticism}
- Their own comment: "{message or "none"}"

Return ONLY a JSON object with exactly these keys:
{{
  "career_desc": "2 punchy sentences describing why this career fits them perfectly, weaving together their dream job '{job or hobby}', hobby ({hobby}), and personality scores. Make it feel personal and cinematic — not generic.",
  "nickname": "a funny 3-5 word nickname title",
  "nick_desc": "one witty sentence explaining the nickname (max 20 words)",
  "personality_type": "a made-up personality type label like 'Chaotic Overthinker' (2-3 words)",
  "personality_desc": "2 funny sentences describing their personality based on ALL traits above",
  "motivation": "one punchy motivational line tailored to this person (max 20 words)",
  "warning_label": "a funny 'WARNING:' label for this person, like a product warning (max 15 words)",
  "archetype_name": "a dramatic secret-agent/fantasy code name like 'The Silent Architect' or 'Neon Ghost Protocol' (3-5 words)",
  "archetype_desc": "one sentence explaining why this archetype fits them perfectly (max 25 words)",
  "superpower": "their unique superpower described dramatically in one sentence (max 20 words)",
  "kryptonite": "their fatal weakness described with dark humor in one sentence (max 20 words)",
  "fictional_character": "name of a fictional character they most resemble (just the name, e.g. 'Walter White')",
  "fictional_reason": "one sentence explaining the match with dramatic flair (max 25 words)",
  "soul_city": "name of a city in the world that matches their soul (just the city name)",
  "soul_city_reason": "one vivid atmospheric sentence explaining why this city is their spiritual home (max 25 words)",
  "villain_origin": "a 2-sentence dramatic villain origin story for this person based on their background and traits"
}}
"""

    ai = call_groq(groq_prompt)
    fallback_nick, fallback_nick_desc = FALLBACK_NICKNAMES.get(
        hobby, ("The Enigmatic One", "You contain multitudes. Probably too many.")
    )

    # Build a fallback career_desc if Groq didn't return one
    fallback_career_descs = {
        "coding":  "You turn caffeine into code and chaos into systems. A true digital architect.",
        "art":     "You see colours others haven't invented yet. The canvas is just the beginning.",
        "gaming":  "You've played every game. Now it's time to make one that breaks everyone else.",
        "cooking": "You make Gordon Ramsay nervous. Every dish is a calculated power move.",
        "music":   "Your neighbours hate you. The charts will love you. Worth it.",
        "reading": "You consume books like oxygen. Soon you'll write one that consumes others.",
        "sports":  "Stats, sweat, and glory — you live for the game and the game knows it.",
        "travel":  "Passport: full. Bank account: questionable. Regrets: zero.",
    }
    fallback_career_desc = fallback_career_descs.get(
        hobby, "You defy every category the system invented. Nietzsche is taking notes."
    )

    session["profile_data"].update({
        "name":             name,
        "gender":           gender,
        "birthyear":        birthyear,
        "birthplace":       birthplace,
        "residence":        residence,
        "job":              job,
        "message":          message,
        "big_five": {
            "extraversion":      extraversion,
            "conscientiousness": conscientiousness,
            "openness":          openness,
            "agreeableness":     agreeableness,
            "neuroticism":       neuroticism,
        },
        "career":           career,
        "career_desc":      ai.get("career_desc", fallback_career_desc),
        "nickname":         ai.get("nickname",         fallback_nick),
        "nick_desc":        ai.get("nick_desc",         fallback_nick_desc),
        "personality_type": ai.get("personality_type",  "Mysterious Entity"),
        "personality_desc": ai.get("personality_desc",  "The algorithm couldn't figure you out. That's either impressive or concerning."),
        "motivation":       ai.get("motivation",        FALLBACK_MOTIVATIONS.get(hobby, "Keep going. Probably.")),
        "warning_label":    ai.get("warning_label",     "WARNING: May cause existential confusion in others."),
        "archetype_name":   ai.get("archetype_name",    "The Unnamed Force"),
        "archetype_desc":   ai.get("archetype_desc",    "You operate outside the simulation's known parameters."),
        "superpower":       ai.get("superpower",        "You can absorb chaos and convert it into vibe."),
        "kryptonite":       ai.get("kryptonite",        "You will spiral for 45 minutes over a two-word text reply."),
        "fictional_character": ai.get("fictional_character", "Neo (The Matrix)"),
        "fictional_reason": ai.get("fictional_reason",  "You sense something is wrong with the world but can't quite name it."),
        "soul_city":        ai.get("soul_city",         "Tokyo"),
        "soul_city_reason": ai.get("soul_city_reason",  "Neon, silence, and controlled chaos — your natural habitat."),
        "villain_origin":   ai.get("villain_origin",    "They were always too smart for the room. The room never forgave them for it."),
        "movies":           movies,
        "pets":             pet_images,
    })

    return {"message": "Analysis complete! Your profile is ready."}


@app.get("/view/input")
def view_input(request: Request):
    return request.state.session["user_data"]


@app.get("/view/profile")
def view_profile(request: Request):
    return request.state.session["profile_data"]

@app.get("/view/pet/{filename}")
def view_pet(filename: str, request: Request):
    """Serve a pet image that was saved to disk during /analyze."""
    session_id = request.state.session_id
    filepath = Path("static/pets") / session_id / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Pet image not found")
    mime, _ = mimetypes.guess_type(str(filepath))
    return FileResponse(str(filepath), media_type=mime or "image/jpeg")