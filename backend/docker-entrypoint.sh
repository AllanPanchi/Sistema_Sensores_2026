#!/bin/sh
# Entrypoint del backend en Docker: siembra el admin (idempotente) y arranca.
# Para cuando este script corre, docker-compose ya garantizó (vía depends_on +
# healthcheck) que PostgreSQL e InfluxDB están saludables.

echo "[entrypoint] Sembrando usuario administrador (idempotente)..."
node scripts/seed.admin.js || echo "[entrypoint] Seed omitido (el admin ya existe o falló de forma no crítica)."

echo "[entrypoint] Iniciando servidor HidroSentinel..."
exec node src/server.js
