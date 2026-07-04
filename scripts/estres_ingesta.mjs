#!/usr/bin/env node
/**
 * Prueba de carga y estrés de la ingesta de telemetría (HidroSentinel).
 *
 * Simula concurrencia masiva: N subidas simultáneas de CSV al endpoint
 * POST /api/telemetria/:idboya, con una "profundidad" de concurrencia
 * controlada (cuántas peticiones vuelan a la vez). Mide throughput, latencias
 * (p50/p95/p99) y errores para localizar el cuello de botella en la escritura
 * hacia InfluxDB — el núcleo de rendimiento del sistema.
 *
 * No requiere dependencias (fetch/FormData/Blob nativos de Node 18+).
 *
 * Uso:
 *   node scripts/estres_ingesta.mjs --boya 3 --total 100 --concurrencia 10
 *   node scripts/estres_ingesta.mjs --boya 3 --carpeta ./data_historica
 *   node scripts/estres_ingesta.mjs --boya 3 --total 200 --concurrencia 25 --filas 250
 *
 * Si se pasa --carpeta, sube esos CSV reales (ciclando si hay menos que --total).
 * Si no, genera un CSV sintético en memoria de --filas líneas para cada petición.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Argumentos ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (n, def) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : def; };

const API      = arg('api', process.env.API_URL || 'http://localhost:3000');
const BOYA     = arg('boya');
const TOTAL    = parseInt(arg('total', '100'), 10);
const CONCUR   = parseInt(arg('concurrencia', '10'), 10);
const FILAS    = parseInt(arg('filas', '200'), 10);
const CARPETA  = arg('carpeta');
const CORREO   = arg('correo', process.env.ADMIN_CORREO || 'admin@hidrosentinel.ec');
const PASSWORD = arg('password', process.env.ADMIN_PASSWORD || 'Admin2026!');

if (!BOYA) {
  console.error('Falta --boya <id>.\nUso: node scripts/estres_ingesta.mjs --boya 3 --total 100 --concurrencia 10');
  process.exit(2);
}

// ── Generación de un CSV sintético en memoria ────────────────────────────────
// Columnas que casan con los sensores típicos registrados en la boya de prueba.
const generarCSV = (nFilas) => {
  const cab = 'Fecha;Temp1;Humedad 1;Temp 2;Humedad 2;TDS;Temperatura NTC;Ph;Nivel (m)';
  const filas = [cab];
  let min = 20;
  for (let i = 0; i < nFilas; i++) {
    if (i % 5 === 0) min++;
    const h = 12 + Math.floor(min / 60);
    const mm = String(min % 60).padStart(2, '0');
    const t1 = (23 + Math.random()).toFixed(1).replace('.', ',');
    const h1 = (48 + Math.random() * 2).toFixed(1).replace('.', ',');
    const ph = (8.5 + Math.random() * 0.1).toFixed(2).replace('.', ',');
    filas.push(`11/6/2026 ${h}:${mm};${t1};${h1};22,1;54,5;274;-148,87;${ph};0,23`);
  }
  return filas.join('\n');
};

// ── Carga de CSVs reales desde carpeta (opcional) ────────────────────────────
let poolCSV = null;
if (CARPETA) {
  const archivos = fs.readdirSync(CARPETA).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (archivos.length === 0) { console.error(`Sin CSVs en ${CARPETA}`); process.exit(2); }
  poolCSV = archivos.map((f) => ({ nombre: f, buffer: fs.readFileSync(path.join(CARPETA, f)) }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const login = async () => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Login fallido (${res.status}): ${json.message}`);
  return json.data.token;
};

const percentil = (arr, p) => {
  if (arr.length === 0) return 0;
  const orden = [...arr].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))];
};

// Una petición de subida. Devuelve { ok, ms, status, puntos }.
const subir = async (token, i) => {
  let buffer, nombre;
  if (poolCSV) {
    const c = poolCSV[i % poolCSV.length];
    buffer = c.buffer; nombre = c.nombre;
  } else {
    buffer = Buffer.from(generarCSV(FILAS), 'utf8');
    nombre = `carga_${i}.csv`;
  }
  const form = new FormData();
  form.append('archivo', new Blob([buffer], { type: 'text/csv' }), nombre);

  const t0 = performance.now();
  try {
    const res = await fetch(`${API}/api/telemetria/${BOYA}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const ms = performance.now() - t0;
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success, ms, status: res.status, puntos: json.data?.puntos_escritos || 0, msg: json.message };
  } catch (err) {
    return { ok: false, ms: performance.now() - t0, status: 0, puntos: 0, msg: err.message };
  }
};

// ── Ejecución con concurrencia acotada (pool de workers) ─────────────────────
console.log(`\nPrueba de estrés → ${API}`);
console.log(`Boya ${BOYA} · ${TOTAL} peticiones · concurrencia ${CONCUR} · ${poolCSV ? `${poolCSV.length} CSV reales` : `${FILAS} filas sintéticas c/u`}\n`);

const token = await login().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });

const resultados = [];
let lanzadas = 0;
const errores = {};

const worker = async () => {
  while (lanzadas < TOTAL) {
    const i = lanzadas++;
    const r = await subir(token, i);
    resultados.push(r);
    if (!r.ok) errores[r.msg || `HTTP ${r.status}`] = (errores[r.msg || `HTTP ${r.status}`] || 0) + 1;
    if (resultados.length % Math.max(1, Math.floor(TOTAL / 10)) === 0) {
      process.stdout.write(`  ${resultados.length}/${TOTAL} completadas\r`);
    }
  }
};

const inicio = performance.now();
await Promise.all(Array.from({ length: CONCUR }, worker));
const duracionS = (performance.now() - inicio) / 1000;

// ── Reporte ──────────────────────────────────────────────────────────────────
const exitosas = resultados.filter((r) => r.ok);
const latencias = exitosas.map((r) => r.ms);
const puntosTotales = exitosas.reduce((s, r) => s + r.puntos, 0);

console.log('\n\n─────────────  RESULTADOS  ─────────────');
console.log(`Duración total:      ${duracionS.toFixed(2)} s`);
console.log(`Peticiones OK:       ${exitosas.length}/${TOTAL}`);
console.log(`Throughput:          ${(exitosas.length / duracionS).toFixed(1)} req/s`);
console.log(`Puntos → InfluxDB:   ${puntosTotales}  (${(puntosTotales / duracionS).toFixed(0)} puntos/s)`);
console.log('');
console.log(`Latencia media:      ${(latencias.reduce((s, v) => s + v, 0) / latencias.length || 0).toFixed(0)} ms`);
console.log(`Latencia p50:        ${percentil(latencias, 50).toFixed(0)} ms`);
console.log(`Latencia p95:        ${percentil(latencias, 95).toFixed(0)} ms`);
console.log(`Latencia p99:        ${percentil(latencias, 99).toFixed(0)} ms`);
console.log(`Latencia máx:        ${Math.max(0, ...latencias).toFixed(0)} ms`);

if (Object.keys(errores).length > 0) {
  console.log('\nErrores:');
  for (const [msg, n] of Object.entries(errores)) console.log(`  ${n}×  ${msg}`);
}
console.log('');

process.exit(exitosas.length === TOTAL ? 0 : 1);
