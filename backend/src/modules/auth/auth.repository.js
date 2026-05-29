import pool from '../../config/db.usuarios.js';

// Devuelve el usuario completo incluyendo hash de contraseña y sus roles.
// Solo se debe usar en el servicio de login.
export const findByCorreo = async (correo) => {
  const { rows } = await pool.query(
    `SELECT
       u.usuarioid,
       u.nombre,
       u.apellido,
       u.correo,
       u.cedula,
       u.contrasena,
       COALESCE(
         array_agg(r.nombrerol) FILTER (WHERE r.rolid IS NOT NULL),
         ARRAY[]::text[]
       ) AS roles
     FROM usuario u
     LEFT JOIN rolasignacion ra ON ra.usuarioid = u.usuarioid
     LEFT JOIN rol            r  ON r.rolid     = ra.rolid
     WHERE u.correo = $1
     GROUP BY u.usuarioid`,
    [correo.toLowerCase().trim()]
  );
  return rows[0] ?? null;
};

export const create = async ({ nombre, apellido, correo, cedula, contrasena }) => {
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, apellido, correo, cedula, contrasena)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING usuarioid, nombre, apellido, correo, cedula`,
    [nombre.trim(), apellido.trim(), correo.toLowerCase().trim(), cedula.trim(), contrasena]
  );
  return rows[0];
};

export const findRolByNombre = async (nombreRol) => {
  const { rows } = await pool.query(
    'SELECT rolid FROM rol WHERE nombrerol = $1',
    [nombreRol.toUpperCase().trim()]
  );
  return rows[0] ?? null;
};

export const assignRol = async (usuarioid, rolid) => {
  await pool.query(
    'INSERT INTO rolasignacion (usuarioid, rolid) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [usuarioid, rolid]
  );
};
