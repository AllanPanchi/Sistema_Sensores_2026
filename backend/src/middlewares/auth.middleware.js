import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware.js';

export const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return next(new AppError('Token de acceso requerido', 401));
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    next(new AppError('Token inválido o expirado', 401));
  }
};

// Uso: requireRole('ADMINISTRADOR') o requireRole('ADMINISTRADOR', 'OPERADOR')
export const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.user?.roles ?? [];
  if (!roles.some((r) => userRoles.includes(r))) {
    return next(new AppError('No tienes permisos para esta acción', 403));
  }
  next();
};
