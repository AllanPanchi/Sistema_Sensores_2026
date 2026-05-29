// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Error interno del servidor';

  console.error(`[Error] ${req.method} ${req.path} -> ${statusCode}: ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    timestamp: new Date().toISOString(),
  });
};

// Helper para lanzar errores HTTP controlados desde cualquier capa
export class AppError extends Error {
  constructor(message, statusCode = 400, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors     = errors;
  }
}
