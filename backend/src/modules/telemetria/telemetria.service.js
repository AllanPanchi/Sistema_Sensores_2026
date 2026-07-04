import { AppError } from '../../middlewares/error.middleware.js';
import * as repo from './telemetria.repository.js';
import { findBoyaById, findSensoresByBoya } from '../boyas/boyas.repository.js';

// ── Límites de seguridad ───────────────────────────────────────────────────
const MAX_LINEAS = 100_000; // tope de filas por archivo (anti-DoS)

// Firmas binarias (magic bytes) de formatos que NO son CSV.
// Detecta ejecutables o documentos renombrados a .csv.
const FIRMAS_BINARIAS = [
  { firma: [0x4d, 0x5a],             tipo: 'ejecutable Windows (MZ)' },
  { firma: [0x7f, 0x45, 0x4c, 0x46], tipo: 'ejecutable Linux (ELF)' },
  { firma: [0x50, 0x4b, 0x03, 0x04], tipo: 'ZIP/XLSX (no es CSV plano)' },
  { firma: [0x25, 0x50, 0x44, 0x46], tipo: 'PDF' },
  { firma: [0xd0, 0xcf, 0x11, 0xe0], tipo: 'documento Office antiguo (OLE)' },
];

// Rangos de plausibilidad física por tipo de sensor (limpieza de datos basura).
// Se aplican por nombre de campo normalizado; si ninguno coincide, rango genérico.
const PLAUSIBILIDAD = [
  { patron: /^temp/,    min: -50,    max: 60 },
  { patron: /^humedad/, min: 0,      max: 100 },
  { patron: /^tds/,     min: 0,      max: 3000 },
  { patron: /^ph/,      min: 0,      max: 14 },
  { patron: /^nivel/,   min: 0,      max: 100 },
];
const RANGO_GENERICO = { min: -10_000, max: 100_000 };

// ── Helpers de validación de archivo ───────────────────────────────────────

const validarArchivo = (file) => {
  if (!file) {
    throw new AppError('Archivo CSV requerido (campo multipart "archivo")', 400);
  }

  // Defensa en profundidad: la extensión ya se validó en el fileFilter de multer,
  // pero se repite aquí por si la ruta cambia en el futuro.
  if (!file.originalname?.toLowerCase().endsWith('.csv')) {
    throw new AppError('Solo se permiten archivos con extensión .csv', 400);
  }

  const buf = file.buffer;
  if (!buf || buf.length === 0) {
    throw new AppError('El archivo está vacío', 400);
  }

  // 1. Magic bytes: rechazar binarios disfrazados de CSV
  for (const { firma, tipo } of FIRMAS_BINARIAS) {
    if (buf.length >= firma.length && firma.every((b, i) => buf[i] === b)) {
      throw new AppError(`El archivo no es un CSV válido: se detectó ${tipo}`, 400);
    }
  }

  // 2. Bytes nulos: un CSV de texto plano jamás los contiene.
  //    Escanear los primeros 8KB basta para detectar contenido binario/corrupto.
  const muestra = buf.subarray(0, 8192);
  if (muestra.includes(0x00)) {
    throw new AppError('El archivo contiene datos binarios: CSV corrupto o malicioso', 400);
  }
};

// ── Helpers de parseo (formato del datalogger: ';' y coma decimal) ─────────

// "11/6/2026 12:20" → Date (o null si es inválida)
const parsearFecha = (str) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(str?.trim() ?? '');
  if (!m) return null;
  const [, dia, mes, anio, hora, min] = m.map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || min > 59) return null;
  const fecha = new Date(anio, mes - 1, dia, hora, min);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// "48,2" → 48.2 (o null si no es un número puro — descarta 'ERROR', 'N/A', '=cmd()', etc.)
const parsearNumero = (str) => {
  const limpio = str?.trim().replace(',', '.') ?? '';
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return parseFloat(limpio);
};

// "Humedad 1" → "humedad_1", "Nivel (m)" → "nivel_m", "Ph" → "ph"
// Solo [a-z0-9_]: neutraliza inyección de nombres de campo hacia InfluxDB.
const normalizarCampo = (str) =>
  str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const esPlausible = (campo, valor) => {
  const regla = PLAUSIBILIDAD.find((r) => r.patron.test(campo)) ?? RANGO_GENERICO;
  return valor >= regla.min && valor <= regla.max;
};

// ── Estadísticas: media, mediana y moda por campo ──────────────────────────

const calcularEstadisticas = (valoresPorCampo) => {
  const stats = {};
  for (const [campo, valores] of Object.entries(valoresPorCampo)) {
    if (valores.length === 0) continue;

    const orden = [...valores].sort((a, b) => a - b);
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const mitad = Math.floor(orden.length / 2);
    const mediana = orden.length % 2 === 0
      ? (orden[mitad - 1] + orden[mitad]) / 2
      : orden[mitad];

    // Moda: valor más frecuente (el primero en caso de empate)
    const frecuencias = new Map();
    let moda = valores[0];
    let maxFrec = 0;
    for (const v of valores) {
      const f = (frecuencias.get(v) ?? 0) + 1;
      frecuencias.set(v, f);
      if (f > maxFrec) { maxFrec = f; moda = v; }
    }

    stats[campo] = {
      media:   Math.round(media * 10_000) / 10_000,
      mediana: Math.round(mediana * 10_000) / 10_000,
      moda,
      muestras: valores.length,
    };
  }
  return stats;
};

// ── Limpieza fila por fila ─────────────────────────────────────────────────
// Fila corrupta (columnas de más/menos, fecha inválida) → se descarta entera.
// Celda corrupta (no numérica o fuera de rango físico) → se descarta solo el valor.
const limpiarFilas = (lineas, cabecera, columnas) => {
  const filasValidas = [];
  let filasDescartadas = 0;
  let valoresDescartados = 0;
  const valoresPorCampo = Object.fromEntries(columnas.map(({ campo }) => [campo, []]));

  for (let i = 1; i < lineas.length; i++) {
    const celdas = lineas[i].split(';');

    if (celdas.length !== cabecera.length) { filasDescartadas++; continue; }

    const ts = parsearFecha(celdas[0]);
    if (!ts) { filasDescartadas++; continue; }

    const filaCampos = {};
    for (const { campo, idx } of columnas) {
      const valor = parsearNumero(celdas[idx]);
      if (valor === null || !esPlausible(campo, valor)) {
        valoresDescartados++;
        continue;
      }
      filaCampos[campo] = valor;
      valoresPorCampo[campo].push(valor);
    }

    // Fila sin ningún valor rescatable → basura
    if (Object.keys(filaCampos).length === 0) { filasDescartadas++; continue; }

    filasValidas.push({ ts, campos: filaCampos });
  }

  return { filasValidas, filasDescartadas, valoresDescartados, valoresPorCampo };
};

// ── Caso de uso principal: ingesta de CSV ──────────────────────────────────

export const procesarCSV = async (idboya, file) => {
  const boyaId = parseInt(idboya, 10);
  if (Number.isNaN(boyaId)) throw new AppError('ID de boya inválido', 400);

  const boya = await findBoyaById(boyaId);
  if (!boya) throw new AppError(`Boya con ID ${boyaId} no encontrada`, 404);

  // Coherencia de dominio: la telemetría solo se acepta si la boya tiene
  // sensores registrados en Postgres — el CSV debe corresponder a ellos.
  const sensores = await findSensoresByBoya(boyaId);
  if (sensores.length === 0) {
    throw new AppError(
      `La boya "${boya.nombre}" no cuenta con sensores registrados. Registra sus sensores en el módulo de Boyas antes de cargar telemetría.`,
      409
    );
  }
  // Mapa: nombre de sensor normalizado → sensor (para casar columnas del CSV)
  const sensoresPorNombre = new Map(
    sensores.map((s) => [normalizarCampo(s.nombresensor), s])
  );

  validarArchivo(file);

  // Decodificar y trocear (tolerante a BOM y a finales de línea Windows/Unix)
  const texto = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lineas.length < 2) throw new AppError('El CSV no contiene filas de datos', 400);
  if (lineas.length > MAX_LINEAS) {
    throw new AppError(`El CSV excede el máximo de ${MAX_LINEAS} filas`, 413);
  }

  // Cabecera: "Fecha;<sensor>;<sensor>;..."
  const cabecera = lineas[0].split(';').map(normalizarCampo);
  if (cabecera[0] !== 'fecha' || cabecera.length < 2) {
    throw new AppError('Cabecera inválida: se espera "Fecha;<sensores...>" separada por ";"', 400);
  }
  const campos = cabecera.slice(1);
  if (campos.some((c) => c === '') || new Set(campos).size !== campos.length) {
    throw new AppError('Cabecera inválida: nombres de columna vacíos o duplicados', 400);
  }

  // Casar columnas del CSV contra los sensores registrados: solo se ingesta
  // lo que corresponde a un sensor de la boya. El resto se ignora y reporta.
  const columnas = campos
    .map((campo, j) => ({ campo, idx: j + 1 }))
    .filter(({ campo }) => sensoresPorNombre.has(campo));
  const columnasSinSensor = campos.filter((c) => !sensoresPorNombre.has(c));

  if (columnas.length === 0) {
    const registrados = sensores.map((s) => s.nombresensor).join(', ');
    throw new AppError(
      `Ninguna columna del CSV corresponde a los sensores registrados de la boya. Sensores registrados: ${registrados}`,
      400
    );
  }

  const { filasValidas, filasDescartadas, valoresDescartados, valoresPorCampo } =
    limpiarFilas(lineas, cabecera, columnas);

  if (filasValidas.length === 0) {
    throw new AppError('El CSV no contiene ningún dato válido tras la limpieza', 400);
  }

  // El datalogger emite varias lecturas con el mismo minuto. InfluxDB
  // sobrescribiría puntos con timestamp idéntico, así que se desplazan
  // milisegundos incrementales dentro del mismo minuto para conservarlas todas.
  const contadorTs = new Map();
  for (const fila of filasValidas) {
    const clave = fila.ts.getTime();
    const n = contadorTs.get(clave) ?? 0;
    contadorTs.set(clave, n + 1);
    if (n > 0) fila.ts = new Date(clave + n);
  }

  const puntosEscritos = await repo.writeTelemetria(boyaId, filasValidas);

  return {
    archivo:             file.originalname,
    boya:                { id: boyaId, nombre: boya.nombre },
    filas_totales:       lineas.length - 1,
    filas_validas:       filasValidas.length,
    filas_descartadas:   filasDescartadas,
    valores_descartados: valoresDescartados,
    columnas_sin_sensor: columnasSinSensor,
    puntos_escritos:     puntosEscritos,
    estadisticas:        calcularEstadisticas(valoresPorCampo),
  };
};

// ── Consulta de telemetría ─────────────────────────────────────────────────

export const consultarTelemetria = async (idboya, { horas, limite } = {}) => {
  const boyaId = parseInt(idboya, 10);
  if (Number.isNaN(boyaId)) throw new AppError('ID de boya inválido', 400);

  const boya = await findBoyaById(boyaId);
  if (!boya) throw new AppError(`Boya con ID ${boyaId} no encontrada`, 404);

  // Sanitizar: estos valores se interpolan en la query Flux, por eso se fuerzan
  // a enteros acotados (nunca se interpola texto del usuario).
  const h = Math.min(Math.max(parseInt(horas, 10) || 24, 1), 720);      // 1h – 30 días
  const n = Math.min(Math.max(parseInt(limite, 10) || 500, 1), 5000);

  const mediciones = await repo.queryTelemetria(boyaId, h, n);
  return {
    boya:  { id: boyaId, nombre: boya.nombre },
    rango_horas: h,
    total: mediciones.length,
    mediciones,
  };
};
