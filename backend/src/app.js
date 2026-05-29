import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/error.middleware.js';

// --- Rutas de módulos ---
import authRoutes       from './modules/auth/auth.routes.js';
import usuariosRoutes   from './modules/usuarios/usuarios.routes.js';
import boyasRoutes      from './modules/boyas/boyas.routes.js';
import telemetriaRoutes from './modules/telemetria/telemetria.routes.js';

const app = express();

// ── Seguridad ──────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// ── Parseo de cuerpo ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));     // JSON bodies + CSVs medianos
app.use(express.urlencoded({ extended: true }));

// ── Health check (público, sin auth) ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HidroSentinel API operativa',
    data: { version: '1.0.0', env: process.env.NODE_ENV || 'development' },
    timestamp: new Date().toISOString(),
  });
});

// ── Rutas de dominio ───────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/usuarios',   usuariosRoutes);
app.use('/api/boyas',      boyasRoutes);
app.use('/api/telemetria', telemetriaRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.path} no encontrada`,
    errors: [],
    timestamp: new Date().toISOString(),
  });
});

// ── Error handler global (debe ser el último middleware) ───────────────────
app.use(errorHandler);

export default app;
