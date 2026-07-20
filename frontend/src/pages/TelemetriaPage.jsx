import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBoyas, getSensores } from '../api/boyas.api';
import { uploadCSV, getTelemetria } from '../api/telemetria.api';
import { useAuth } from '../context/AuthContext';

// Misma normalización que usa el backend (telemetria.service.js:normalizarCampo)
const normalizarCampo = (str) =>
  (str ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const RANGOS = [
  { valor: 24,   etiqueta: 'Últimas 24 h' },
  { valor: 72,   etiqueta: 'Últimos 3 días' },
  { valor: 168,  etiqueta: 'Última semana' },
  { valor: 720,  etiqueta: 'Último mes' },
  { valor: 2160, etiqueta: 'Últimos 3 meses' },
  { valor: 4320, etiqueta: 'Últimos 6 meses' },
];

// "humedad_1" → "Humedad 1", "nivel_m" → "Nivel M"
const etiquetaCampo = (campo) =>
  campo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const formatearNumero = (valor) => {
  if (valor === null || valor === undefined) return '—';
  return typeof valor === 'number' ? valor.toFixed(2) : valor;
};

// Escapa texto de usuario antes de incrustarlo en el HTML del reporte
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Generadores de SVG como string (para el reporte exportable) ────────────
const svgLineaStr = (puntos, notedFechas = new Set(), W = 560, H = 180) => {
  const PAD = { t: 12, r: 14, b: 26, l: 46 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const vals = puntos.map((p) => p.valor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => PAD.l + (i / Math.max(puntos.length - 1, 1)) * iw;
  const y = (v) => PAD.t + ih - ((v - min) / (max - min)) * ih;
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  // Marcadores ámbar sobre los puntos que tienen una nota asociada
  const marks = puntos.map((p, i) => notedFechas.has(p.fecha)
    ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="3.5" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>`
    : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">
    <line x1="${PAD.l}" y1="${y(max)}" x2="${W - PAD.r}" y2="${y(max)}" stroke="#e2e8f0"/>
    <line x1="${PAD.l}" y1="${y(min)}" x2="${W - PAD.r}" y2="${y(min)}" stroke="#e2e8f0"/>
    <text x="${PAD.l - 5}" y="${y(max) + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${formatearNumero(max)}</text>
    <text x="${PAD.l - 5}" y="${y(min) + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${formatearNumero(min)}</text>
    <text x="${PAD.l}" y="${H - 6}" font-size="9" fill="#94a3b8">${formatearFecha(puntos[0].fecha)}</text>
    <text x="${W - PAD.r}" y="${H - 6}" text-anchor="end" font-size="9" fill="#94a3b8">${formatearFecha(puntos[puntos.length - 1].fecha)}</text>
    <path d="${d}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
    ${marks}
  </svg>`;
};

const svgGaugeStr = (valor, indicadores) => {
  if (!indicadores || indicadores.length === 0) return '';
  const min = Math.min(...indicadores.map((i) => Number(i.valormin)));
  const max = Math.max(...indicadores.map((i) => Number(i.valormax)));
  const rango = max - min || 1;
  const W = 560, H = 40, BY = 6, BH = 14;
  let x = 0;
  const segs = indicadores.map((i) => {
    const w = ((Number(i.valormax) - Number(i.valormin)) / rango) * W;
    const r = `<rect x="${x.toFixed(1)}" y="${BY}" width="${w.toFixed(1)}" height="${BH}" fill="${i.color}"/>`;
    x += w; return r;
  }).join('');
  const pos = Math.max(0, Math.min(1, (valor - min) / rango)) * W;
  const activo = indicadores.find((i) => valor >= Number(i.valormin) && valor <= Number(i.valormax));
  return `<svg viewBox="0 0 ${W} ${H}" class="gauge">${segs}
    <polygon points="${(pos - 5).toFixed(1)},${BY - 3} ${(pos + 5).toFixed(1)},${BY - 3} ${pos.toFixed(1)},${BY + 4}" fill="#1e293b"/>
    <text x="0" y="${H - 3}" font-size="10" fill="#64748b">${min}</text>
    <text x="${W}" y="${H - 3}" text-anchor="end" font-size="10" fill="#64748b">${max}</text>
    ${activo ? `<text x="${W / 2}" y="${H - 3}" text-anchor="middle" font-size="11" font-weight="700" fill="${activo.color}">${activo.etiqueta}</text>` : ''}
  </svg>`;
};

// ── Mini gráfico de línea (una serie por sensor, escala propia) ────────────
// Con notas por punto: al hacer clic en un punto se abre un editor de observación.
function MiniChart({ nombre, puntos, boyaId, notas = {}, onGuardarNota }) {
  const [hover, setHover] = useState(null); // { i, px, py }
  const [sel, setSel] = useState(null);     // { i } punto seleccionado para nota
  const [texto, setTexto] = useState('');
  const svgRef = useRef(null);

  const W = 300, H = 110;
  const PAD = { top: 8, right: 8, bottom: 18, left: 38 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const valores = puntos.map((p) => p.valor);
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; } // serie plana: evitar división por cero

  const x = (i) => PAD.left + (i / Math.max(puntos.length - 1, 1)) * innerW;
  const y = (v) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

  const path = puntos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`)
    .join(' ');

  const notaDe = (i) => notas[`${boyaId}|${nombre}|${puntos[i].fecha}`];

  const idxDesdeEvento = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / innerW;
    const i = Math.round(frac * (puntos.length - 1));
    return i < 0 || i >= puntos.length ? null : i;
  };

  const handleMove = (e) => {
    const i = idxDesdeEvento(e);
    if (i === null) return setHover(null);
    setHover({ i, px: x(i), py: y(puntos[i].valor) });
  };

  const handleClick = (e) => {
    const i = idxDesdeEvento(e);
    if (i === null) return;
    setSel({ i });
    setTexto(notaDe(i)?.texto ?? '');
  };

  const guardar = () => {
    onGuardarNota(nombre, puntos[sel.i].fecha, puntos[sel.i].valor, texto);
    setSel(null);
  };
  const eliminar = () => {
    onGuardarNota(nombre, puntos[sel.i].fecha, puntos[sel.i].valor, '');
    setSel(null);
  };

  const ultimo = puntos[puntos.length - 1];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h4 className="text-sm font-semibold text-slate-700">{etiquetaCampo(nombre)}</h4>
        <span className="text-sm font-bold text-slate-800">{formatearNumero(ultimo.valor)}</span>
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-pointer"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
        >
          {/* Grid recesivo: solo min y max */}
          <line x1={PAD.left} y1={y(max)} x2={W - PAD.right} y2={y(max)} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={PAD.left} y1={y(min)} x2={W - PAD.right} y2={y(min)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PAD.left - 4} y={y(max) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{formatearNumero(max)}</text>
          <text x={PAD.left - 4} y={y(min) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{formatearNumero(min)}</text>

          {/* Eje x: primera y última fecha */}
          <text x={PAD.left} y={H - 4} fontSize="9" fill="#94a3b8">
            {formatearFecha(puntos[0].fecha)}
          </text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {formatearFecha(ultimo.fecha)}
          </text>

          {/* Serie */}
          <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Marcadores ámbar en puntos con nota */}
          {puntos.map((p, i) => notaDe(i)
            ? <circle key={i} cx={x(i)} cy={y(p.valor)} r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
            : null)}

          {/* Punto seleccionado para editar nota */}
          {sel && (
            <circle cx={x(sel.i)} cy={y(puntos[sel.i].valor)} r="5" fill="none" stroke="#f59e0b" strokeWidth="2" />
          )}

          {/* Capa hover: crosshair + punto */}
          {hover && (
            <>
              <line x1={hover.px} y1={PAD.top} x2={hover.px} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx={hover.px} cy={hover.py} r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            </>
          )}
        </svg>

        {hover && (
          <div
            className="absolute pointer-events-none bg-slate-800 text-white text-xs rounded-md px-2 py-1 shadow-lg -translate-x-1/2 -translate-y-full max-w-[220px]"
            style={{ left: `${(hover.px / W) * 100}%`, top: `${(hover.py / H) * 100 - 6}%` }}
          >
            <div>
              <span className="font-semibold">{formatearNumero(puntos[hover.i].valor)}</span>
              <span className="text-slate-300 ml-1.5">{formatearFecha(puntos[hover.i].fecha)}</span>
            </div>
            {notaDe(hover.i) && (
              <div className="mt-1 pt-1 border-t border-white/20 text-amber-300 whitespace-normal">
                <span className="mr-1">📝</span>{notaDe(hover.i).texto}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor de nota del punto seleccionado */}
      {sel ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600">
              Nota · <span className="text-blue-600">{formatearNumero(puntos[sel.i].valor)}</span>{' '}
              <span className="text-slate-400">{formatearFecha(puntos[sel.i].fecha)}</span>
            </span>
            <button onClick={() => setSel(null)} className="text-xs text-slate-400 hover:text-slate-600">
              Cancelar
            </button>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Escribe una observación para este punto…"
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            {notaDe(sel.i) && (
              <button onClick={eliminar} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                Eliminar
              </button>
            )}
            <button
              onClick={guardar}
              disabled={!texto.trim()}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Guardar nota
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          <span className="text-amber-500">●</span> Haz clic en un punto de la gráfica para dejar una nota.
        </p>
      )}
    </div>
  );
}

// ── Gauge de niveles cualitativos (estilo escala de pH) ────────────────────
// Barra segmentada por los indicadores del sensor con un marcador en el valor actual.
function GaugeIndicadores({ valor, indicadores }) {
  if (!indicadores || indicadores.length === 0 || typeof valor !== 'number') return null;

  const min = Math.min(...indicadores.map((i) => Number(i.valormin)));
  const max = Math.max(...indicadores.map((i) => Number(i.valormax)));
  const rango = max - min || 1;
  const pos = Math.max(0, Math.min(1, (valor - min) / rango));
  const activo = indicadores.find(
    (i) => valor >= Number(i.valormin) && valor <= Number(i.valormax)
  );

  return (
    <div className="w-full mb-4">
      <div className="relative">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          {indicadores.map((i) => (
            <div
              key={i.idindicador}
              style={{ width: `${((Number(i.valormax) - Number(i.valormin)) / rango) * 100}%`, backgroundColor: i.color }}
              title={`${i.etiqueta} [${i.valormin}–${i.valormax}]`}
            />
          ))}
        </div>
        {/* Marcador del valor actual */}
        <div className="absolute top-0 -translate-x-1/2 -translate-y-full" style={{ left: `${pos * 100}%` }}>
          <div className="w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '7px solid #334155' }} />
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-medium">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {activo && (
        <p className="text-xs font-bold mt-1" style={{ color: activo.color }}>
          {activo.etiqueta}
        </p>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function TelemetriaPage() {
  const { hasRole, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [boyas, setBoyas] = useState([]);
  const [boyaId, setBoyaId] = useState('');
  const [horas, setHoras] = useState(24);
  const [mediciones, setMediciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sensorActivo, setSensorActivo] = useState(null);
  const [sensoresBoya, setSensoresBoya] = useState([]);   // sensores con sus indicadores
  const [exportOpen, setExportOpen] = useState(false);    // modal de selección de sensores a exportar
  const [exportSel, setExportSel] = useState([]);         // campos elegidos para el reporte

  // Notas por punto: { `${boyaId}|${campo}|${fecha}`: { boyaId, campo, fecha, valor, texto, creado } }
  // Persistidas en localStorage — sobreviven recargas en el mismo navegador.
  const NOTAS_KEY = 'hidrosentinel_notas';
  const [notas, setNotas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTAS_KEY)) ?? {}; }
    catch { return {}; }
  });

  const guardarNota = (campo, fecha, valor, texto) => {
    setNotas((prev) => {
      const k = `${boyaId}|${campo}|${fecha}`;
      const next = { ...prev };
      if (texto.trim()) {
        next[k] = { boyaId, campo, fecha, valor, texto: texto.trim(), creado: prev[k]?.creado ?? new Date().toISOString() };
      } else {
        delete next[k];
      }
      localStorage.setItem(NOTAS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Notas de un campo en la boya actual, ordenadas cronológicamente
  const notasCampo = (campo) =>
    Object.values(notas)
      .filter((n) => String(n.boyaId) === String(boyaId) && n.campo === campo)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Subida de CSV
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);      // { columnas: [{campo, sensor, matchType, asignacionManual}], todosSensores }
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileInputRef = useRef(null);

  const puedeSubir = hasRole('ADMINISTRADOR') || hasRole('OPERADOR');

  // Coherencia: sin sensores registrados en la boya no hay ingesta posible
  const boyaSeleccionada = boyas.find((b) => String(b.idboya) === boyaId);
  const sinSensores =
    boyaSeleccionada && Number.parseInt(boyaSeleccionada.total_sensores || 0, 10) === 0;

  useEffect(() => {
    getBoyas()
      .then((res) => {
        const lista = res.data.data;
        setBoyas(lista);
        if (lista.length === 0) return;
        // Si venimos de una alerta (?boya=ID) y esa boya existe, la preseleccionamos.
        const solicitada = searchParams.get('boya');
        const existe = solicitada && lista.some((b) => String(b.idboya) === String(solicitada));
        setBoyaId(String(existe ? solicitada : lista[0].idboya));
      })
      .catch(() => setError('No se pudieron cargar las boyas'));
  }, [searchParams]);

  const cargarTelemetria = useCallback(async () => {
    if (!boyaId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getTelemetria(boyaId, { horas, limite: 1000 });
      // El backend devuelve descendente; ascendente para graficar
      setMediciones([...res.data.data.mediciones].reverse());
    } catch (err) {
      setError(err.response?.data?.message || 'Error al consultar la telemetría');
      setMediciones([]);
    } finally {
      setLoading(false);
    }
  }, [boyaId, horas]);

  useEffect(() => { cargarTelemetria(); }, [cargarTelemetria]);

  // Carga los sensores (con sus indicadores) de la boya para dibujar los gauges
  useEffect(() => {
    if (!boyaId) { setSensoresBoya([]); return; }
    getSensores(boyaId)
      .then((res) => setSensoresBoya(res.data.data))
      .catch(() => setSensoresBoya([]));
  }, [boyaId]);

  // Mapea un campo normalizado de telemetría a su sensor registrado (por nombre o unidad)
  const sensorDeCampo = (campo) =>
    sensoresBoya.find(
      (s) => normalizarCampo(s.nombresensor) === campo
        || (s.nomenclatura && normalizarCampo(s.nomenclatura) === campo)
    ) ?? null;

  const resetUpload = () => {
    setArchivo(null);
    setPreview(null);
    setResultado(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !boyaId) return;
    setArchivo(file);
    setPreview(null);
    setResultado(null);
    setCargandoPreview(true);
    try {
      // Leer solo la primera línea del CSV para obtener las cabeceras
      const text = await file.text();
      const primeraLinea = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
      const columnasCsv = primeraLinea.split(';').slice(1).map(normalizarCampo).filter(Boolean);

      // Obtener sensores de la boya seleccionada
      const res = await getSensores(boyaId);
      const sensores = res.data.data;

      // Construir mapas de matching (mismo criterio que el backend)
      const porNombre = new Map(sensores.map((s) => [normalizarCampo(s.nombresensor), s]));
      const porNomenclatura = new Map(
        sensores
          .filter((s) => s.nomenclatura?.trim())
          .map((s) => [normalizarCampo(s.nomenclatura), s])
      );

      const columnas = columnasCsv.map((campo) => {
        if (porNombre.has(campo))       return { campo, sensor: porNombre.get(campo),       matchType: 'nombre',       asignacionManual: null };
        if (porNomenclatura.has(campo)) return { campo, sensor: porNomenclatura.get(campo), matchType: 'nomenclatura', asignacionManual: null };
        return { campo, sensor: null, matchType: null, asignacionManual: null };
      });

      setPreview({ columnas, todosSensores: sensores });
    } catch {
      setError('No se pudo analizar el archivo');
      resetUpload();
    } finally {
      setCargandoPreview(false);
    }
  };

  // Actualiza la asignación manual de una fila sin match automático
  const updateAsignacion = (idx, sensor) => {
    setPreview((prev) => ({
      ...prev,
      columnas: prev.columnas.map((c, i) =>
        i === idx ? { ...c, asignacionManual: sensor } : c
      ),
    }));
  };

  // Sensores de la boya que no están ya asignados (ni auto ni manual) en ninguna fila,
  // excluyendo la fila `exceptoIdx` para que el select propio no se cuente a sí mismo.
  const sensoresLibresEn = (exceptoIdx) => {
    if (!preview) return [];
    const usados = new Set(
      preview.columnas
        .filter((_, i) => i !== exceptoIdx)
        .map((c) => c.sensor?.idsensor ?? c.asignacionManual?.idsensor)
        .filter(Boolean)
    );
    return preview.todosSensores.filter((s) => !usados.has(s.idsensor));
  };

  const handleUpload = async () => {
    if (!archivo || !boyaId) return;
    setSubiendo(true);
    setError('');
    try {
      // Si el usuario asignó sensores manualmente, renombramos esas cabeceras
      // en el CSV en memoria para que el backend las detecte por nombre de sensor.
      const tieneManual = preview?.columnas.some((c) => c.asignacionManual);
      let archivoASubir = archivo;
      if (tieneManual) {
        const text = await archivo.text();
        const lineas = text.split(/\r?\n/);
        const cabecera = lineas[0].split(';');
        preview.columnas.forEach(({ campo, asignacionManual }) => {
          if (!asignacionManual) return;
          const j = cabecera.findIndex((h, i) => i > 0 && normalizarCampo(h) === campo);
          if (j > 0) cabecera[j] = asignacionManual.nombresensor;
        });
        lineas[0] = cabecera.join(';');
        archivoASubir = new File([lineas.join('\r\n')], archivo.name, { type: 'text/csv' });
      }

      const res = await uploadCSV(boyaId, archivoASubir);
      setResultado(res.data.data);
      resetUpload();
      await cargarTelemetria();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al subir el archivo');
    } finally {
      setSubiendo(false);
    }
  };

  // Campos numéricos presentes en las mediciones (excluye fecha)
  const campos = mediciones.length > 0
    ? Object.keys(mediciones[0]).filter((k) => k !== 'fecha').sort()
    : [];

  // Serie por campo, omitiendo huecos (valores descartados en la limpieza)
  const seriePorCampo = (campo) =>
    mediciones
      .filter((m) => typeof m[campo] === 'number')
      .map((m) => ({ fecha: m.fecha, valor: m[campo] }));

  // Estadísticas descriptivas de un campo sobre el rango actualmente cargado
  const calcularEstadisticas = (campo) => {
    const valores = mediciones
      .map((m) => m[campo])
      .filter((v) => typeof v === 'number');
    if (valores.length === 0) return null;

    const sorted = [...valores].sort((a, b) => a - b);
    const n = sorted.length;
    const media = valores.reduce((s, v) => s + v, 0) / n;
    const mediana = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    const freq = new Map();
    let moda = valores[0], maxFreq = 0;
    for (const v of valores) {
      const f = (freq.get(v) ?? 0) + 1;
      freq.set(v, f);
      if (f > maxFreq) { maxFreq = f; moda = v; }
    }

    const fmt = (v) => Math.round(v * 10000) / 10000;
    return {
      min:      fmt(sorted[0]),
      max:      fmt(sorted[n - 1]),
      media:    fmt(media),
      mediana:  fmt(mediana),
      moda:     fmt(moda),
      muestras: n,
    };
  };

  // Campos de la boya que tienen datos suficientes para graficar (exportables)
  const camposExportables = () => campos.filter((c) => seriePorCampo(c).length > 1);

  // Abre el modal de selección con todos los sensores marcados por defecto
  const abrirExportar = () => {
    setExportSel(camposExportables());
    setExportOpen(true);
  };

  const toggleExportCampo = (campo) =>
    setExportSel((prev) =>
      prev.includes(campo) ? prev.filter((c) => c !== campo) : [...prev, campo]
    );

  // ── Exportar reporte único (HTML autocontenido con gráficos + toda la data) ──
  // `elegidos` = campos a incluir; por defecto, los seleccionados en el modal.
  const exportarReporte = (elegidos = exportSel) => {
    const boya = boyas.find((b) => String(b.idboya) === boyaId);
    const rango = RANGOS.find((r) => r.valor === horas)?.etiqueta ?? '';
    const generado = new Date().toLocaleString('es-EC');
    const generadoPor = user
      ? `${[user.nombre, user.apellido].filter(Boolean).join(' ')}${user.correo ? ` (${user.correo})` : ''}`
      : '—';
    const camposConDatos = camposExportables().filter((c) => elegidos.includes(c));
    const totalNotas = camposConDatos.reduce((s, c) => s + notasCampo(c).length, 0);

    const secciones = camposConDatos.map((campo) => {
      const serie = seriePorCampo(campo);
      const sensor = sensorDeCampo(campo);
      const est = calcularEstadisticas(campo);
      const ultimo = serie[serie.length - 1].valor;
      const ns = notasCampo(campo);
      const notedFechas = new Set(ns.map((n) => n.fecha));
      const notasHtml = ns.length
        ? `<div class="notas">
             <h3>Observaciones (${ns.length})</h3>
             <ul>${ns.map((n) =>
               `<li><span class="np">${formatearNumero(n.valor)} · ${formatearFecha(n.fecha)}</span> ${escapeHtml(n.texto)}</li>`
             ).join('')}</ul>
           </div>`
        : '';
      return `<section class="sensor">
        <div class="sensor-head">
          <h2>${etiquetaCampo(campo)}</h2>
          <span class="ultimo">${formatearNumero(ultimo)}${sensor?.nomenclatura ? ` ${sensor.nomenclatura}` : ''}</span>
        </div>
        ${svgGaugeStr(ultimo, sensor?.indicadores)}
        ${svgLineaStr(serie, notedFechas)}
        <table class="stats">
          <tr><th>Muestras</th><th>Mín</th><th>Máx</th><th>Media</th><th>Mediana</th><th>Moda</th></tr>
          <tr><td>${est.muestras}</td><td>${est.min}</td><td>${est.max}</td><td>${est.media}</td><td>${est.mediana}</td><td>${est.moda}</td></tr>
        </table>
        ${notasHtml}
      </section>`;
    }).join('');

    const filas = [...mediciones].reverse().map((m) =>
      `<tr><td>${formatearFecha(m.fecha)}</td>${camposConDatos.map((c) => `<td>${formatearNumero(m[c])}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Reporte HidroSentinel — ${boya?.nombre ?? 'Boya'}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1e293b;margin:0;padding:32px;max-width:820px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px} .meta{color:#64748b;font-size:13px;margin:0 0 24px}
  .sensor{border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:18px;page-break-inside:avoid}
  .sensor-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
  .sensor-head h2{font-size:16px;margin:0} .ultimo{font-size:20px;font-weight:800;color:#2563eb}
  svg.chart,svg.gauge{width:100%;height:auto;display:block;margin:6px 0}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
  th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:center} th{background:#f8fafc;font-weight:600}
  .stats th,.stats td{text-align:center}
  .data{margin-top:12px} .data td:first-child,.data th:first-child{text-align:left;white-space:nowrap}
  .notas{margin-top:12px;border-left:3px solid #f59e0b;background:#fffbeb;border-radius:0 8px 8px 0;padding:8px 14px}
  .notas h3{font-size:13px;margin:0 0 6px;color:#b45309}
  .notas ul{margin:0;padding-left:16px} .notas li{font-size:13px;margin:3px 0;color:#334155}
  .notas .np{color:#b45309;font-weight:600;font-size:12px;margin-right:6px}
  .btn{position:fixed;top:16px;right:16px;background:#2563eb;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-size:14px;cursor:pointer}
  @media print{.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
<h1>HidroSentinel — Reporte de Telemetría</h1>
<p class="meta">Boya: <strong>${boya?.nombre ?? '—'}</strong> · Período: ${rango} · ${mediciones.length} registros${totalNotas ? ` · ${totalNotas} observación(es)` : ''}</p>
<p class="meta">Generado por: <strong>${escapeHtml(generadoPor)}</strong> · ${generado}</p>
${secciones || '<p>Sin datos para el período seleccionado.</p>'}
<h2>Datos completos (${mediciones.length} registros)</h2>
<div style="overflow-x:auto"><table class="data">
  <thead><tr><th>Fecha</th>${camposConDatos.map((c) => `<th>${etiquetaCampo(c)}</th>`).join('')}</tr></thead>
  <tbody>${filas}</tbody>
</table></div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${(boya?.nombre ?? 'boya').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Telemetría</h2>
        <p className="text-slate-500 text-sm mt-1">
          Mediciones históricas de sensores por boya
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Filtros — una fila sobre los gráficos */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={boyaId}
          onChange={(e) => setBoyaId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {boyas.length === 0 && <option value="">Sin boyas registradas</option>}
          {boyas.map((b) => (
            <option key={b.idboya} value={b.idboya}>{b.nombre}</option>
          ))}
        </select>
        <select
          value={horas}
          onChange={(e) => setHoras(Number(e.target.value))}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {RANGOS.map((r) => (
            <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
          ))}
        </select>
        <button
          onClick={cargarTelemetria}
          disabled={loading || !boyaId}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <button
          onClick={abrirExportar}
          disabled={mediciones.length === 0}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ml-auto"
          title="Elige los sensores y descarga un reporte con sus gráficos y datos"
        >
          Exportar reporte
        </button>
      </div>

      {/* Modal: selección de sensores a exportar */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Exportar reporte</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {boyas.find((b) => String(b.idboya) === boyaId)?.nombre ?? 'Boya'} · elige los sensores a incluir
                </p>
              </div>
              <button
                onClick={() => setExportOpen(false)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                title="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {(() => {
                const disponibles = camposExportables();
                const todos = exportSel.length === disponibles.length && disponibles.length > 0;
                return (
                  <>
                    {/* Opción: todos los sensores de la boya */}
                    <label className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={todos}
                        onChange={(e) => setExportSel(e.target.checked ? disponibles : [])}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span className="text-sm font-semibold text-emerald-800">
                        Todos los sensores de esta boya ({disponibles.length})
                      </span>
                    </label>

                    {/* Lista de sensores individuales */}
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {disponibles.map((campo) => (
                        <label key={campo} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={exportSel.includes(campo)}
                            onChange={() => toggleExportCampo(campo)}
                            className="w-4 h-4 accent-blue-600"
                          />
                          <span className="text-sm text-slate-700">{etiquetaCampo(campo)}</span>
                        </label>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setExportOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => exportarReporte()}
                disabled={exportSel.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Descargar ({exportSel.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carga de CSV */}
      {puedeSubir && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Cargar archivo CSV</h3>

          {sinSensores && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
              Esta boya no cuenta con los sensores correspondientes. Regístralos en{' '}
              <span className="font-semibold">Boyas y Sensores</span> antes de cargar
              telemetría — las columnas del CSV deben coincidir con los nombres o las
              unidades de los sensores registrados.
            </div>
          )}

          {/* Paso 1: selección de archivo */}
          {!preview && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={sinSensores || cargandoPreview}
                className="text-sm text-slate-600 file:mr-3 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50"
              />
              {cargandoPreview && (
                <span className="text-sm text-slate-500 animate-pulse">Analizando columnas...</span>
              )}
            </div>
          )}

          {/* Paso 2: preview del mapeo de columnas */}
          {preview && (
            <div>
              {/* Encabezado del preview */}
              {(() => {
                const conSensor   = preview.columnas.filter((c) => c.sensor || c.asignacionManual).length;
                const sinSensor   = preview.columnas.length - conSensor;
                return (
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">{archivo?.name}</span>
                      {' · '}{preview.columnas.length} columna(s)
                      {' · '}
                      <span className="text-green-700 font-medium">{conSensor} con sensor</span>
                      {sinSensor > 0 && (
                        <span className="text-slate-400"> · {sinSensor} sin asignar</span>
                      )}
                    </p>
                    <button onClick={resetUpload} className="text-xs text-slate-400 hover:text-slate-600 underline">
                      Cambiar archivo
                    </button>
                  </div>
                );
              })()}

              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-medium">Columna CSV</th>
                      <th className="px-4 py-2.5 text-left font-medium">Sensor</th>
                      <th className="px-4 py-2.5 text-left font-medium">Unidad</th>
                      <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.columnas.map(({ campo, sensor, matchType, asignacionManual }, idx) => {
                      const sensorEfectivo = sensor ?? asignacionManual;
                      const esVerde = Boolean(sensorEfectivo);
                      const libres  = sensoresLibresEn(idx);
                      return (
                        <tr
                          key={campo}
                          className={
                            esVerde
                              ? 'bg-green-50 border-b border-green-100 last:border-0'
                              : 'bg-slate-50 border-b border-slate-100 last:border-0'
                          }
                        >
                          {/* Columna CSV */}
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{campo}</td>

                          {/* Sensor asignado o selector */}
                          <td className="px-4 py-2.5">
                            {sensor ? (
                              <span className="text-slate-700 text-sm">{sensor.nombresensor}</span>
                            ) : (
                              <select
                                value={asignacionManual?.idsensor ?? ''}
                                onChange={(e) => {
                                  const id = parseInt(e.target.value, 10);
                                  updateAsignacion(idx, isNaN(id) ? null : libres.find((s) => s.idsensor === id) ?? null);
                                }}
                                className="text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[180px]"
                              >
                                <option value="">— Sin asignar —</option>
                                {libres.map((s) => (
                                  <option key={s.idsensor} value={s.idsensor}>
                                    {s.nombresensor}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Unidad */}
                          <td className="px-4 py-2.5 text-slate-500 text-xs">
                            {sensorEfectivo
                              ? `${sensorEfectivo.nombreunidad} (${sensorEfectivo.nomenclatura})`
                              : '—'}
                          </td>

                          {/* Badge de estado */}
                          <td className="px-4 py-2.5">
                            {sensor ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                Se cargará
                                {matchType === 'nomenclatura' && (
                                  <span className="font-normal text-green-600"> · por unidad</span>
                                )}
                              </span>
                            ) : asignacionManual ? (
                              <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                Se cargará · manual
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                Se ignorará
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {preview.columnas.every((c) => !c.sensor && !c.asignacionManual) && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  Ninguna columna tiene sensor asignado. Usa los selectores o revisa los nombres
                  de los sensores registrados en esta boya.
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button onClick={resetUpload} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={subiendo || preview.columnas.every((c) => !c.sensor && !c.asignacionManual)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {subiendo ? 'Procesando...' : 'Confirmar y cargar'}
                </button>
              </div>
            </div>
          )}

          {resultado && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800">
                ✓ {resultado.archivo}: {resultado.puntos_escritos} puntos escritos
              </p>
              <p className="text-xs text-green-700 mt-1">
                {resultado.filas_validas} filas válidas · {resultado.filas_descartadas} filas
                descartadas · {resultado.valores_descartados} valores basura filtrados
              </p>
              {resultado.columnas_sin_sensor?.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Columnas ignoradas (sin sensor registrado en la boya):{' '}
                  {resultado.columnas_sin_sensor.join(', ')}
                </p>
              )}

              <div className="mt-3 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-left text-green-800 border-b border-green-200">
                      <th className="py-1 pr-4 font-semibold">Sensor</th>
                      <th className="py-1 pr-4 font-semibold">Media</th>
                      <th className="py-1 pr-4 font-semibold">Mediana</th>
                      <th className="py-1 pr-4 font-semibold">Moda</th>
                      <th className="py-1 font-semibold">Muestras</th>
                    </tr>
                  </thead>
                  <tbody className="text-green-700">
                    {Object.entries(resultado.estadisticas).map(([campo, s]) => (
                      <tr key={campo}>
                        <td className="py-1 pr-4">{etiquetaCampo(campo)}</td>
                        <td className="py-1 pr-4">{s.media}</td>
                        <td className="py-1 pr-4">{s.mediana}</td>
                        <td className="py-1 pr-4">{s.moda}</td>
                        <td className="py-1">{s.muestras}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Small multiples: un gráfico por sensor, cada uno con su escala */}
      {mediciones.length === 0 ? (
        !loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <p className="text-slate-500 text-sm">
              No hay mediciones en el rango seleccionado.
              {puedeSubir && ' Sube un CSV para comenzar.'}
            </p>
          </div>
        )
      ) : (
        <>
          {/* Grilla de Tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-8">
            {campos.map((campo) => {
              const serie = seriePorCampo(campo);
              if (serie.length <= 1) return null;

              const ultimoNum = serie[serie.length - 1].valor;
              const ultimoValor = formatearNumero(ultimoNum);
              const sensor = sensorDeCampo(campo);

              return (
                <div
                  key={campo}
                  onClick={() => setSensorActivo(campo)}
                  className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center cursor-pointer hover:shadow-lg hover:border-blue-400 hover:-translate-y-1 transition-all duration-200 text-center group"
                >
                  <h4 className="text-md font-bold text-slate-600 mb-2">{etiquetaCampo(campo)}</h4>
                  {/* Muestra el último valor en grande. ¡Excelente para UX! */}
                  <span className="text-3xl font-black text-blue-600 mb-4">{ultimoValor}</span>

                  {/* Gauge de niveles definidos por el usuario para este sensor */}
                  <GaugeIndicadores valor={ultimoNum} indicadores={sensor?.indicadores} />

                  <span className="text-xs font-semibold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    Ver gráfica detallada
                  </span>
                </div>
              );
            })}
          </div>

          {/* --- POP-UP (MODAL) DE LA GRÁFICA --- */}
          {sensorActivo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden relative flex flex-col">
                
                {/* Cabecera del Modal */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-800">
                    Historial de {etiquetaCampo(sensorActivo)}
                  </h3>
                  <button
                    onClick={() => setSensorActivo(null)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="Cerrar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Contenido del Modal (La gráfica) */}
                <div className="p-6">
                  <MiniChart
                    nombre={sensorActivo}
                    puntos={seriePorCampo(sensorActivo)}
                    boyaId={boyaId}
                    notas={notas}
                    onGuardarNota={guardarNota}
                  />
                </div>
                
              </div>
            </div>
          )}

          {/* Estadísticas del período seleccionado */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Estadísticas del período</h3>
              <span className="text-xs text-slate-400">
                {RANGOS.find((r) => r.valor === horas)?.etiqueta} · {mediciones.length} puntos
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-slate-500 text-xs border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium text-left">Sensor</th>
                    <th className="px-5 py-2.5 font-medium">Muestras</th>
                    <th className="px-5 py-2.5 font-medium">Mín</th>
                    <th className="px-5 py-2.5 font-medium">Máx</th>
                    <th className="px-5 py-2.5 font-medium">Media</th>
                    <th className="px-5 py-2.5 font-medium">Mediana</th>
                    <th className="px-5 py-2.5 font-medium">Moda</th>
                  </tr>
                </thead>
                <tbody>
                  {campos.map((campo) => {
                    const s = calcularEstadisticas(campo);
                    if (!s) return null;
                    return (
                      <tr key={campo} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 text-right">
                        <td className="px-5 py-2.5 text-left font-medium text-slate-700">
                          {etiquetaCampo(campo)}
                        </td>
                        <td className="px-5 py-2.5 text-slate-400">{s.muestras}</td>
                        <td className="px-5 py-2.5 text-slate-600">{formatearNumero(s.min)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{formatearNumero(s.max)}</td>
                        <td className="px-5 py-2.5 font-semibold text-blue-600">{formatearNumero(s.media)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{formatearNumero(s.mediana)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{formatearNumero(s.moda)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista de tabla (accesibilidad: los datos siempre legibles como texto) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Últimas mediciones</h3>
              <span className="text-xs text-slate-400">{mediciones.length} registros en el rango</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-xs border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">Fecha</th>
                    {campos.map((c) => (
                      <th key={c} className="px-5 py-2.5 font-medium">{etiquetaCampo(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...mediciones].reverse().slice(0, 15).map((m) => (
                    <tr key={m.fecha} className="border-b border-slate-50 text-slate-700">
                      <td className="px-5 py-2 whitespace-nowrap">{formatearFecha(m.fecha)}</td>
                      {campos.map((c) => (
                        <td key={c} className="px-5 py-2">{formatearNumero(m[c]) ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
