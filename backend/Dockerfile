FROM python:3.12-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN useradd -r -u 10001 pf360 && chown -R pf360 /srv
USER pf360
ENV PF360_ENV=production
EXPOSE 8000
# Terminate TLS in front of this container (load balancer / Caddy / platform ingress).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
