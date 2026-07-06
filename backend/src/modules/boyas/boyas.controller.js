import { ok } from '../../utils/response.js';
import * as boyasService from './boyas.service.js';

// ── Boyas ──────────────────────────────────────────────────────────────────

export const listarBoyas = async (req, res, next) => {
  try {
    const data = await boyasService.listarBoyas();
    ok(res, 'Boyas obtenidas exitosamente', data);
  } catch (err) { next(err); }
};

export const obtenerBoya = async (req, res, next) => {
  try {
    const data = await boyasService.obtenerBoya(req.params.id);
    ok(res, 'Boya obtenida exitosamente', data);
  } catch (err) { next(err); }
};

export const crearBoya = async (req, res, next) => {
  try {
    const data = await boyasService.crearBoya(req.body);
    ok(res, 'Boya creada exitosamente', data, 201);
  } catch (err) { next(err); }
};

export const actualizarBoya = async (req, res, next) => {
  try {
    const data = await boyasService.actualizarBoya(req.params.id, req.body);
    ok(res, 'Boya actualizada exitosamente', data);
  } catch (err) { next(err); }
};

export const eliminarBoya = async (req, res, next) => {
  try {
    await boyasService.eliminarBoya(req.params.id);
    ok(res, 'Boya eliminada exitosamente');
  } catch (err) { next(err); }
};

// ── Sensores ───────────────────────────────────────────────────────────────

export const listarSensores = async (req, res, next) => {
  try {
    const data = await boyasService.listarSensores(req.params.id);
    ok(res, 'Sensores obtenidos exitosamente', data);
  } catch (err) { next(err); }
};

export const crearSensor = async (req, res, next) => {
  try {
    const data = await boyasService.crearSensor(req.params.id, req.body);
    ok(res, 'Sensor creado exitosamente', data, 201);
  } catch (err) { next(err); }
};

export const actualizarSensor = async (req, res, next) => {
  try {
    const data = await boyasService.actualizarSensor(req.params.id, req.params.sensorId, req.body);
    ok(res, 'Sensor actualizado exitosamente', data);
  } catch (err) { next(err); }
};

export const eliminarSensor = async (req, res, next) => {
  try {
    await boyasService.eliminarSensor(req.params.id, req.params.sensorId);
    ok(res, 'Sensor eliminado exitosamente');
  } catch (err) { next(err); }
};

// ── Unidades de Medida ─────────────────────────────────────────────────────

export const listarUnidades = async (req, res, next) => {
  try {
    const data = await boyasService.listarUnidades();
    ok(res, 'Unidades de medida obtenidas exitosamente', data);
  } catch (err) { next(err); }
};

export const crearUnidad = async (req, res, next) => {
  try {
    const data = await boyasService.crearUnidad(req.body);
    ok(res, 'Unidad de medida creada exitosamente', data, 201);
  } catch (err) { next(err); }
};

export const eliminarUnidad = async (req, res, next) => {
  try {
    await boyasService.eliminarUnidad(req.params.unidadId);
    ok(res, 'Unidad de medida eliminada exitosamente');
  } catch (err) { next(err); }
};

// ── Indicadores (niveles cualitativos por sensor) ──────────────────────────

export const listarIndicadores = async (req, res, next) => {
  try {
    const data = await boyasService.listarIndicadores(req.params.id, req.params.sensorId);
    ok(res, 'Indicadores obtenidos exitosamente', data);
  } catch (err) { next(err); }
};

export const crearIndicador = async (req, res, next) => {
  try {
    const data = await boyasService.crearIndicador(req.params.id, req.params.sensorId, req.body);
    ok(res, 'Indicador creado exitosamente', data, 201);
  } catch (err) { next(err); }
};

export const eliminarIndicador = async (req, res, next) => {
  try {
    await boyasService.eliminarIndicador(req.params.id, req.params.sensorId, req.params.indicadorId);
    ok(res, 'Indicador eliminado exitosamente');
  } catch (err) { next(err); }
};
