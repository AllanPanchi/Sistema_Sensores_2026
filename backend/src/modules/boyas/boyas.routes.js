import { Router } from 'express';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listarBoyas, obtenerBoya, crearBoya, actualizarBoya, eliminarBoya,
  listarSensores, crearSensor, actualizarSensor, eliminarSensor,
  listarUnidades, crearUnidad, eliminarUnidad,
} from './boyas.controller.js';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(verifyToken);

// ── Unidades de medida ─────────────────────────────────────────────────────
// IMPORTANTE: estas rutas deben declararse ANTES de /:id para que Express
// no interprete "unidades" como un parámetro dinámico.
router.get('/unidades',              listarUnidades);
router.post('/unidades',             requireRole('ADMINISTRADOR'), crearUnidad);
router.delete('/unidades/:unidadId', requireRole('ADMINISTRADOR'), eliminarUnidad);

// ── Boyas ──────────────────────────────────────────────────────────────────
router.get('/',     listarBoyas);
router.post('/',    requireRole('ADMINISTRADOR'), crearBoya);
router.get('/:id',  obtenerBoya);
router.put('/:id',  requireRole('ADMINISTRADOR'), actualizarBoya);
router.delete('/:id', requireRole('ADMINISTRADOR'), eliminarBoya);

// ── Sensores (recurso anidado bajo /:id) ───────────────────────────────────
router.get('/:id/sensores',                      listarSensores);
router.post('/:id/sensores',                     requireRole('ADMINISTRADOR'), crearSensor);
router.put('/:id/sensores/:sensorId',            requireRole('ADMINISTRADOR'), actualizarSensor);
router.delete('/:id/sensores/:sensorId',         requireRole('ADMINISTRADOR'), eliminarSensor);

export default router;
