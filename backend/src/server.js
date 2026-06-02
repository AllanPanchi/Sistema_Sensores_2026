import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
];

const envPath = envCandidates.find((candidate) => existsSync(candidate));

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
  console.warn('[Env] No se encontró .env en la raíz ni en backend/.');
}

const [{ default: app }, { default: poolUsuarios }, { default: poolSensores }, { influxUrl }] = await Promise.all([
  import('./app.js'),
  import('./config/db.usuarios.js'),
  import('./config/db.sensores.js'),
  import('./config/influxdb.js'),
]);

const PORT = process.env.PORT || 3000;

try {
  // ── Verificar PostgreSQL: DB usuarios ─────────────────────────────────
  await poolUsuarios.query('SELECT 1');
  console.log('[DB] Conectado a PostgreSQL → usuarios');

  // ── Verificar PostgreSQL: DB sensores ─────────────────────────────────
  await poolSensores.query('SELECT 1');
  console.log('[DB] Conectado a PostgreSQL → sensores');

  // ── Verificar InfluxDB (health endpoint) ──────────────────────────────
  const influxHealth = await fetch(`${influxUrl}/health`);
  if (!influxHealth.ok) throw new Error('InfluxDB health check fallido');
  console.log('[DB] Conectado a InfluxDB');

  // ── Levantar servidor ──────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[Server] HidroSentinel API corriendo en http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('[Server] Error fatal al iniciar:', err.message);
  process.exit(1);
}
