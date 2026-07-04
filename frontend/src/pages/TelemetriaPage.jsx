import { useState, useEffect, useCallback, useRef } from 'react';
import { getBoyas } from '../api/boyas.api';
import { uploadCSV, getTelemetria } from '../api/telemetria.api';
import { useAuth } from '../context/AuthContext';

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

// ── Mini gráfico de línea (una serie por sensor, escala propia) ────────────
function MiniChart({ nombre, puntos }) {
  const [hover, setHover] = useState(null); // { i, px, py }
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

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / innerW;
    const i = Math.round(frac * (puntos.length - 1));
    if (i < 0 || i >= puntos.length) return setHover(null);
    setHover({ i, px: x(i), py: y(puntos[i].valor) });
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
          className="w-full cursor-crosshair"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
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
            className="absolute pointer-events-none bg-slate-800 text-white text-xs rounded-md px-2 py-1 shadow-lg -translate-x-1/2 -translate-y-full"
            style={{ left: `${(hover.px / W) * 100}%`, top: `${(hover.py / H) * 100 - 6}%` }}
          >
            <span className="font-semibold">{formatearNumero(puntos[hover.i].valor)}</span>
            <span className="text-slate-300 ml-1.5">{formatearFecha(puntos[hover.i].fecha)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function TelemetriaPage() {
  const { hasRole } = useAuth();
  const [boyas, setBoyas] = useState([]);
  const [boyaId, setBoyaId] = useState('');
  const [horas, setHoras] = useState(24);
  const [mediciones, setMediciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sensorActivo, setSensorActivo] = useState(null);

  // Subida de CSV
  const [archivo, setArchivo] = useState(null);
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
        if (lista.length > 0) setBoyaId(String(lista[0].idboya));
      })
      .catch(() => setError('No se pudieron cargar las boyas'));
  }, []);

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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!archivo || !boyaId) return;
    setSubiendo(true);
    setError('');
    setResultado(null);
    try {
      const res = await uploadCSV(boyaId, archivo);
      setResultado(res.data.data);
      setArchivo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      </div>

      {/* Carga de CSV */}
      {puedeSubir && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Cargar archivo CSV</h3>

          {sinSensores && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
              Esta boya no cuenta con los sensores correspondientes. Regístralos en{' '}
              <span className="font-semibold">Boyas y Sensores</span> antes de cargar
              telemetría — las columnas del CSV deben coincidir con los nombres de los
              sensores registrados.
            </div>
          )}

          <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setArchivo(e.target.files[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100 file:cursor-pointer"
            />
            <button
              type="submit"
              disabled={!archivo || !boyaId || subiendo || sinSensores}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {subiendo ? 'Procesando...' : 'Subir CSV'}
            </button>
          </form>

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

              {/* Estadísticas de la ingesta */}
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

              const ultimoValor = formatearNumero(serie[serie.length - 1].valor);

              return (
                <div
                  key={campo}
                  onClick={() => setSensorActivo(campo)}
                  className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center cursor-pointer hover:shadow-lg hover:border-blue-400 hover:-translate-y-1 transition-all duration-200 text-center group"
                >
                  <h4 className="text-md font-bold text-slate-600 mb-2">{etiquetaCampo(campo)}</h4>
                  {/* Muestra el último valor en grande. ¡Excelente para UX! */}
                  <span className="text-3xl font-black text-blue-600 mb-4">{ultimoValor}</span>
                  
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
                  />
                </div>
                
              </div>
            </div>
          )}

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
