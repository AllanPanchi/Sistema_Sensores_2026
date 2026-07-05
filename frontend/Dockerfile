# ── Frontend HidroSentinel (React + Vite → nginx) ──────────────────────────

# Etapa 1: compilar la SPA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm install (no npm ci) re-resuelve los binarios opcionales de rollup/vite
# para Linux musl, que un lock generado en Windows no incluye.
RUN npm install
COPY . .
# Sin VITE_API_URL, el cliente usa la ruta relativa '/api' (ver api/http.js),
# que nginx proxeará al backend en el mismo origen.
RUN npm run build

# Etapa 2: servir los estáticos con nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
