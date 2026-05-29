import { Router } from 'express';
import { login, register } from './auth.controller.js';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/login — público
router.post('/login', login);

// POST /api/auth/register — requiere ser ADMINISTRADOR
router.post('/register', verifyToken, requireRole('ADMINISTRADOR'), register);

export default router;
