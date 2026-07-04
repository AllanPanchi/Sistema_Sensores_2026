import { useState, useEffect } from 'react';
import { getBoyas } from '../api/boyas.api';
import { getUsuarios } from '../api/usuarios.api';
import { getAlertas } from '../api/telemetria.api';
import { useAuth } from '../context/AuthContext';

function StatCard({ title, value, subtitle, colorClass }) {
  return (
    <div className={`rounded-xl border p-5 ${colorClass}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="text-4xl font-bold mt-2">{value}</p>
      <p className="text-sm opacity-70 mt-1">{subtitle}</p>
    </div>
  );
}

// Estilos por nivel de alerta. Color de estado + icono + etiqueta (nunca color solo).
const ESTILO_NIVEL = {
  ANOMALIA: {
    etiqueta: 'Anomalía',
    icono: '⛔',
    card: 'bg-red-50 border-red-200 border-l-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  RIESGO: {
    etiqueta: 'Riesgo',
    icono: '⚠️',
    card: 'bg-amber-50 border-amber-200 border-l-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
};

const formatearFecha = (iso) =>
  new Date(iso).toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

function AlertaItem({ alerta }) {
  const estilo = ESTILO_NIVEL[alerta.nivel] ?? ESTILO_NIVEL.RIESGO;
  return (
    <div className={`rounded-lg border border-l-4 p-4 ${estilo.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${estilo.badge}`}>
              {estilo.icono} {estilo.etiqueta}
            </span>
            <span className="text-sm font-semibold text-slate-800">{alerta.boya.nombre}</span>
            <span className="text-slate-400 text-sm">·</span>
            <span className="text-sm text-slate-600">{alerta.sensor}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1.5">{alerta.mensaje}</p>
        </div>
        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
          {formatearFecha(alerta.fecha)}
        </span>
      </div>
    </div>
  );
}

function PanelAlertas({ loading, data }) {
  if (loading) {
    return <p className="text-slate-500 text-sm">Evaluando alertas...</p>;
  }

  const { total = 0, resumen = {}, alertas = [] } = data ?? {};

  if (total === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Sin alertas activas</p>
          <p className="text-sm text-green-700">
            Todos los sensores con datos están dentro de sus rangos operativos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Alertas activas <span className="text-slate-400">({total})</span>
        </h3>
        <div className="flex items-center gap-2 text-xs">
          {resumen.anomalias > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
              ⛔ {resumen.anomalias} anomalía{resumen.anomalias !== 1 ? 's' : ''}
            </span>
          )}
          {resumen.riesgos > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
              ⚠️ {resumen.riesgos} riesgo{resumen.riesgos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3 max-h-[26rem] overflow-y-auto">
        {alertas.map((a, i) => (
          <AlertaItem key={`${a.boya.id}-${a.sensor}-${i}`} alerta={a} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [boyas, setBoyas] = useState([]);
  const [usuariosCount, setUsuariosCount] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAlertas, setLoadingAlertas] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const boyasRes = await getBoyas();
        setBoyas(boyasRes.data.data);
        if (hasRole('ADMINISTRADOR')) {
          const uRes = await getUsuarios();
          setUsuariosCount(uRes.data.data.length);
        }
      } catch {
        // no bloquear la UI si falla
      } finally {
        setLoading(false);
      }
    };

    const fetchAlertas = async () => {
      try {
        const res = await getAlertas();
        setAlertas(res.data.data);
      } catch {
        setAlertas(null);
      } finally {
        setLoadingAlertas(false);
      }
    };

    fetchData();
    fetchAlertas();
  }, [hasRole]);

  const totalSensores = boyas.reduce(
    (acc, b) => acc + parseInt(b.total_sensores || 0, 10),
    0
  );
  const boyasActivas = boyas.filter((b) => b.estado).length;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">
          Bienvenido, {user?.nombre}
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('es-EC', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Cargando estadísticas...</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Boyas"
            value={boyas.length}
            subtitle="registradas"
            colorClass="bg-blue-50 text-blue-700 border-blue-200"
          />
          <StatCard
            title="Boyas Activas"
            value={boyasActivas}
            subtitle={`de ${boyas.length}`}
            colorClass="bg-green-50 text-green-700 border-green-200"
          />
          <StatCard
            title="Total Sensores"
            value={totalSensores}
            subtitle="configurados"
            colorClass="bg-purple-50 text-purple-700 border-purple-200"
          />
          {hasRole('ADMINISTRADOR') && usuariosCount !== null && (
            <StatCard
              title="Usuarios"
              value={usuariosCount}
              subtitle="en el sistema"
              colorClass="bg-orange-50 text-orange-700 border-orange-200"
            />
          )}
        </div>
      )}

      {/* Panel de alertas: último valor de cada sensor vs. sus umbrales */}
      <div className="mt-6 md:mt-8">
        <h3 className="text-base font-semibold text-slate-800 mb-3">Estado de sensores</h3>
        <PanelAlertas loading={loadingAlertas} data={alertas} />
      </div>
    </div>
  );
}
