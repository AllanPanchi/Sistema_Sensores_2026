import http from './http';

// Sube un CSV de telemetría para una boya (multipart, campo "archivo")
export const uploadCSV = (boyaId, file) => {
  const formData = new FormData();
  formData.append('archivo', file);
  return http.post(`/telemetria/${boyaId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Últimas mediciones de una boya
export const getTelemetria = (boyaId, { horas = 24, limite = 500 } = {}) =>
  http.get(`/telemetria/${boyaId}`, { params: { horas, limite } });
