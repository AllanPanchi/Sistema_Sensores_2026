import { useState, useEffect } from 'react';
import { getPerfil, updatePassword } from '../api/usuarios.api';
import { useAuth } from '../context/AuthContext';

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export default function PerfilPage() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPerfil()
      .then((res) => setPerfil(res.data.data))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updatePassword(user.id, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess('Contraseña actualizada correctamente');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 md:mb-6">Mi Perfil</h2>

      {/* Datos del usuario */}
      {perfil && (
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Información de la cuenta
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium text-slate-800 mt-0.5">
                {perfil.nombre} {perfil.apellido}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Cédula</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{perfil.cedula}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Correo</dt>
              <dd className="font-medium text-slate-800 mt-0.5 break-all">{perfil.correo}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Roles</dt>
              <dd className="flex flex-wrap gap-1 mt-1">
                {perfil.roles?.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                  >
                    {r}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Cambiar contraseña
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <Field
            label="Contraseña actual"
            type="password"
            value={form.currentPassword}
            onChange={(v) => setForm({ ...form, currentPassword: v })}
          />
          <Field
            label="Nueva contraseña (mín. 8 caracteres)"
            type="password"
            value={form.newPassword}
            onChange={(v) => setForm({ ...form, newPassword: v })}
          />
          <Field
            label="Confirmar nueva contraseña"
            type="password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
