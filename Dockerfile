FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Pass env vars at runtime: docker run --env-file .env -p 8000:8000 psychoprofile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]