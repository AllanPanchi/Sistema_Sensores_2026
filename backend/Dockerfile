# ── Backend HidroSentinel (Node.js + Express) ──────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Instalar solo dependencias de producción (aprovecha la caché de capas:
# package*.json cambia con menos frecuencia que el código fuente).
# npm install (en vez de npm ci) re-resuelve los binarios opcionales propios
# de la plataforma del contenedor (Linux musl), que un lock generado en Windows
# no incluye.
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código de la aplicación (node_modules, tests y .env se excluyen
# vía .dockerignore).
COPY . .

EXPOSE 3000

# El entrypoint siembra el admin (idempotente) y luego arranca el servidor.
CMD ["sh", "docker-entrypoint.sh"]
