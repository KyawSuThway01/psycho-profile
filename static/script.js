// ── Helpers ────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show" + (isError ? " error" : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ""; }, 3000);
}

function setActive(btnId) {
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  const b = document.getElementById(btnId);
  if (b) b.classList.add("active");
}

function loading(msg = "Loading…") {
  document.getElementById("content").innerHTML =
    `<div class="empty"><span class="spinner"></span>${msg}</div>`;
}

// ── 1 · Load Form ──────────────────────────────────────────────────────────
function loadForm() {
  setActive("btn-form");
  showBg("ghost");
  loading("Loading form…");

  fetch("/form")
    .then(r => { if (!r.ok) throw new Error("Failed to load form"); return r.text(); })
    .then(html => {
      document.getElementById("content").innerHTML =
        `<div class="card"><div class="card-title">Your Profile Form</div>${html}</div>`;

      // ── Submit handler ──────────────────────────────────────────────────
      document.getElementById("psycho-form").onsubmit = function(e) {
        e.preventDefault();
        const form = this;
        const btn = form.querySelector("button[type=submit]");
        btn.disabled = true;
        btn.textContent = "Submitting…";

        fetch("/submit", { method: "POST", body: new FormData(form) })
          .then(r => { if (!r.ok) throw new Error("Submit failed"); return r.json(); })
          .then(d => {
            toast("✓ " + d.message);
            btn.disabled = false;
            btn.textContent = "Submit →";
            setTimeout(() => viewInput(), 600);
          })
          .catch(() => {
            toast("Error submitting form", true);
            btn.disabled = false;
            btn.textContent = "Submit →";
          });
      };

      // ── Multi-step wizard (runs after DOM is injected) ──────────────────
      (function initWizard() {
        const TOTAL   = 3;
        let current   = 0;
        const panels  = document.querySelectorAll('.wiz-panel');
        const dots    = document.querySelectorAll('.wiz-step-dot');
        const conns   = document.querySelectorAll('.wiz-connector');
        const labels  = document.querySelectorAll('.wiz-label');
        const btnPrev = document.getElementById('wiz-prev');
        const btnNext = document.getElementById('wiz-next');
        const btnSub  = document.getElementById('wiz-submit');
        const counter = document.getElementById('wiz-counter');

        function shakeField(field) {
          if (!field) return;
          field.classList.add('field-error');
          field.classList.remove('shake');
          void field.offsetWidth;
          field.classList.add('shake');
        }

        function validateBasicInfo() {
          const form = document.getElementById('psycho-form');
          let ok = true;
          form.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error','shake'));
          const nameInput = form.querySelector('input[name="name"]');
          if (!nameInput.value.trim()) { shakeField(nameInput.closest('.field')); ok = false; }
          const genderChecked = form.querySelector('input[name="gender"]:checked');
          if (!genderChecked) { shakeField(form.querySelector('input[name="gender"]').closest('.field')); ok = false; }
          return ok;
        }

        function validateQuestions(names) {
          const form = document.getElementById('psycho-form');
          let ok = true;
          names.forEach(name => {
            if (!form.querySelector(`input[name="${name}"]:checked`)) {
              const inputEl = form.querySelector(`input[name="${name}"]`);
              if (!inputEl) return; // skip if question not in DOM
              const item = inputEl.closest('.q-item');
              if (!item) return;
              item.classList.remove('q-error');
              void item.offsetWidth;
              item.classList.add('q-error');
              ok = false;
            }
          });
          return ok;
        }

        function validateStepNeuro() {
          return validateQuestions(['question6','question13','question19']);
        }

        function validatePrefs() {
          const form = document.getElementById('psycho-form');
          let ok = true;
          ['character'].forEach(name => {
            if (!form.querySelector(`input[name="${name}"]:checked`)) {
              shakeField(form.querySelector(`input[name="${name}"]`).closest('.field'));
              ok = false;
            }
          });
          return ok;
        }

        const stepValidation = {
          0: validateBasicInfo,
          1: () => validateQuestions([
            'question1','question16',
            'question3','question11',
            'question4','question9',
            'question2','question5',
            'question6','question13',
          ]),
          2: validatePrefs,
        };

        // ── Flavor text per step ────────────────────────────────────────────
        const stepFlavors = [
          "identity scan initialising...",
          "decoding your inner architecture...",
          "final layer — almost profiled",
        ];

        // ── Teaser personality types based on early signals ─────────────────
        const teaserTypes = [
          { label: "ARCHITECT TYPE",   desc: "Strategic. Precise. One step ahead." },
          { label: "PHANTOM TYPE",     desc: "Observant. Quiet. Dangerous when underestimated." },
          { label: "SPARK TYPE",       desc: "Chaotic energy. Unpredictable. Magnetic." },
          { label: "SENTINEL TYPE",    desc: "Reliable. Protective. Others depend on you." },
          { label: "ECHO TYPE",        desc: "Empathetic. Deep. You feel what others ignore." },
          { label: "WILDFIRE TYPE",    desc: "Bold. Fast. You ask forgiveness, not permission." },
        ];

        // ── Micro-feedback whispers ─────────────────────────────────────────
        const whispers = {
          "1": ["Strongly disagree... noted. 👁", "The algorithm sees resistance.", "Interesting. Logged."],
          "2": ["Disagree. Pattern forming...", "The data shifts.", "Signal: low. Noted."],
          "3": ["Neutral... the fence-sitter emerges.", "Ambiguity detected. Classic.", "Neither here nor there. Fascinating."],
          "4": ["Agreement registered. 🔮", "That checks out.", "The algorithm approves."],
          "5": ["Strong signal. Marked. ⚡", "Maximum agreement. Noted with interest.", "Loud and clear. The profile deepens."],
        };

        let whisperTimer = null;
        function showWhisper(value) {
          const pool = whispers[String(value)];
          if (!pool) return;
          const msg = pool[Math.floor(Math.random() * pool.length)];
          const el = document.getElementById("psycho-whisper");
          if (!el) return;
          el.textContent = msg;
          el.classList.add("show");
          clearTimeout(whisperTimer);
          whisperTimer = setTimeout(() => el.classList.remove("show"), 2200);
        }

        function updateTeaser() {
          const label = document.getElementById("teaser-label");
          if (!label) return;
          // pick a teaser based on answered questions so far
          const answered = document.querySelectorAll('#psycho-form input[type="radio"]:checked').length;
          const pick = teaserTypes[answered % teaserTypes.length];
          label.textContent = pick.label;
          // unblur after a short delay for drama
          setTimeout(() => label.classList.remove("blurred"), 400);
          const desc = label.closest(".psych-teaser")?.querySelector(".psych-teaser-desc");
          if (desc) desc.textContent = pick.desc + " — Complete the remaining steps to confirm this reading.";
        }

        function render() {
          panels.forEach((p, i) => p.classList.toggle('active', i === current));
          dots.forEach((d, i) => {
            d.classList.remove('active','done');
            if (i === current) d.classList.add('active');
            else if (i < current) d.classList.add('done');
          });
          conns.forEach((c, i) => c.classList.toggle('done', i < current));
          labels.forEach((l, i) => l.classList.toggle('active', i === current));
          counter.textContent = `Step ${current + 1} of 3`;

          // ── Flavor text ────────────────────────────────────────────────────
          const flavor = document.getElementById("wiz-flavor");
          if (flavor) flavor.textContent = stepFlavors[current] || "";

          // ── Teaser update when reaching step 2 (questions step, index 1) ──
          if (current === 1) updateTeaser();

          btnPrev.style.display = current === 0 ? 'none' : '';
          btnNext.style.display = current === TOTAL - 1 ? 'none' : '';
          btnSub.style.display  = current === TOTAL - 1 ? '' : 'none';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        btnNext.addEventListener('click', () => {
          const validate = stepValidation[current];
          if (validate && !validate()) { toast('⚠️ Please fill in all required fields!', true); return; }
          if (current < TOTAL - 1) { current++; render(); }
        });

        btnPrev.addEventListener('click', () => {
          if (current > 0) { current--; render(); }
        });

        document.getElementById('psycho-form').addEventListener('change', function(e) {
          if (e.target.type === 'radio') {
            const item = e.target.closest('.q-item');
            if (item) item.classList.remove('q-error');
            const field = e.target.closest('.field');
            if (field) field.classList.remove('field-error','shake');
            // ── Micro-feedback whisper ──────────────────────────────────────
            if (e.target.name && e.target.name.startsWith('question')) {
              showWhisper(e.target.value);
            }
          }
        });

        render();
      })();
    })
    .catch(() => toast("Error loading form", true));
}

// ── 2 · View Input + Analyze ──────────────────────────────────────────────
function viewInput() {
  setActive("btn-input");
  showBg("ghost");
  loading("Fetching your data…");

  fetch("/view/input")
    .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
    .then(data => {
      if (Object.keys(data).length === 0) {
        document.getElementById("content").innerHTML =
          `<div class="empty"><p>No data yet — <strong>fill the form first!</strong></p></div>`;
        return;
      }

      // ── Field configs ────────────────────────────────────────────────────────
      const fieldConfig = {
        name:      { label: "Name",                 icon: "👤", color: "#00ffe5",  group: "identity" },
        gender:    { label: "Gender",               icon: "⚧",  color: "#c060ff",  group: "identity" },
        birthyear: { label: "Birth Year",           icon: "🗓",  color: "#7eb8ff",  group: "identity" },
        birthplace:{ label: "Birthplace",           icon: "🌏",  color: "#4dffb4",  group: "identity" },
        residence: { label: "Residence",            icon: "📍",  color: "#ff9900",  group: "identity" },
        hobby:     { label: "Favourite Hobby",      icon: "🎯",  color: "#c060ff",  group: "psyche" },
        job:       { label: "Dream Job",            icon: "💼",  color: "#ff9900",  group: "psyche" },
        pet:       { label: "Pets You Like",        icon: "🐾",  color: "#4dffb4",  group: "psyche" },
        overthink: { label: "Overthinking Level",   icon: "🌀",  color: "#ff9900",  group: "psyche" },
        character: { label: "Main Character Energy",icon: "⚡",  color: "#ff5500",  group: "psyche" },
        stress:    { label: "Reaction to Stress",   icon: "🔥",  color: "#ff6eb4",  group: "psyche" },
        energy:    { label: "Energy Level",         icon: "💫",  color: "#7eb8ff",  group: "psyche" },
        message:   { label: "Message",              icon: "💬",  color: "#6a7a9a",  group: "psyche" },
      };

      // ── Real question text map ───────────────────────────────────────────────
      const questionMeta = {
        question1:  { text: "Is talkative",                        trait: "Extraversion",      traitColor: "#ffb400", traitIcon: "⚡" },
        question16: { text: "Is sometimes shy / nervous around strangers", trait: "Extraversion", traitColor: "#ffb400", traitIcon: "⚡" },
        question3:  { text: "Is original, comes up with new ideas", trait: "Openness",          traitColor: "#c060ff", traitIcon: "🔮" },
        question11: { text: "Is a deep thinker",                   trait: "Openness",           traitColor: "#c060ff", traitIcon: "🔮" },
        question4:  { text: "Is helpful, unselfish with others",   trait: "Agreeableness",      traitColor: "#00b4ff", traitIcon: "💙" },
        question9:  { text: "Starts quarrels with others",         trait: "Agreeableness",      traitColor: "#00b4ff", traitIcon: "💙" },
        question2:  { text: "Does a thorough job",                 trait: "Conscientiousness",  traitColor: "#00c878", traitIcon: "✅" },
        question5:  { text: "Can be somewhat careless",            trait: "Conscientiousness",  traitColor: "#00c878", traitIcon: "✅" },
        question6:  { text: "Is relaxed, handles stress well",     trait: "Neuroticism",        traitColor: "#ff5050", traitIcon: "🌀" },
        question13: { text: "Worries a lot",                       trait: "Neuroticism",        traitColor: "#ff5050", traitIcon: "🌀" },
      };

      if (!("pet" in data)) data["pet"] = [];

      // ── Split keys ───────────────────────────────────────────────────────────
      const identityKeys = ["name","gender","birthyear","birthplace","residence"];
      const psycheKeys   = ["hobby","job","pet","character","stress","message"];
      const questionKeys = Object.keys(data).filter(k => k.startsWith("question"));

      // ── Render helpers ───────────────────────────────────────────────────────
      function renderPill(val, color) {
        return `<span class="dv2-pill" style="--pc:${color}">${val}</span>`;
      }

      function renderVal(k, cfg) {
        if (k === "pet") {
          const pets = Array.isArray(data[k]) ? data[k] : (data[k] ? [data[k]] : []);
          return pets.length > 0
            ? pets.map(p => renderPill(p, cfg.color)).join("")
            : `<span style="color:var(--muted);font-style:italic;font-size:11px">None selected</span>`;
        }
        const raw = Array.isArray(data[k]) ? data[k].join(", ") : data[k];
        return renderPill(raw, cfg.color);
      }

      function buildIdentityRow(k) {
        if (!(k in data)) return "";
        const cfg = fieldConfig[k] || { label: k, icon: "◉", color: "#00ffe5" };
        return `
          <div class="dv2-id-row" style="--rc:${cfg.color}">
            <span class="dv2-id-icon">${cfg.icon}</span>
            <span class="dv2-id-label">${cfg.label}</span>
            <span class="dv2-id-dots"></span>
            <span class="dv2-id-val">${renderVal(k, cfg)}</span>
          </div>`;
      }

      function buildPsycheCard(k) {
        if (!(k in data)) return "";
        const cfg = fieldConfig[k] || { label: k, icon: "◉", color: "#00ffe5" };
        return `
          <div class="dv2-psyche-card" style="--pc:${cfg.color}">
            <div class="dv2-psyche-glow"></div>
            <div class="dv2-psyche-top">
              <span class="dv2-psyche-icon">${cfg.icon}</span>
              <span class="dv2-psyche-label">${cfg.label}</span>
            </div>
            <div class="dv2-psyche-val">${renderVal(k, cfg)}</div>
          </div>`;
      }

      // Group questions by trait for display
      function buildTraitGroups() {
        const traitOrder = ["Extraversion","Openness","Agreeableness","Conscientiousness","Neuroticism"];
        const traitGroups = {};
        questionKeys.forEach(k => {
          const meta = questionMeta[k];
          if (!meta) return;
          if (!traitGroups[meta.trait]) traitGroups[meta.trait] = [];
          traitGroups[meta.trait].push(k);
        });

        return traitOrder.filter(t => traitGroups[t]).map(trait => {
          const keys = traitGroups[trait];
          const meta = questionMeta[keys[0]];
          const rows = keys.map(k => {
            const m = questionMeta[k];
            const num = parseFloat(data[k]);
            const isNum = !isNaN(num) && num >= 1 && num <= 5;
            const scoreLabel = ["","Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"][num] || num;
            return `
              <div class="dv2-q-row">
                <div class="dv2-q-text-wrap">
                  <span class="dv2-q-text">${m.text}</span>
                </div>
                ${isNum ? `
                <div class="dv2-q-bar-wrap">
                  <div class="dv2-q-bar" style="--bw:${(num/5)*100}%;--bc:${m.traitColor}"></div>
                </div>
                <div class="dv2-q-score-wrap">
                  <span class="dv2-q-score-num" style="color:${m.traitColor}">${num}</span>
                  <span class="dv2-q-score-label" style="color:${m.traitColor}">${scoreLabel}</span>
                </div>
                ` : renderPill(data[k], m.traitColor)}
              </div>`;
          }).join("");

          return `
            <div class="dv2-trait-group">
              <div class="dv2-trait-head" style="--tc:${meta.traitColor}">
                <span class="dv2-trait-icon">${meta.traitIcon}</span>
                <span class="dv2-trait-name">${trait}</span>
                <span class="dv2-trait-count">${keys.length} question${keys.length > 1 ? "s" : ""}</span>
              </div>
              <div class="dv2-trait-rows">${rows}</div>
            </div>`;
        }).join("");
      }

      const identityHTML  = identityKeys.map(buildIdentityRow).join("");
      const psycheHTML    = psycheKeys.map(buildPsycheCard).join("");
      const traitGroupsHTML = buildTraitGroups();

      document.getElementById("content").innerHTML = `
        <style>
          /* ── Container ── */
          .dv2-wrap { margin-top: 36px; display: flex; flex-direction: column; gap: 28px; }

          /* ── Section header ── */
          .dv2-section-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
          .dv2-section-badge {
            font-family: var(--font-head); font-size: 10px; letter-spacing: 5px;
            text-transform: uppercase; padding: 5px 14px; border-radius: 2px;
          }
          .dv2-section-badge.cyan   { color: #00ffe5; border: 1px solid rgba(0,255,229,0.35); background: rgba(0,255,229,0.06); }
          .dv2-section-badge.purple { color: #c060ff; border: 1px solid rgba(192,96,255,0.35); background: rgba(192,96,255,0.06); }
          .dv2-section-badge.orange { color: #ff9900; border: 1px solid rgba(255,153,0,0.35); background: rgba(255,153,0,0.06); }
          .dv2-section-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.08), transparent); }
          .dv2-section-num { font-size: 10px; color: var(--muted); letter-spacing: 2px; }

          /* ── IDENTITY PANEL ── */
          .dv2-identity-panel {
            background: linear-gradient(160deg, rgba(0,255,229,0.04) 0%, rgba(8,5,20,0.92) 60%);
            border: 1px solid rgba(0,255,229,0.12); border-top: 2px solid rgba(0,255,229,0.4);
            border-radius: 6px; padding: 28px 32px; backdrop-filter: blur(20px);
            box-shadow: 0 0 60px rgba(0,255,229,0.04), 0 12px 48px rgba(0,0,0,0.5);
            position: relative; overflow: hidden;
          }
          .dv2-identity-panel::before {
            content: 'IDENTITY'; position: absolute; top: 18px; right: 28px;
            font-family: var(--font-head); font-size: 60px; letter-spacing: 10px;
            color: rgba(0,255,229,0.03); pointer-events: none; user-select: none;
          }
          .dv2-id-row {
            display: flex; align-items: center; gap: 14px;
            padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
            animation: fadeUp 0.4s ease both;
          }
          .dv2-id-row:last-child { border-bottom: none; }
          .dv2-id-icon {
            font-size: 18px; width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.04); border-radius: 8px; flex-shrink: 0;
            filter: drop-shadow(0 0 6px var(--rc));
          }
          .dv2-id-label {
            font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
            color: var(--muted); min-width: 110px; flex-shrink: 0;
          }
          .dv2-id-dots { flex: 1; border-bottom: 1px dashed rgba(255,255,255,0.07); margin: 0 8px; }
          .dv2-id-val { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }

          /* ── PSYCHE GRID ── */
          .dv2-psyche-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
          .dv2-psyche-card {
            background: linear-gradient(140deg, rgba(12,7,28,0.95) 0%, rgba(6,3,16,0.9) 100%);
            border: 1px solid rgba(255,255,255,0.06); border-bottom: 2px solid var(--pc);
            border-radius: 8px; padding: 22px 20px 18px; position: relative;
            overflow: hidden; backdrop-filter: blur(14px);
            transition: transform 0.22s ease, box-shadow 0.22s ease;
            animation: fadeUp 0.45s ease both; cursor: default;
          }
          .dv2-psyche-glow {
            position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%);
            width: 80%; height: 60px;
            background: radial-gradient(ellipse, var(--pc) 0%, transparent 70%);
            opacity: 0.12; pointer-events: none; transition: opacity 0.3s;
          }
          .dv2-psyche-card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 30px color-mix(in srgb, var(--pc) 20%, transparent); }
          .dv2-psyche-card:hover .dv2-psyche-glow { opacity: 0.3; }
          .dv2-psyche-top { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
          .dv2-psyche-icon { font-size: 22px; filter: drop-shadow(0 0 8px var(--pc)); }
          .dv2-psyche-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--muted); }
          .dv2-psyche-val { display: flex; flex-wrap: wrap; gap: 6px; }

          /* ── TRAIT GROUPS ── */
          .dv2-trait-group {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px; overflow: hidden;
            animation: fadeUp 0.45s ease both;
          }
          .dv2-trait-head {
            display: flex; align-items: center; gap: 12px;
            padding: 14px 22px;
            background: linear-gradient(90deg, color-mix(in srgb, var(--tc) 10%, transparent) 0%, rgba(6,3,16,0.95) 60%);
            border-bottom: 1px solid color-mix(in srgb, var(--tc) 20%, transparent);
          }
          .dv2-trait-icon { font-size: 16px; filter: drop-shadow(0 0 6px var(--tc)); }
          .dv2-trait-name {
            font-family: var(--font-head); font-size: 13px; letter-spacing: 3px;
            text-transform: uppercase; color: var(--tc); flex: 1;
          }
          .dv2-trait-count { font-size: 9px; letter-spacing: 2px; color: var(--muted); }

          .dv2-trait-rows { background: rgba(6,3,14,0.85); }
          .dv2-q-row {
            display: flex; align-items: center; gap: 16px;
            padding: 16px 22px; border-bottom: 1px solid rgba(255,255,255,0.04);
          }
          .dv2-q-row:last-child { border-bottom: none; }
          .dv2-q-text-wrap { flex: 0 0 220px; }
          .dv2-q-text {
            font-size: 12px; letter-spacing: 0.5px;
            color: rgba(220,230,255,0.85); line-height: 1.4;
            font-style: italic;
          }
          .dv2-q-bar-wrap {
            flex: 1; height: 4px; background: rgba(255,255,255,0.06);
            border-radius: 4px; overflow: hidden;
          }
          .dv2-q-bar {
            height: 100%; width: var(--bw);
            background: linear-gradient(90deg, var(--bc), color-mix(in srgb, var(--bc) 60%, white));
            border-radius: 4px; box-shadow: 0 0 8px var(--bc);
            animation: barGrow 0.9s cubic-bezier(0.16,1,0.3,1) both;
          }
          @keyframes barGrow { from { width: 0; } }
          .dv2-q-score-wrap { display: flex; flex-direction: column; align-items: flex-end; min-width: 90px; }
          .dv2-q-score-num { font-family: var(--font-head); font-size: 20px; letter-spacing: 1px; line-height: 1; }
          .dv2-q-score-label { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.7; margin-top: 2px; }

          /* ── Pill ── */
          .dv2-pill {
            display: inline-flex; align-items: center;
            padding: 5px 14px;
            background: rgba(255,255,255,0.04);
            border: 1px solid color-mix(in srgb, var(--pc) 40%, transparent);
            border-radius: 20px; font-size: 12px; font-weight: 700;
            letter-spacing: 1.5px; text-transform: capitalize; color: var(--pc);
            text-shadow: 0 0 10px var(--pc);
            box-shadow: 0 0 12px color-mix(in srgb, var(--pc) 15%, transparent),
                        inset 0 0 10px color-mix(in srgb, var(--pc) 6%, transparent);
            transition: box-shadow 0.2s, transform 0.2s;
          }
          .dv2-pill:hover { transform: scale(1.05); box-shadow: 0 0 20px color-mix(in srgb, var(--pc) 30%, transparent); }

          /* ── Header bar ── */
          .dv2-header-bar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 18px 32px; background: rgba(3,4,10,0.8);
            border: 1px solid rgba(0,255,229,0.15); border-radius: 6px;
            backdrop-filter: blur(20px); position: relative; overflow: hidden;
          }
          .dv2-header-bar::after {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
            background: linear-gradient(180deg, #00ffe5, #c060ff, #ff5500);
            box-shadow: 0 0 12px #00ffe5;
          }
          .dv2-header-title { font-family: var(--font-display); font-size: 26px; letter-spacing: 4px; color: var(--text); text-shadow: 0 0 20px rgba(0,255,229,0.4); }
          .dv2-header-sub { font-size: 10px; letter-spacing: 3px; color: var(--muted); text-transform: uppercase; }
          .dv2-header-status { display: flex; align-items: center; gap: 8px; font-size: 10px; letter-spacing: 2px; color: #4dffb4; }
          .dv2-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4dffb4; box-shadow: 0 0 8px #4dffb4, 0 0 16px #4dffb4; animation: statusPulse 2s ease-in-out infinite; }
          @keyframes statusPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }

          /* ── CTA ── */
          .btn-analyze-cta {
            flex: 1; display: inline-flex; align-items: center; justify-content: center;
            gap: 12px; padding: 20px 32px; font-size: 12px; font-family: var(--font-head);
            letter-spacing: 5px; text-transform: uppercase;
            background: linear-gradient(135deg, rgba(0,255,229,0.08) 0%, rgba(192,96,255,0.06) 100%);
            color: var(--accent); border: 1px solid rgba(0,255,229,0.35);
            border-radius: 4px; cursor: pointer; transition: all 0.25s;
            position: relative; overflow: hidden; width: 100%;
          }
          .btn-analyze-cta::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(90deg, transparent, rgba(0,255,229,0.1), transparent);
            transform: translateX(-100%); transition: transform 0.7s;
          }
          .btn-analyze-cta:hover::before { transform: translateX(100%); }
          .btn-analyze-cta:hover {
            background: rgba(0,255,229,0.1); transform: translateY(-2px);
            box-shadow: 0 0 40px rgba(0,255,229,0.2), inset 0 0 30px rgba(0,255,229,0.06);
            border-color: rgba(0,255,229,0.7); color: #fff;
          }
          .btn-analyze-cta:active { transform: translateY(0); }

          @media (max-width: 600px) {
            .dv2-q-text-wrap { flex: 0 0 130px; }
            .dv2-q-score-wrap { min-width: 60px; }
            .dv2-identity-panel { padding: 20px 16px; }
            .dv2-header-bar { padding: 14px 18px; }
          }
        </style>

        <div class="dv2-wrap">

          <!-- ── TOP HEADER ── -->
          <div class="dv2-header-bar">
            <div>
              <div class="dv2-header-title">Your Dossier</div>
              <div class="dv2-header-sub">PsychoProfile · Submitted Record</div>
            </div>
            <div class="dv2-header-status">
              <div class="dv2-status-dot"></div>
              DATA LOCKED IN
            </div>
          </div>

          <!-- ── §01 IDENTITY ── -->
          <div>
            <div class="dv2-section-head">
              <span class="dv2-section-badge cyan">§01 — Identity</span>
              <div class="dv2-section-line"></div>
              <span class="dv2-section-num">${identityKeys.filter(k => k in data).length} fields</span>
            </div>
            <div class="dv2-identity-panel">
              ${identityHTML || '<p style="color:var(--muted);font-size:11px">No identity data.</p>'}
            </div>
          </div>

          <!-- ── §02 PSYCHE ── -->
          ${psycheKeys.some(k => k in data) ? `
          <div>
            <div class="dv2-section-head">
              <span class="dv2-section-badge purple">§02 — Preferences & Vibe</span>
              <div class="dv2-section-line"></div>
              <span class="dv2-section-num">${psycheKeys.filter(k => k in data).length} traits</span>
            </div>
            <div class="dv2-psyche-grid">${psycheHTML}</div>
          </div>` : ""}

          <!-- ── §03 PERSONALITY QUESTIONS ── -->
          ${questionKeys.length > 0 ? `
          <div>
            <div class="dv2-section-head">
              <span class="dv2-section-badge orange">§03 — Personality Responses</span>
              <div class="dv2-section-line"></div>
              <span class="dv2-section-num">${questionKeys.length} answered</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${traitGroupsHTML}
            </div>
          </div>` : ""}

          <!-- ── CTA ── -->
          <button class="btn-analyze-cta" onclick="runAnalyze()">⚡ Analyze Your Submitted Data</button>

        </div>`;
    })
    .catch(() => toast("Error loading input data", true));
}

// ── 3 · Analyze ────────────────────────────────────────────────────────────
function runAnalyze() {
  setActive("btn-analyze");
  showBg(null);

  // ── Show full-screen psychedelic loading overlay ─────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "analyze-overlay";
  overlay.innerHTML = `
    <style>
      #analyze-overlay {
        position: fixed;
        inset: 0;
        z-index: 9000;
        background: rgba(3,4,10,0.92);
        backdrop-filter: blur(18px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 36px;
        animation: overlayIn 0.35s ease both;
      }
      @keyframes overlayIn {
        from { opacity:0; }
        to   { opacity:1; }
      }
      .ao-rings {
        position: relative;
        width: 120px;
        height: 120px;
      }
      .ao-ring {
        position: absolute;
        border-radius: 50%;
        border: 2px solid transparent;
        animation: ringSpinCW 1.4s linear infinite;
      }
      .ao-ring:nth-child(1) {
        inset: 0;
        border-top-color: #00ffe5;
        border-right-color: rgba(0,255,229,0.2);
        animation-duration: 1.2s;
        box-shadow: 0 0 18px rgba(0,255,229,0.35);
      }
      .ao-ring:nth-child(2) {
        inset: 16px;
        border-top-color: #c060ff;
        border-left-color: rgba(192,96,255,0.2);
        animation-direction: reverse;
        animation-duration: 1.8s;
        box-shadow: 0 0 12px rgba(192,96,255,0.35);
      }
      .ao-ring:nth-child(3) {
        inset: 32px;
        border-top-color: #ff5500;
        border-right-color: rgba(255,85,0,0.2);
        animation-duration: 1s;
        box-shadow: 0 0 10px rgba(255,85,0,0.35);
      }
      .ao-core {
        position: absolute;
        inset: 44px;
        background: radial-gradient(circle, rgba(0,255,229,0.25) 0%, rgba(192,96,255,0.15) 50%, transparent 80%);
        border-radius: 50%;
        animation: corePulse 1.6s ease-in-out infinite;
      }
      @keyframes ringSpinCW { to { transform: rotate(360deg); } }
      @keyframes corePulse { 0%,100%{transform:scale(0.85);opacity:0.7} 50%{transform:scale(1.15);opacity:1} }

      .ao-label {
        font-family: 'Bebas Neue', sans-serif;
        font-size: 20px;
        letter-spacing: 6px;
        color: #00ffe5;
        text-shadow: 0 0 20px rgba(0,255,229,0.6);
        text-transform: uppercase;
      }
      .ao-steps {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
      }
      .ao-step {
        font-family: 'Space Mono', monospace;
        font-size: 11px;
        letter-spacing: 2.5px;
        color: rgba(106,122,154,0.6);
        text-transform: uppercase;
        transition: all 0.4s;
      }
      .ao-step.active {
        color: #c060ff;
        text-shadow: 0 0 12px rgba(192,96,255,0.5);
      }
      .ao-step.done {
        color: rgba(0,255,229,0.5);
      }
      .ao-step.done::before { content: '✓  '; }
      .ao-bar-wrap {
        width: 260px;
        height: 2px;
        background: rgba(255,255,255,0.07);
        border-radius: 2px;
        overflow: hidden;
      }
      .ao-bar {
        height: 100%;
        background: linear-gradient(90deg, #00ffe5, #c060ff, #ff5500);
        border-radius: 2px;
        width: 0%;
        transition: width 0.6s ease;
        box-shadow: 0 0 12px rgba(0,255,229,0.5);
      }
    </style>
    <div class="ao-rings">
      <div class="ao-ring"></div>
      <div class="ao-ring"></div>
      <div class="ao-ring"></div>
      <div class="ao-core"></div>
    </div>
    <div class="ao-label">Decoding Your Psyche</div>
    <div class="ao-bar-wrap"><div class="ao-bar" id="ao-bar"></div></div>
    <div class="ao-steps">
      <div class="ao-step active" id="ao-s1">Scanning personality traits</div>
      <div class="ao-step"       id="ao-s2">Consulting the AI oracle</div>
      <div class="ao-step"       id="ao-s3">Matching career & movies</div>
      <div class="ao-step"       id="ao-s4">Compiling your profile</div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Animate steps
  const steps = [1, 2, 3, 4];
  const durations = [0, 800, 1800, 3000];
  const barPcts   = ["18%", "45%", "72%", "92%"];
  durations.forEach((ms, i) => {
    setTimeout(() => {
      steps.forEach(s => {
        const el = document.getElementById("ao-s" + s);
        if (!el) return;
        el.classList.remove("active", "done");
        if (s < steps[i]) el.classList.add("done");
        if (s === steps[i]) el.classList.add("active");
      });
      const bar = document.getElementById("ao-bar");
      if (bar) bar.style.width = barPcts[i];
    }, ms);
  });

  fetch("/analyze")
    .then(r => {
      if (r.status === 400) return r.json().then(d => { throw new Error(d.detail); });
      if (!r.ok) throw new Error("Analysis failed");
      return r.json();
    })
    .then(d => {
      // Complete the bar
      const bar = document.getElementById("ao-bar");
      if (bar) bar.style.width = "100%";
      setTimeout(() => {
        overlay.remove();
        toast("✓ " + d.message);
        viewProfile();
      }, 700);
    })
    .catch(err => {
      overlay.remove();
      document.getElementById("content").innerHTML = `
        <div class="empty">
          <p style="font-size:22px;margin-bottom:12px">⚠️</p>
          <p style="font-size:16px;font-weight:600;margin-bottom:8px">
            ${err.message || "Error during analysis"}
          </p>
          <p style="font-size:13px;color:var(--muted)">
            Please click <strong style="color:var(--accent)">Fill Form</strong>, complete it, and hit Submit first.
          </p>
        </div>`;
    });
}

// ── 4 · View Profile ───────────────────────────────────────────────────────
function viewProfile() {
  setActive("btn-profile");
  showBg(null);
  loading("Building your profile…");

  fetch("/view/profile")
    .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); })
    .then(data => {
      if (!data.career) {
        document.getElementById("content").innerHTML =
          `<div class="empty"><p>No profile yet — run the analysis first!</p></div>`;
        return;
      }

      // ── Avatar initials ──────────────────────────────────────────────────
      const initials = (data.name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();

      // ── Career → profile images map ────────────────────────────────────────
      const careerImageMap = {
        "Software Engineer":     "/static/images/developer.jpg",
        "Creative Director":     "/static/images/desinger.jpg",
        "Game Designer":         "/static/images/gamer.jpg",
        "Chef / Food Scientist": "/static/images/chef.jpg",
        "Music Producer":        "/static/images/Singer.jpg",
        "Author / Researcher":   "/static/images/Reader.jpg",
        "Sports Analyst":        "/static/images/Player.jpg",
        "Travel Journalist":     "/static/images/Traveler.jpg",
      };
      const profileImg = careerImageMap[data.career] || "/static/images/psycho.jpg";

      // ── Cover gradient based on name ──────────────────────────────────────
      const coverGradients = [
        "linear-gradient(135deg, #0d001a 0%, #1a0033 30%, #000d1a 60%, #001a0d 100%)",
        "linear-gradient(135deg, #1a0000 0%, #0d0020 40%, #00001a 100%)",
        "linear-gradient(135deg, #001520 0%, #0d0028 50%, #200010 100%)",
      ];
      const coverGrad = coverGradients[initials.charCodeAt(0) % 3];

      // ── Cover images: career place images ──────────────────────────────────
      const coverImageMap = {
        "Software Engineer":     "/static/images/developer_place.jpg",
        "Creative Director":     "/static/images/art_place.jpg",
        "Game Designer":         "/static/images/streamer_place.jpg",
        "Chef / Food Scientist": "/static/images/chef_place.jpg",
        "Music Producer":        "/static/images/singer_place.jpg",
        "Author / Researcher":   "/static/images/reader_place.jpg",
        "Sports Analyst":        "/static/images/player_place.jpg",
        "Travel Journalist":     "/static/images/traveler_place.jpg",
      };
      const coverImg = coverImageMap[data.career] || "/static/images/psycho.jpg";
      const coverBgStyle = `background-image:url('${coverImg}');background-size:cover;background-position:center;`;

      // ── Movies HTML ───────────────────────────────────────────────────────
      let moviesHTML = "";
      if (data.movies && data.movies.length > 0) {
        const movieCards = data.movies.map(m => {
          const poster = m.poster && m.poster !== "N/A"
            ? `<img src="${m.poster}" alt="${m.title}" loading="lazy">`
            : `<div class="pp-movie-placeholder">🎬</div>`;
          return `
            <div class="pp-movie-card">
              <div class="pp-movie-poster">${poster}</div>
              <div class="pp-movie-info">
                <div class="pp-movie-title">${m.title}</div>
                <div class="pp-movie-meta">
                  <span class="pp-movie-year">${m.year || ""}</span>
                  ${m.rating && m.rating !== "N/A" ? `<span class="pp-movie-rating">⭐ ${m.rating}</span>` : ""}
                </div>
                <div class="pp-movie-plot">${m.plot || ""}</div>
              </div>
            </div>`;
        }).join("");
        moviesHTML = `
          <div class="pp-section">
            <div class="pp-section-title"><span class="pp-section-icon">🎬</span> Recommended Movies</div>
            <div class="pp-movies-grid">${movieCards}</div>
          </div>`;
      }

      // ── Pets HTML ─────────────────────────────────────────────────────────
      let petsHTML = "";
      if (data.pets && data.pets.length > 0) {
        const petCards = data.pets.map(p => `
          <div class="pp-pet-card">
            <div class="pp-pet-img-wrap">
              <img src="/view/pet/${p.filename}" alt="${p.animal}" onerror="this.style.display='none'" loading="lazy">
              <div class="pp-pet-badge">${p.animal === "Dog" ? "🐶" : p.animal === "Cat" ? "🐱" : "🦆"}</div>
            </div>
            <div class="pp-pet-label">${p.animal}</div>
          </div>`).join("");
        petsHTML = `
          <div class="pp-section">
            <div class="pp-section-title"><span class="pp-section-icon">🐾</span> Spirit Animals</div>
            <div class="pp-pets-grid">${petCards}</div>
          </div>`;
      }

      // ── Full profile HTML ─────────────────────────────────────────────────
      document.getElementById("content").innerHTML = `
        <style>
          /* ── Profile page wrapper ── */
          .psycho-profile-page {
            max-width: 860px;
            margin: 0 auto;
            padding-bottom: 80px;
            animation: fadeUp 0.5s ease both;
          }

          /* ── Cover ── */
          .pp-cover {
            position: relative;
            height: 200px;
            border-radius: 8px 8px 0 0;
            overflow: hidden;
            background: ${coverGrad};
          }
          .pp-cover-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, rgba(3,2,10,0.35) 0%, rgba(3,2,10,0.65) 100%);
          }
          .pp-cover-fx {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse 60% 80% at 20% 50%, rgba(192,96,255,0.25) 0%, transparent 60%),
              radial-gradient(ellipse 40% 60% at 80% 30%, rgba(0,255,229,0.18) 0%, transparent 55%),
              radial-gradient(ellipse 30% 40% at 60% 80%, rgba(255,85,0,0.15) 0%, transparent 50%);
          }
          .pp-cover-scanlines {
            position: absolute;
            inset: 0;
            background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px);
          }
          .pp-cover-noise {
            position: absolute;
            inset: 0;
            opacity: 0.04;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          }
          /* Glitchy cover text */
          .pp-cover-label {
            position: absolute;
            bottom: 18px;
            right: 24px;
            font-family: var(--font-head);
            font-size: 10px;
            letter-spacing: 5px;
            color: rgba(255,255,255,0.18);
            text-transform: uppercase;
          }

          /* ── Profile card body ── */
          .pp-card {
            background: rgba(5,3,15,0.92);
            border: 1px solid rgba(192,96,255,0.2);
            border-top: none;
            border-radius: 0 0 8px 8px;
            padding: 0 28px 28px;
            backdrop-filter: blur(24px);
            margin-bottom: 24px;
            box-shadow: 0 8px 48px rgba(0,0,0,0.8);
          }

          /* ── Avatar row ── */
          .pp-avatar-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-top: -44px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 12px;
          }
          .pp-avatar {
            width: 96px;
            height: 96px;
            border-radius: 50%;
            background: linear-gradient(135deg, #c060ff 0%, #00ffe5 50%, #ff5500 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-head);
            font-size: 36px;
            letter-spacing: 2px;
            color: #fff;
            border: 3px solid rgba(8,5,20,0.9);
            box-shadow: 0 0 0 2px rgba(192,96,255,0.5), 0 0 32px rgba(192,96,255,0.3);
            flex-shrink: 0;
            text-shadow: 0 2px 8px rgba(0,0,0,0.6);
            position: relative;
            overflow: hidden;
          }
          .pp-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top center;
            border-radius: 50%;
            display: block;
          }
          .pp-avatar::after {
            content: '';
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            border: 1px solid rgba(192,96,255,0.2);
            animation: avatarPulse 3s ease-in-out infinite;
          }
          @keyframes avatarPulse {
            0%,100%{ box-shadow: 0 0 0 0 rgba(192,96,255,0.3); }
            50%    { box-shadow: 0 0 0 8px rgba(192,96,255,0); }
          }
          .pp-verified-badge {
            position: absolute;
            bottom: 4px;
            right: 2px;
            width: 22px;
            height: 22px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            border: 2px solid rgba(8,5,20,0.9);
          }

          /* ── Action buttons (like Follow / Message) ── */
          .pp-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            padding-top: 44px;
            flex-wrap: wrap;
          }
          .pp-btn {
            padding: 9px 22px;
            border-radius: 4px;
            font-family: var(--font-head);
            font-size: 11px;
            letter-spacing: 3px;
            text-transform: uppercase;
            cursor: default;
            transition: all 0.2s;
          }
          .pp-btn-primary {
            background: rgba(0,255,229,0.1);
            border: 1px solid rgba(0,255,229,0.4);
            color: var(--accent);
          }
          .pp-btn-secondary {
            background: rgba(192,96,255,0.08);
            border: 1px solid rgba(192,96,255,0.3);
            color: var(--accent3);
          }
          .pp-btn-danger {
            background: rgba(255,85,0,0.08);
            border: 1px solid rgba(255,85,0,0.3);
            color: var(--accent2);
          }

          /* ── Name + handle ── */
          .pp-name {
            font-family: var(--font-head);
            font-size: 30px;
            letter-spacing: 3px;
            color: var(--accent);
            text-shadow: 0 0 20px rgba(0,255,229,0.3);
            line-height: 1;
            margin-bottom: 4px;
          }
          .pp-handle {
            font-size: 11px;
            letter-spacing: 2px;
            color: var(--muted);
            margin-bottom: 12px;
          }
          .pp-handle span { color: var(--accent3); }

          /* ── Bio ── */
          .pp-bio {
            font-size: 12px;
            color: rgba(220,230,255,0.75);
            line-height: 1.8;
            margin-bottom: 20px;
            max-width: 540px;
            font-style: italic;
            border-left: 2px solid rgba(192,96,255,0.3);
            padding-left: 14px;
          }

          /* ── Stats row ── */
          .pp-stats {
            display: flex;
            gap: 0;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }
          .pp-stat {
            flex: 1;
            min-width: 100px;
            padding: 14px 16px;
            text-align: center;
            border-right: 1px solid rgba(255,255,255,0.06);
            background: rgba(255,255,255,0.02);
            transition: background 0.2s;
          }
          .pp-stat:last-child { border-right: none; }
          .pp-stat:hover { background: rgba(255,255,255,0.05); }
          .pp-stat-value {
            font-family: var(--font-head);
            font-size: 18px;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .pp-stat-label {
            font-size: 9px;
            letter-spacing: 2.5px;
            text-transform: uppercase;
            color: var(--muted);
          }

          /* ── Tag pills ── */
          .pp-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 4px;
          }
          .pp-tag {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 10px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-weight: 700;
            border: 1px solid;
            white-space: nowrap;
          }

          /* ── Two-column layout ── */
          .pp-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
          @media (max-width: 600px) { .pp-columns { grid-template-columns: 1fr; } }

          /* ── Info card ── */
          .pp-info-card {
            background: rgba(5,3,15,0.90);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 6px;
            padding: 20px;
            transition: border-color 0.2s, background 0.2s;
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          }
          .pp-info-card:hover {
            border-color: rgba(192,96,255,0.3);
            background: rgba(8,5,22,0.95);
          }
          .pp-info-card-eyebrow {
            font-size: 9px;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: rgba(160,170,200,0.7);
            margin-bottom: 10px;
          }
          .pp-info-card-value {
            font-family: var(--font-head);
            font-size: 20px;
            letter-spacing: 2px;
            line-height: 1.1;
            margin-bottom: 8px;
            text-shadow: 0 0 20px currentColor;
          }
          .pp-info-card-desc {
            font-size: 11px;
            color: rgba(200,210,230,0.75);
            font-style: italic;
            line-height: 1.6;
          }

          /* ── Warning banner ── */
          .pp-warning {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 20px;
            background: rgba(5,3,10,0.90);
            border: 1px solid rgba(255,184,0,0.3);
            border-left: 3px solid var(--accent4);
            border-radius: 4px;
            margin-bottom: 24px;
            font-size: 11px;
            letter-spacing: 1.5px;
            color: var(--accent4);
            line-height: 1.5;
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          }
          .pp-warning-icon { font-size: 18px; flex-shrink: 0; }

          /* ── Motivation quote ── */
          .pp-quote {
            position: relative;
            padding: 24px 28px;
            background: rgba(5,3,15,0.92);
            border: 1px solid rgba(192,96,255,0.2);
            border-radius: 6px;
            margin-bottom: 24px;
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          }
          .pp-quote::before {
            content: '"';
            position: absolute;
            top: -8px;
            left: 20px;
            font-size: 64px;
            font-family: Georgia, serif;
            color: rgba(192,96,255,0.3);
            line-height: 1;
          }
          .pp-quote-text {
            font-size: 15px;
            line-height: 1.7;
            color: rgba(232,240,255,0.95);
            font-style: italic;
            text-align: center;
            padding-top: 8px;
            text-shadow: 0 1px 8px rgba(0,0,0,0.8);
          }
          .pp-quote-attr {
            text-align: right;
            font-size: 10px;
            letter-spacing: 2px;
            color: var(--accent3);
            text-transform: uppercase;
            margin-top: 12px;
          }

          /* ── Sections (movies, pets) ── */
          .pp-section {
            background: rgba(5,3,15,0.92);
            border: 1px solid rgba(192,96,255,0.15);
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 20px;
            backdrop-filter: blur(24px);
            animation: fadeUp 0.5s ease both;
            box-shadow: 0 4px 32px rgba(0,0,0,0.6);
          }
          .pp-section-title {
            font-family: var(--font-head);
            font-size: 11px;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .pp-section-icon { font-size: 16px; }

          /* ── Movies ── */
          .pp-movies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 14px;
          }
          .pp-movie-card {
            background: rgba(10,6,24,0.7);
            border: 1px solid rgba(192,96,255,0.1);
            border-radius: 6px;
            overflow: hidden;
            transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          }
          .pp-movie-card:hover {
            transform: translateY(-4px);
            border-color: rgba(255,85,0,0.35);
            box-shadow: 0 8px 32px rgba(255,85,0,0.12);
          }
          .pp-movie-poster img {
            width: 100%;
            aspect-ratio: 2/3;
            object-fit: cover;
            display: block;
            filter: saturate(1.2);
          }
          .pp-movie-placeholder {
            aspect-ratio: 2/3;
            background: rgba(192,96,255,0.07);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 44px;
          }
          .pp-movie-info { padding: 12px; }
          .pp-movie-title { font-family: var(--font-head); font-size: 14px; letter-spacing: 1px; margin-bottom: 6px; }
          .pp-movie-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
          .pp-movie-year { font-size: 10px; color: var(--muted); letter-spacing: 1px; }
          .pp-movie-rating {
            font-size: 10px;
            font-weight: 700;
            color: var(--accent4);
            background: rgba(255,184,0,0.08);
            border: 1px solid rgba(255,184,0,0.25);
            padding: 2px 8px;
            border-radius: 3px;
            letter-spacing: 1px;
          }
          .pp-movie-plot { font-size: 10px; color: var(--muted); line-height: 1.6; }

          /* ── Pets ── */
          .pp-pets-grid { display: flex; gap: 14px; flex-wrap: wrap; }
          .pp-pet-card {
            flex: 1;
            min-width: 160px;
            max-width: 260px;
            background: rgba(10,6,24,0.7);
            border: 1px solid rgba(192,96,255,0.1);
            border-radius: 6px;
            overflow: hidden;
            transition: transform 0.2s, border-color 0.2s;
          }
          .pp-pet-card:hover {
            transform: translateY(-3px);
            border-color: rgba(0,255,229,0.3);
          }
          .pp-pet-img-wrap {
            position: relative;
            height: 180px;
            overflow: hidden;
          }
          .pp-pet-img-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            filter: saturate(1.2);
            transition: transform 0.3s;
          }
          .pp-pet-card:hover .pp-pet-img-wrap img { transform: scale(1.05); }
          .pp-pet-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 32px;
            height: 32px;
            background: rgba(8,5,20,0.75);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            backdrop-filter: blur(6px);
          }
          .pp-pet-label {
            padding: 10px 14px;
            font-size: 10px;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: var(--accent3);
            font-family: var(--font-head);
          }
        </style>

        <div class="psycho-profile-page">

          <!-- ── Cover + Card ── -->
          <div class="pp-cover" style="${coverBgStyle}">
            <div class="pp-cover-overlay"></div>
            <div class="pp-cover-fx"></div>
            <div class="pp-cover-scanlines"></div>
            <div class="pp-cover-label">PsychoProfile · Know Thyself</div>
          </div>

          <div class="pp-card">
            <!-- Avatar row -->
            <div class="pp-avatar-row">
              <div style="position:relative;display:inline-block">
                <div class="pp-avatar">
                  <img src="${profileImg}" alt="${data.career}" onerror="this.style.display='none';this.parentNode.innerHTML+='${initials}'">
                  <div class="pp-verified-badge">✓</div>
                </div>
              </div>
              <div class="pp-actions">
              </div>
            </div>

            <!-- Name & handle -->
            <div class="pp-name">${(data.name || "Anonymous").toUpperCase()}</div>
            <div class="pp-handle">@${(data.name || "anon").toLowerCase().replace(/\s+/g,"_")} · <span>${data.nickname || "The Unknown"}</span></div>

            <!-- Bio -->
            <div class="pp-bio">${data.nick_desc || "A mysterious entity that defies all categorisation."}</div>

            <!-- Tags — only show info NOT duplicated in cards below -->
            <div class="pp-tags">
              ${data.nickname ? `<span class="pp-tag" style="color:var(--accent2);border-color:rgba(255,85,0,0.35);background:rgba(255,85,0,0.08)">🏷️ ${data.nickname}</span>` : ""}
            </div>
          </div>

          <!-- ── Warning label ── -->
          ${data.warning_label ? `
          <div class="pp-warning">
            <span class="pp-warning-icon">⚠️</span>
            <span>${data.warning_label}</span>
          </div>` : ""}

          <!-- ── Detail cards — each data point shown ONCE ── -->
          <div class="pp-columns">
            <div class="pp-info-card">
              <div class="pp-info-card-eyebrow">💼 Career Match</div>
              <div class="pp-info-card-value" style="color:var(--accent)">${data.career || "TBD"}</div>
              <div class="pp-info-card-desc">${data.career_desc || ""}</div>
            </div>
            <div class="pp-info-card" style="background:rgba(5,3,15,0.92);border-color:rgba(192,96,255,0.2)">
              <div class="pp-info-card-eyebrow">🔮 Psycho Score</div>
              <div style="display:flex;align-items:baseline;gap:4px;margin:8px 0 10px">
                <span style="font-family:var(--font-head);font-size:42px;color:var(--accent3);letter-spacing:2px;text-shadow:0 0 20px rgba(192,96,255,0.6)">${Math.floor(Math.random()*20+80)}</span>
                <span style="font-size:13px;color:var(--muted)">/100</span>
              </div>
              <div class="pp-info-card-desc">You scored higher than most entities in this dimension.</div>
            </div>
            ${data.personality_type ? `
            <div class="pp-info-card" style="grid-column:1/-1">
              <div class="pp-info-card-eyebrow">🧬 Personality Type</div>
              <div class="pp-info-card-value" style="color:var(--accent3)">${data.personality_type}</div>
              <div class="pp-info-card-desc">${data.personality_desc || ""}</div>
            </div>` : ""}
          </div>

          <!-- ── Big Five scores ── -->
          ${data.big_five ? `
          <div class="pp-section" style="margin-bottom:24px">
            <div class="pp-section-title"><span class="pp-section-icon">🧠</span> Big Five Personality Traits</div>
            <div style="display:flex;flex-direction:column;gap:12px;">
              ${[
                ["Extraversion",      data.big_five.extraversion,      "#00ffe5"],
                ["Conscientiousness", data.big_five.conscientiousness, "#c060ff"],
                ["Openness",          data.big_five.openness,          "#ff9900"],
                ["Agreeableness",     data.big_five.agreeableness,     "#4dffb4"],
                ["Neuroticism",       data.big_five.neuroticism,       "#ff2d78"],
              ].map(([trait, score, color]) => `
                <div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(200,210,230,0.8)">${trait}</span>
                    <span style="font-size:11px;font-family:var(--font-head);color:${color}">${score} / 5</span>
                  </div>
                  <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;">
                    <div style="height:100%;width:${(score/5)*100}%;background:${color};border-radius:4px;box-shadow:0 0 8px ${color};transition:width 0.6s ease;"></div>
                  </div>
                </div>`).join("")}
            </div>
          </div>` : ""}

          <!-- ── Motivation quote ── -->
          ${data.motivation ? `
          <div class="pp-quote">
            <div class="pp-quote-text">${data.motivation}</div>
            <div class="pp-quote-attr">— The Algorithm</div>
          </div>` : ""}

          <!-- ── Archetype Code Name ── -->
          ${data.archetype_name ? `
          <div class="pp-section" style="border-color:rgba(0,255,229,0.2);margin-bottom:20px;">
            <div class="pp-section-title"><span class="pp-section-icon">🎴</span> Archetype Code Name</div>
            <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">
              <div style="flex:1;min-width:200px;">
                <div style="font-family:var(--font-head);font-size:28px;letter-spacing:4px;color:var(--accent);text-shadow:0 0 24px rgba(0,255,229,0.5);margin-bottom:10px;line-height:1.1;">${data.archetype_name}</div>
                <div style="font-size:12px;color:rgba(200,215,240,0.8);font-style:italic;line-height:1.7;">${data.archetype_desc}</div>
              </div>
              <div style="width:3px;align-self:stretch;background:linear-gradient(to bottom,var(--accent),transparent);border-radius:2px;flex-shrink:0;"></div>
            </div>
          </div>` : ""}

          <!-- ── Superpower vs Kryptonite ── -->
          ${data.superpower ? `
          <div class="pp-columns" style="margin-bottom:20px;">
            <div class="pp-info-card" style="border-color:rgba(77,255,180,0.25);background:rgba(0,20,15,0.85);">
              <div class="pp-info-card-eyebrow" style="color:rgba(77,255,180,0.7);">⚡ SUPERPOWER</div>
              <div style="font-size:13px;line-height:1.7;color:rgba(220,255,240,0.9);font-style:italic;margin-top:8px;">${data.superpower}</div>
            </div>
            <div class="pp-info-card" style="border-color:rgba(255,45,120,0.25);background:rgba(20,0,10,0.85);">
              <div class="pp-info-card-eyebrow" style="color:rgba(255,45,120,0.7);">💀 KRYPTONITE</div>
              <div style="font-size:13px;line-height:1.7;color:rgba(255,210,220,0.9);font-style:italic;margin-top:8px;">${data.kryptonite}</div>
            </div>
          </div>` : ""}

          <!-- ── Fictional Character ── -->
          ${data.fictional_character ? `
          <div class="pp-section" style="border-color:rgba(192,96,255,0.25);margin-bottom:20px;">
            <div class="pp-section-title"><span class="pp-section-icon">🎭</span> You Are Most Like</div>
            <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
              <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(192,96,255,0.3),rgba(0,255,229,0.2));border:2px solid rgba(192,96,255,0.4);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;">🎬</div>
              <div style="flex:1;min-width:180px;">
                <div style="font-family:var(--font-head);font-size:22px;letter-spacing:3px;color:var(--accent3);text-shadow:0 0 20px rgba(192,96,255,0.5);margin-bottom:8px;">${data.fictional_character}</div>
                <div style="font-size:12px;color:rgba(200,210,240,0.8);font-style:italic;line-height:1.7;">${data.fictional_reason}</div>
              </div>
            </div>
          </div>` : ""}

          <!-- ── Soul City ── -->
          ${data.soul_city ? `
          <div class="pp-section" style="border-color:rgba(255,153,0,0.2);background:rgba(12,7,3,0.90);margin-bottom:20px;">
            <div class="pp-section-title" style="color:var(--accent4);"><span class="pp-section-icon">🌍</span> Your Soul City</div>
            <div style="display:flex;align-items:flex-start;gap:16px;">
              <div style="font-size:42px;line-height:1;flex-shrink:0;filter:drop-shadow(0 0 12px rgba(255,153,0,0.6));">📍</div>
              <div>
                <div style="font-family:var(--font-head);font-size:26px;letter-spacing:4px;color:var(--accent4);text-shadow:0 0 20px rgba(255,153,0,0.5);margin-bottom:8px;">${data.soul_city}</div>
                <div style="font-size:12px;color:rgba(240,210,170,0.85);font-style:italic;line-height:1.7;">${data.soul_city_reason}</div>
              </div>
            </div>
          </div>` : ""}

          <!-- ── Villain Origin Story ── -->
          ${data.villain_origin ? `
          <div class="pp-section" style="border-color:rgba(255,45,120,0.2);background:rgba(15,3,8,0.92);margin-bottom:20px;position:relative;overflow:hidden;">
            <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 0% 50%,rgba(255,45,120,0.06) 0%,transparent 65%);pointer-events:none;"></div>
            <div class="pp-section-title" style="color:#ff2d78;"><span class="pp-section-icon">💀</span> Villain Origin Story</div>
            <div style="font-size:12.5px;color:rgba(255,200,215,0.85);line-height:2;font-style:italic;border-left:2px solid rgba(255,45,120,0.35);padding-left:16px;">${data.villain_origin}</div>
          </div>` : ""}

          <!-- ── Movies & Pets ── -->
          ${moviesHTML}
          ${petsHTML}

        </div>`;
    })
    .catch(err => { console.error("Profile error:", err); toast("Error loading profile", true); });
}
// ── Aliases matching teacher's required function names ────────────────────────
// The teacher's index.html uses these exact names in onclick attributes.
// These simply map to our own named functions above.
function fetch_form()   { loadForm(); }
function submit_form()  { viewInput(); }
function analyze()      { runAnalyze(); }
function view_input()   { viewInput(); }
function view_profile() { viewProfile(); }