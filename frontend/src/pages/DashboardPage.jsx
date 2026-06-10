import { useState, useEffect } from 'react';
import { getBoyas } from '../api/boyas.api';
import { getUsuarios } from '../api/usuarios.api';
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

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const [boyas, setBoyas] = useState([]);
  const [usuariosCount, setUsuariosCount] = useState(null);
  const [loading, setLoading] = useState(true);

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
    fetchData();
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
    </div>
  );
}
