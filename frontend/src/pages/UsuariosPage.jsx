import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/usuarios.api';
import { register } from '../api/auth.api';

// ── Componentes reutilizables ──────────────────────────────────────────────

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

function Modal({ title, children, onClose, onSave, saving }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([api.getUsuarios(), api.getRoles()]);
      setUsuarios(uRes.data.data);
      setRoles(rRes.data.data);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (type, user = null) => {
    setSelected(user);
    setFormError('');
    if (type === 'create') {
      setForm({ nombre: '', apellido: '', correo: '', cedula: '', password: '', rol: 'OPERADOR' });
    } else if (type === 'edit') {
      setForm({ nombre: user.nombre, apellido: user.apellido, cedula: user.cedula });
    } else if (type === 'roles') {
      setForm({ roles: [...(user.roles || [])] });
    } else if (type === 'password') {
      setForm({ newPassword: '' });
    }
    setModal(type);
  };

  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (modal === 'create') {
        await register(form);
      } else if (modal === 'edit') {
        await api.updateUsuario(selected.usuarioid, form);
      } else if (modal === 'roles') {
        if (form.roles.length === 0) {
          setFormError('Debe asignar al menos un rol');
          setSaving(false);
          return;
        }
        await api.updateRoles(selected.usuarioid, form.roles);
      } else if (modal === 'password') {
        await api.updatePassword(selected.usuarioid, { newPassword: form.newPassword });
      }
      closeModal();
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (usuario) => {
    if (!confirm(`¿Eliminar a ${usuario.nombre} ${usuario.apellido}?`)) return;
    try {
      await api.deleteUsuario(usuario.usuarioid);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  if (loading) return <div className="p-4 md:p-8 text-slate-500 text-sm">Cargando usuarios...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Usuarios</h2>
        <button
          onClick={() => openModal('create')}
          className="px-3 py-2 md:px-4 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {pageError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {pageError}
        </div>
      )}

      {/* Tabla con scroll horizontal en pantallas pequeñas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600">Nombre</th>
                <th className="text-left p-4 font-semibold text-slate-600 hidden sm:table-cell">Correo</th>
                <th className="text-left p-4 font-semibold text-slate-600 hidden md:table-cell">Cédula</th>
                <th className="text-left p-4 font-semibold text-slate-600">Roles</th>
                <th className="text-right p-4 font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
              {usuarios.map((u) => (
                <tr key={u.usuarioid} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-800">
                    <p>{u.nombre} {u.apellido}</p>
                    {/* Correo visible debajo del nombre en xs */}
                    <p className="text-xs text-slate-500 sm:hidden mt-0.5">{u.correo}</p>
                  </td>
                  <td className="p-4 text-slate-600 hidden sm:table-cell">{u.correo}</td>
                  <td className="p-4 text-slate-600 hidden md:table-cell">{u.cedula}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles?.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end flex-wrap gap-1">
                      <ActionBtn onClick={() => openModal('edit', u)} color="slate">Editar</ActionBtn>
                      <ActionBtn onClick={() => openModal('roles', u)} color="purple">Roles</ActionBtn>
                      <ActionBtn onClick={() => openModal('password', u)} color="yellow">Clave</ActionBtn>
                      <ActionBtn onClick={() => handleDelete(u)} color="red">Eliminar</ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      {modal && (
        <Modal
          title={
            modal === 'create'   ? 'Nuevo usuario'    :
            modal === 'edit'     ? 'Editar usuario'   :
            modal === 'roles'    ? 'Gestionar roles'  :
                                   'Cambiar contraseña'
          }
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
        >
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {formError}
            </div>
          )}

          {modal === 'create' && (
            <div className="space-y-3">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
              <Field label="Correo" type="email" value={form.correo} onChange={(v) => setForm({ ...form, correo: v })} />
              <Field label="Cédula" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} />
              <Field label="Contraseña (mín. 8 caracteres)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rol inicial</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.rolid} value={r.nombrerol}>{r.nombrerol}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {modal === 'edit' && (
            <div className="space-y-3">
              <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field label="Apellido" value={form.apellido} onChange={(v) => setForm({ ...form, apellido: v })} />
              <Field label="Cédula" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} />
              <p className="text-xs text-slate-400">El correo no es editable (está en el token JWT activo).</p>
            </div>
          )}

          {modal === 'roles' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Roles de <strong>{selected?.nombre} {selected?.apellido}</strong>
              </p>
              <div className="space-y-2">
                {roles.map((r) => (
                  <label key={r.rolid} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.roles?.includes(r.nombrerol) ?? false}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...(form.roles || []), r.nombrerol]
                          : form.roles.filter((x) => x !== r.nombrerol);
                        setForm({ ...form, roles: next });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700">{r.nombrerol}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {modal === 'password' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Como administrador no necesitas la contraseña actual del usuario.
              </p>
              <Field
                label="Nueva contraseña (mín. 8 caracteres)"
                type="password"
                value={form.newPassword}
                onChange={(v) => setForm({ ...form, newPassword: v })}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function ActionBtn({ onClick, color, children }) {
  const colors = {
    slate:  'bg-slate-100 hover:bg-slate-200 text-slate-700',
    purple: 'bg-purple-100 hover:bg-purple-200 text-purple-700',
    yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700',
    red:    'bg-red-100 hover:bg-red-200 text-red-700',
  };
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded transition-colors ${colors[color]}`}
    >
      {children}
    </button>
  );
}
