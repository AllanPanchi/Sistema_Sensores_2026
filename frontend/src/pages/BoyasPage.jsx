import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/boyas.api';
import { useAuth } from '../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, onSave, saving }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
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

function NumField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        step="any"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// ── Modal de Unidades de Medida ────────────────────────────────────────────

function UnidadesModal({ unidades, onClose, onRefresh }) {
  const [form, setForm] = useState({ nombreunidad: '', nomenclatura: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.nombreunidad.trim() || !form.nomenclatura.trim()) {
      setError('Nombre y nomenclatura son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createUnidad(form);
      setForm({ nombreunidad: '', nomenclatura: '' });
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta unidad de medida?')) return;
    try {
      await api.deleteUnidad(id);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-base font-semibold text-slate-800">Unidades de medida</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
          )}

          <div className="mb-4 divide-y divide-slate-100">
            {unidades.length === 0 && (
              <p className="text-sm text-slate-400 py-2">Sin unidades registradas.</p>
            )}
            {unidades.map((u) => (
              <div key={u.idunidad} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-700">
                  {u.nombreunidad}{' '}
                  <span className="text-slate-400">({u.nomenclatura})</span>
                </span>
                <button
                  onClick={() => handleDelete(u.idunidad)}
                  className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t space-y-2">
            <p className="text-sm font-medium text-slate-700">Nueva unidad</p>
            <input
              placeholder="Nombre (ej. Temperatura)"
              value={form.nombreunidad}
              onChange={(e) => setForm({ ...form, nombreunidad: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Nomenclatura (ej. °C)"
              value={form.nomenclatura}
              onChange={(e) => setForm({ ...form, nomenclatura: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creando...' : '+ Agregar unidad'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

const SENSOR_EMPTY = {
  nombresensor: '',
  idunidad: '',
  rangooperativomin: '',
  umbralriesgomin: '',
  umbralriesgomax: '',
  rangooperativomax: '',
  estado: true,
};

export default function BoyasPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMINISTRADOR');

  const [boyas, setBoyas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [sensores, setSensores] = useState({});

  const [modal, setModal] = useState(null);
  const [selectedBoya, setSelectedBoya] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [boyasRes, unidadesRes] = await Promise.all([
        api.getBoyas(),
        api.getUnidades(),
      ]);
      setBoyas(boyasRes.data.data);
      setUnidades(unidadesRes.data.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadSensores = async (boyaId) => {
    const res = await api.getSensores(boyaId);
    setSensores((prev) => ({ ...prev, [boyaId]: res.data.data }));
  };

  const toggleExpand = async (boya) => {
    if (expanded === boya.idboya) {
      setExpanded(null);
      return;
    }
    setExpanded(boya.idboya);
    if (!sensores[boya.idboya]) {
      await loadSensores(boya.idboya);
    }
  };

  // ── CRUD Boyas ─────────────────────────────────────────────────────────
  const openBoyaModal = (type, boya = null) => {
    setSelectedBoya(boya);
    setFormError('');
    setForm(
      type === 'boya-edit'
        ? { nombre: boya.nombre, estado: boya.estado }
        : { nombre: '', estado: true }
    );
    setModal(type);
  };

  const handleSaveBoya = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (modal === 'boya-create') {
        await api.createBoya(form);
      } else {
        await api.updateBoya(selectedBoya.idboya, form);
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBoya = async (boya) => {
    if (!confirm(`¿Eliminar boya "${boya.nombre}"?\nElimina todos sus sensores primero.`)) return;
    try {
      await api.deleteBoya(boya.idboya);
      if (expanded === boya.idboya) setExpanded(null);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  // ── CRUD Sensores ──────────────────────────────────────────────────────
  const openSensorModal = (type, boya, sensor = null) => {
    setSelectedBoya(boya);
    setSelectedSensor(sensor);
    setFormError('');
    const firstUnidad = String(unidades[0]?.idunidad ?? '');
    setForm(
      sensor
        ? { ...sensor, idunidad: String(sensor.idunidad) }
        : { ...SENSOR_EMPTY, idunidad: firstUnidad }
    );
    setModal(type);
  };

  const handleSaveSensor = async () => {
    setSaving(true);
    setFormError('');
    const boyaId = selectedBoya.idboya;
    try {
      const payload = {
        nombresensor: form.nombresensor,
        idunidad: parseInt(form.idunidad, 10),
        rangooperativomin: parseFloat(form.rangooperativomin),
        umbralriesgomin:   parseFloat(form.umbralriesgomin),
        umbralriesgomax:   parseFloat(form.umbralriesgomax),
        rangooperativomax: parseFloat(form.rangooperativomax),
        estado: form.estado,
      };
      if (modal === 'sensor-create') {
        await api.createSensor(boyaId, payload);
      } else {
        await api.updateSensor(boyaId, selectedSensor.idsensor, payload);
      }
      setModal(null);
      await loadSensores(boyaId);
    } catch (err) {
      const errors = err.response?.data?.errors;
      setFormError(
        Array.isArray(errors) && errors.length
          ? errors.join('\n')
          : err.response?.data?.message || 'Error al guardar'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSensor = async (boya, sensor) => {
    if (!confirm(`¿Eliminar sensor "${sensor.nombresensor}"?`)) return;
    try {
      await api.deleteSensor(boya.idboya, sensor.idsensor);
      await loadSensores(boya.idboya);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  if (loading) return <div className="p-4 md:p-8 text-slate-500 text-sm">Cargando boyas...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Boyas y Sensores</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setModal('unidades')}
              className="px-3 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
            >
              Unidades
            </button>
            <button
              onClick={() => openBoyaModal('boya-create')}
              className="px-3 py-2 md:px-4 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Boya
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {boyas.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center text-slate-400 text-sm">
            No hay boyas registradas.
          </div>
        )}

        {boyas.map((boya) => (
          <div key={boya.idboya} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Cabecera de boya */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => toggleExpand(boya)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    boya.estado ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{boya.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {boya.total_sensores} sensor(es) · {boya.sensores_activos} activo(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                {isAdmin && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); openBoyaModal('boya-edit', boya); }}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteBoya(boya); }}
                      className="px-2.5 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                    >
                      Eliminar
                    </button>
                  </>
                )}
                <span className="text-slate-400 text-xs ml-1">
                  {expanded === boya.idboya ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Sensores expandidos */}
            {expanded === boya.idboya && (
              <div className="border-t bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-600">Sensores</p>
                  {isAdmin && (
                    <button
                      onClick={() => openSensorModal('sensor-create', boya)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      + Sensor
                    </button>
                  )}
                </div>

                {!sensores[boya.idboya] ? (
                  <p className="text-xs text-slate-400">Cargando...</p>
                ) : sensores[boya.idboya].length === 0 ? (
                  <p className="text-xs text-slate-400">Sin sensores asociados.</p>
                ) : (
                  <div className="space-y-2">
                    {sensores[boya.idboya].map((s) => (
                      <div
                        key={s.idsensor}
                        className="bg-white rounded-lg p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{s.nombresensor}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            {s.nombreunidad} ({s.nomenclatura})
                            <span className="hidden sm:inline">
                              {' · '}Operativo: [{s.rangooperativomin} – {s.rangooperativomax}]
                              {' · '}Riesgo: [{s.umbralriesgomin} – {s.umbralriesgomax}]
                            </span>
                            <span className="sm:hidden block mt-0.5">
                              Op: [{s.rangooperativomin}–{s.rangooperativomax}]
                              {' '}Riesgo: [{s.umbralriesgomin}–{s.umbralriesgomax}]
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              s.estado
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {s.estado ? 'Activo' : 'Inactivo'}
                          </span>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openSensorModal('sensor-edit', boya, s)}
                                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteSensor(boya, s)}
                                className="px-2.5 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal Boya ──────────────────────────────────────────────────────── */}
      {(modal === 'boya-create' || modal === 'boya-edit') && (
        <Modal
          title={modal === 'boya-create' ? 'Nueva boya' : `Editar: ${selectedBoya?.nombre}`}
          onClose={() => setModal(null)}
          onSave={handleSaveBoya}
          saving={saving}
        >
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <input
                value={form.nombre ?? ''}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.estado ?? true}
                onChange={(e) => setForm({ ...form, estado: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Activa</span>
            </label>
          </div>
        </Modal>
      )}

      {/* ── Modal Sensor ─────────────────────────────────────────────────────── */}
      {(modal === 'sensor-create' || modal === 'sensor-edit') && (
        <Modal
          title={
            modal === 'sensor-create'
              ? `Nuevo sensor en "${selectedBoya?.nombre}"`
              : 'Editar sensor'
          }
          onClose={() => setModal(null)}
          onSave={handleSaveSensor}
          saving={saving}
        >
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm whitespace-pre-line">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del sensor</label>
              <input
                value={form.nombresensor ?? ''}
                onChange={(e) => setForm({ ...form, nombresensor: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidad de medida</label>
              <select
                value={String(form.idunidad ?? '')}
                onChange={(e) => setForm({ ...form, idunidad: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {unidades.map((u) => (
                  <option key={u.idunidad} value={String(u.idunidad)}>
                    {u.nombreunidad} ({u.nomenclatura})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">
                Orden: <strong>rango min &lt; umbral min &lt; umbral max &lt; rango max</strong>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumField
                  label="Rango operativo mín"
                  value={form.rangooperativomin}
                  onChange={(v) => setForm({ ...form, rangooperativomin: v })}
                />
                <NumField
                  label="Umbral de riesgo mín"
                  value={form.umbralriesgomin}
                  onChange={(v) => setForm({ ...form, umbralriesgomin: v })}
                />
                <NumField
                  label="Umbral de riesgo máx"
                  value={form.umbralriesgomax}
                  onChange={(v) => setForm({ ...form, umbralriesgomax: v })}
                />
                <NumField
                  label="Rango operativo máx"
                  value={form.rangooperativomax}
                  onChange={(v) => setForm({ ...form, rangooperativomax: v })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.estado ?? true}
                onChange={(e) => setForm({ ...form, estado: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Activo</span>
            </label>
          </div>
        </Modal>
      )}

      {/* ── Modal Unidades ────────────────────────────────────────────────────── */}
      {modal === 'unidades' && (
        <UnidadesModal
          unidades={unidades}
          onClose={() => setModal(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}
