#!/usr/bin/env node
/**
 * Cargador por lotes de telemetría para HidroSentinel.
 *
 * Toma una carpeta con CSVs reales (p. ej. todos los meses desde abril) y los
 * sube uno por uno al endpoint /api/telemetria/:idboya, ejercitando la
 * validación, limpieza y estadísticas reales del backend. Sirve como prueba de
 * integración end-to-end y como herramienta de carga histórica.
 *
 * No requiere dependencias externas (usa fetch/FormData/Blob nativos de Node 18+).
 *
 * Uso:
 *   node scripts/cargar_lote.mjs --carpeta ./data_historica --boya 3
 *   node scripts/cargar_lote.mjs --carpeta ./csv --boya 1 --api http://localhost:3000
 *   node scripts/cargar_lote.mjs --carpeta ./csv --boya 1 \
 *        --correo admin@hidrosentinel.ec --password 'Admin2026!'
 *
 * Variables de entorno (alternativa a los flags):
 *   API_URL, ADMIN_CORREO, ADMIN_PASSWORD
 *
 * Código de salida: 0 si todos los archivos se cargaron; 1 si alguno falló.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Parseo de argumentos ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (nombre, def) => {
  const i = args.indexOf(`--${nombre}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const CARPETA  = getArg('carpeta');
const BOYA     = getArg('boya');
const API      = getArg('api', process.env.API_URL || 'http://localhost:3000');
const CORREO   = getArg('correo', process.env.ADMIN_CORREO || 'admin@hidrosentinel.ec');
const PASSWORD = getArg('password', process.env.ADMIN_PASSWORD || 'Admin2026!');

if (!CARPETA || !BOYA) {
  console.error('Faltan argumentos requeridos.\n');
  console.error('Uso: node scripts/cargar_lote.mjs --carpeta <ruta> --boya <id> [--api <url>] [--correo <c>] [--password <p>]');
  process.exit(2);
}

if (!fs.existsSync(CARPETA) || !fs.statSync(CARPETA).isDirectory()) {
  console.error(`La carpeta no existe o no es un directorio: ${CARPETA}`);
  process.exit(2);
}

// ── Descubrir CSVs (orden alfabético = orden cronológico si se nombran ddmmyyyy) ──
const archivos = fs.readdirSync(CARPETA)
  .filter((f) => f.toLowerCase().endsWith('.csv'))
  .sort();

if (archivos.length === 0) {
  console.error(`No se encontraron archivos .csv en ${CARPETA}`);
  process.exit(2);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const login = async () => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`Login fallido (${res.status}): ${json.message || 'sin detalle'}`);
  }
  return json.data.token;
};

const subirArchivo = async (token, nombre) => {
  const ruta = path.join(CARPETA, nombre);
  const buffer = fs.readFileSync(ruta);
  const form = new FormData();
  form.append('archivo', new Blob([buffer], { type: 'text/csv' }), nombre);

  const res = await fetch(`${API}/api/telemetria/${BOYA}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success, status: res.status, json };
};

// ── Ejecución ────────────────────────────────────────────────────────────────
console.log(`\nCargador de telemetría → ${API}`);
console.log(`Boya destino: ${BOYA}  |  Archivos: ${archivos.length}  |  Carpeta: ${CARPETA}\n`);

let token;
try {
  token = await login();
  console.log(`Autenticado como ${CORREO}\n`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}

const resumen = [];
let fallidos = 0;

for (const nombre of archivos) {
  try {
    const { ok, status, json } = await subirArchivo(token, nombre);
    if (ok) {
      const d = json.data;
      resumen.push({
        archivo: nombre,
        estado: 'OK',
        puntos: d.puntos_escritos,
        validas: d.filas_validas,
        descartadas: d.filas_descartadas,
        basura: d.valores_descartados,
      });
      const ignoradas = d.columnas_sin_sensor?.length
        ? `  (columnas ignoradas: ${d.columnas_sin_sensor.join(', ')})` : '';
      console.log(`✓ ${nombre.padEnd(34)} ${String(d.puntos_escritos).padStart(6)} puntos · ${d.filas_descartadas} filas basura${ignoradas}`);
    } else {
      fallidos++;
      resumen.push({ archivo: nombre, estado: `ERROR ${status}`, puntos: 0 });
      console.log(`✗ ${nombre.padEnd(34)} ${json.message || 'error desconocido'}`);
    }
  } catch (err) {
    fallidos++;
    resumen.push({ archivo: nombre, estado: 'ERROR red', puntos: 0 });
    console.log(`✗ ${nombre.padEnd(34)} ${err.message}`);
  }
}

// ── Resumen final ────────────────────────────────────────────────────────────
const totalPuntos = resumen.reduce((s, r) => s + (r.puntos || 0), 0);
const exitosos = archivos.length - fallidos;

console.log(`\n─────────────────────────────────────────────`);
console.log(`Archivos cargados:  ${exitosos}/${archivos.length}`);
console.log(`Puntos escritos:    ${totalPuntos}`);
if (fallidos > 0) console.log(`Fallidos:           ${fallidos}`);
console.log('');

process.exit(fallidos > 0 ? 1 : 0);
