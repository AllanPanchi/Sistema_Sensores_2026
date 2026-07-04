import { ok } from '../../utils/response.js';
import * as telemetriaService from './telemetria.service.js';

export const subirCSV = async (req, res, next) => {
  try {
    const data = await telemetriaService.procesarCSV(req.params.idboya, req.file);
    ok(res, 'CSV procesado exitosamente', data, 201);
  } catch (err) { next(err); }
};

export const consultarTelemetria = async (req, res, next) => {
  try {
    const data = await telemetriaService.consultarTelemetria(req.params.idboya, req.query);
    ok(res, 'Telemetría obtenida exitosamente', data);
  } catch (err) { next(err); }
};

export const listarAlertas = async (req, res, next) => {
  try {
    const data = await telemetriaService.evaluarAlertas();
    ok(res, 'Alertas evaluadas exitosamente', data);
  } catch (err) { next(err); }
};
