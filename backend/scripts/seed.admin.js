import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
];

const envPath = envCandidates.find((candidate) => existsSync(candidate));

if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
  console.warn('[Env] No se encontró .env en la raíz ni en backend/.');
}

const { default: pool } = await import('../src/config/db.usuarios.js');

const ADMIN = {
  nombre:   'Admin',
  apellido: 'HidroSentinel',
  correo:   'admin@hidrosentinel.ec',
  cedula:   '0000000001',
  password: 'Admin2026!',
};

const contrasena = await bcrypt.hash(ADMIN.password, 10);

const { rows: [usuario] } = await pool.query(
  `INSERT INTO usuario (nombre, apellido, correo, cedula, contrasena)
   VALUES ($1, $2, $3, $4, $5)
   ON CONFLICT (correo) DO NOTHING
   RETURNING usuarioid`,
  [ADMIN.nombre, ADMIN.apellido, ADMIN.correo, ADMIN.cedula, contrasena]
);

if (!usuario) {
  console.log('El usuario admin ya existe. No se realizaron cambios.');
} else {
  const { rows: [rol] } = await pool.query(
    `SELECT rolid FROM rol WHERE nombrerol = 'ADMINISTRADOR'`
  );
  await pool.query(
    `INSERT INTO rolasignacion (usuarioid, rolid) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [usuario.usuarioid, rol.rolid]
  );
  console.log('✓ Admin creado correctamente.');
  console.log(`  Correo:     ${ADMIN.correo}`);
  console.log(`  Contraseña: ${ADMIN.password}`);
}

await pool.end();
