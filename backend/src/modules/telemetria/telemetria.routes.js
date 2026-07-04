import { Router } from 'express';
import multer from 'multer';
import { verifyToken, requireRole } from '../../middlewares/auth.middleware.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { subirCSV, consultarTelemetria } from './telemetria.controller.js';

const router = Router();

// ── Multer: subida segura de CSV ───────────────────────────────────────────
// memoryStorage: el archivo nunca toca el disco del servidor — se valida y
// procesa en RAM, eliminando riesgos de path traversal o archivos residuales.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB máximo
    files: 1,                   // un solo archivo por request
  },
  fileFilter: (req, file, cb) => {
    // Primera barrera: extensión y MIME type declarado.
    // (El contenido real se verifica en el servicio con magic bytes.)
    const nombreOk = file.originalname?.toLowerCase().endsWith('.csv');
    const MIMES_PERMITIDOS = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!nombreOk) {
      return cb(new AppError('Solo se permiten archivos .csv', 400));
    }
    if (!MIMES_PERMITIDOS.includes(file.mimetype)) {
      return cb(new AppError(`Tipo de archivo no permitido: ${file.mimetype}`, 400));
    }
    cb(null, true);
  },
});

// Wrapper: convierte los errores propios de multer (tamaño, conteo) en AppError
// para que el errorHandler global los serialice con el contrato estándar.
const uploadCSV = (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo excede el tamaño máximo de 10 MB'
        : `Error en la subida del archivo: ${err.code}`;
      return next(new AppError(msg, 400));
    }
    next(err); // AppError del fileFilter u otro error
  });
};

// Todos los endpoints requieren autenticación
router.use(verifyToken);

// POST /api/telemetria/:idboya — ingesta de CSV (multipart, campo "archivo")
router.post('/:idboya', requireRole('ADMINISTRADOR', 'OPERADOR'), uploadCSV, subirCSV);

// GET /api/telemetria/:idboya?horas=24&limite=500 — últimas mediciones
router.get('/:idboya', consultarTelemetria);

export default router;
