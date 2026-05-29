import 'dotenv/config';
import app from './app.js';
import poolUsuarios from './config/db.usuarios.js';
import poolSensores from './config/db.sensores.js';
import { influxUrl } from './config/influxdb.js';

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
