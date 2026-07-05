import { AppError } from '../../middlewares/error.middleware.js';
import * as repo from './boyas.repository.js';

const validarUmbrales = ({ umbralriesgomin, umbralriesgomax }) => {
  const uMin = parseFloat(umbralriesgomin);
  const uMax = parseFloat(umbralriesgomax);
  const errors = [];

  if ([uMin, uMax].some(Number.isNaN)) {
    errors.push('Los umbrales deben ser valores numéricos.');
  }

  if (uMin >= uMax) {
    errors.push('umbralriesgomin debe ser menor que umbralriesgomax.');
  }

  if (errors.length) {
    throw new AppError('Umbrales de riesgo inválidos', 400, errors);
  }
};

// ── Boyas ──────────────────────────────────────────────────────────────────

export const listarBoyas = () => repo.findAllBoyas();

export const obtenerBoya = async (id) => {
  const boya = await repo.findBoyaById(id);
  if (!boya) throw new AppError(`Boya con ID ${id} no encontrada`, 404);
  return boya;
};

export const crearBoya = async ({ nombre, estado = true }) => {
  if (!nombre?.trim()) throw new AppError('El nombre de la boya es requerido', 400);
  return repo.createBoya({ nombre, estado });
};

export const actualizarBoya = async (id, { nombre, estado }) => {
  if (!nombre?.trim()) throw new AppError('El nombre de la boya es requerido', 400);
  if (estado === undefined || estado === null) {
    throw new AppError('El estado de la boya es requerido', 400);
  }
  const boya = await repo.updateBoya(id, { nombre, estado });
  if (!boya) throw new AppError(`Boya con ID ${id} no encontrada`, 404);
  return boya;
};

export const eliminarBoya = async (id) => {
  // El FK ON DELETE RESTRICT impide eliminación si hay sensores; lo verificamos
  // antes para devolver un mensaje claro en lugar de un error 500.
  const total = await repo.countSensoresByBoya(id);
  if (total > 0) {
    throw new AppError(
      `No se puede eliminar la boya: tiene ${total} sensor(es) asociado(s). Elimínalos primero.`,
      409
    );
  }
  const eliminada = await repo.deleteBoya(id);
  if (!eliminada) throw new AppError(`Boya con ID ${id} no encontrada`, 404);
  return eliminada;
};

// ── Sensores ───────────────────────────────────────────────────────────────

export const listarSensores = async (idboya) => {
  await obtenerBoya(idboya); // verifica que la boya exista antes de continuar
  return repo.findSensoresByBoya(idboya);
};

export const crearSensor = async (idboya, datos) => {
  await obtenerBoya(idboya);

  const {
    idunidad, nombresensor,
    umbralriesgomin, umbralriesgomax,
    estado = true,
  } = datos;

  if (!idunidad || !nombresensor?.trim()) {
    throw new AppError('idunidad y nombresensor son requeridos', 400);
  }
  if ([umbralriesgomin, umbralriesgomax].some((v) => v === undefined || v === null)) {
    throw new AppError('Los umbrales de riesgo son requeridos', 400);
  }

  validarUmbrales({ umbralriesgomin, umbralriesgomax });

  const unidad = await repo.findUnidadById(idunidad);
  if (!unidad) throw new AppError(`Unidad de medida con ID ${idunidad} no encontrada`, 404);

  return repo.createSensor({
    idboya: parseInt(idboya, 10),
    idunidad, nombresensor,
    umbralriesgomin, umbralriesgomax,
    estado,
  });
};

export const actualizarSensor = async (idboya, sensorId, datos) => {
  await obtenerBoya(idboya);

  const sensor = await repo.findSensorById(sensorId, idboya);
  if (!sensor) throw new AppError(`Sensor con ID ${sensorId} no encontrado en la boya ${idboya}`, 404);

  const {
    idunidad, nombresensor,
    umbralriesgomin, umbralriesgomax,
    estado,
  } = datos;

  if (!idunidad || !nombresensor?.trim()) {
    throw new AppError('idunidad y nombresensor son requeridos', 400);
  }
  if ([umbralriesgomin, umbralriesgomax].some((v) => v === undefined || v === null)) {
    throw new AppError('Los umbrales de riesgo son requeridos', 400);
  }
  if (estado === undefined || estado === null) {
    throw new AppError('El estado del sensor es requerido', 400);
  }

  validarUmbrales({ umbralriesgomin, umbralriesgomax });

  const unidad = await repo.findUnidadById(idunidad);
  if (!unidad) throw new AppError(`Unidad de medida con ID ${idunidad} no encontrada`, 404);

  return repo.updateSensor(sensorId, {
    idunidad, nombresensor,
    umbralriesgomin, umbralriesgomax,
    estado,
  });
};

export const eliminarSensor = async (idboya, sensorId) => {
  await obtenerBoya(idboya);
  const eliminado = await repo.deleteSensor(sensorId);
  if (!eliminado) throw new AppError(`Sensor con ID ${sensorId} no encontrado`, 404);
  return eliminado;
};

// ── Unidades de Medida ─────────────────────────────────────────────────────

export const listarUnidades = () => repo.findAllUnidades();

export const crearUnidad = async ({ nombreunidad, nomenclatura }) => {
  if (!nombreunidad?.trim() || !nomenclatura?.trim()) {
    throw new AppError('nombreunidad y nomenclatura son requeridos', 400);
  }
  return repo.createUnidad({ nombreunidad, nomenclatura });
};

export const eliminarUnidad = async (id) => {
  // El FK ON DELETE RESTRICT lanzará error si hay sensores que usan esta unidad.
  // Lo capturamos aquí para dar un mensaje legible.
  try {
    const eliminada = await repo.deleteUnidad(id);
    if (!eliminada) throw new AppError(`Unidad de medida con ID ${id} no encontrada`, 404);
    return eliminada;
  } catch (err) {
    if (err.code === '23503') {
      throw new AppError(
        'No se puede eliminar la unidad: hay sensores que la están usando.',
        409
      );
    }
    throw err;
  }
};
