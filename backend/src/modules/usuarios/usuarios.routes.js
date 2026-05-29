import { Router } from 'express';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';
import {
  listarUsuarios,
  listarRoles,
  obtenerPerfil,
  obtenerUsuario,
  actualizarUsuario,
  cambiarPassword,
  actualizarRoles,
  eliminarUsuario,
} from './usuarios.controller.js';

const router = Router();

// Todos los endpoints requieren autenticación
router.use(verifyToken);

// ── Rutas estáticas primero (ANTES de /:id para evitar colisiones) ─────────
router.get('/perfil', obtenerPerfil);
router.get('/roles',  requireRole('ADMINISTRADOR'), listarRoles);

// ── CRUD de usuarios (solo ADMINISTRADOR) ─────────────────────────────────
router.get('/',     requireRole('ADMINISTRADOR'), listarUsuarios);
router.get('/:id',  requireRole('ADMINISTRADOR'), obtenerUsuario);
router.put('/:id',  requireRole('ADMINISTRADOR'), actualizarUsuario);
router.delete('/:id', requireRole('ADMINISTRADOR'), eliminarUsuario);

// ── Sub-recursos de usuario ────────────────────────────────────────────────
// Cambio de password: accesible por el propio usuario O por un ADMINISTRADOR.
// La autorización granular la resuelve el servicio comparando req.user.sub con :id.
router.put('/:id/password', cambiarPassword);

// Reemplazo de roles: solo ADMINISTRADOR
router.put('/:id/roles', requireRole('ADMINISTRADOR'), actualizarRoles);

export default router;
