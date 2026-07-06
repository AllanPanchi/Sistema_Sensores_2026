import http from './http';

// ── Boyas ─────────────────────────────────────────────────────────────────
export const getBoyas   = ()           => http.get('/boyas');
export const getBoya    = (id)         => http.get(`/boyas/${id}`);
export const createBoya = (data)       => http.post('/boyas', data);
export const updateBoya = (id, data)   => http.put(`/boyas/${id}`, data);
export const deleteBoya = (id)         => http.delete(`/boyas/${id}`);

// ── Sensores ──────────────────────────────────────────────────────────────
export const getSensores   = (boyaId)                  => http.get(`/boyas/${boyaId}/sensores`);
export const createSensor  = (boyaId, data)            => http.post(`/boyas/${boyaId}/sensores`, data);
export const updateSensor  = (boyaId, sensorId, data)  => http.put(`/boyas/${boyaId}/sensores/${sensorId}`, data);
export const deleteSensor  = (boyaId, sensorId)        => http.delete(`/boyas/${boyaId}/sensores/${sensorId}`);

// ── Unidades de medida ────────────────────────────────────────────────────
export const getUnidades   = ()    => http.get('/boyas/unidades');
export const createUnidad  = (data) => http.post('/boyas/unidades', data);
export const deleteUnidad  = (id)  => http.delete(`/boyas/unidades/${id}`);

// ── Indicadores (niveles cualitativos por sensor) ──────────────────────────
export const getIndicadores   = (boyaId, sensorId)             => http.get(`/boyas/${boyaId}/sensores/${sensorId}/indicadores`);
export const createIndicador  = (boyaId, sensorId, data)       => http.post(`/boyas/${boyaId}/sensores/${sensorId}/indicadores`, data);
export const deleteIndicador  = (boyaId, sensorId, indicadorId) => http.delete(`/boyas/${boyaId}/sensores/${sensorId}/indicadores/${indicadorId}`);
