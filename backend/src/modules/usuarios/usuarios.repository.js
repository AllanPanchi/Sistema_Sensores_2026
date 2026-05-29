import pool from '../../config/db.usuarios.js';

// ── Fragmento SQL reutilizable: usuario con roles, sin contraseña ──────────
const SELECT_USUARIO_CON_ROLES = `
  SELECT
    u.usuarioid,
    u.nombre,
    u.apellido,
    u.correo,
    u.cedula,
    COALESCE(
      array_agg(r.nombrerol) FILTER (WHERE r.rolid IS NOT NULL),
      ARRAY[]::text[]
    ) AS roles
  FROM usuario u
  LEFT JOIN rolasignacion ra ON ra.usuarioid = u.usuarioid
  LEFT JOIN rol            r  ON r.rolid     = ra.rolid
`;

export const findAll = async () => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO_CON_ROLES}
     GROUP BY u.usuarioid
     ORDER BY u.usuarioid`
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    `${SELECT_USUARIO_CON_ROLES}
     WHERE u.usuarioid = $1
     GROUP BY u.usuarioid`,
    [id]
  );
  return rows[0] ?? null;
};

// Solo para verificación de contraseña (cambio de password propio)
export const findByIdWithPassword = async (id) => {
  const { rows } = await pool.query(
    `SELECT usuarioid, nombre, apellido, correo, cedula, contrasena
     FROM usuario
     WHERE usuarioid = $1`,
    [id]
  );
  return rows[0] ?? null;
};

// Actualiza solo los campos de perfil no sensibles (correo NO es editable:
// está en el payload del JWT y cambiar lo invalidaría tokens activos)
export const update = async (id, { nombre, apellido, cedula }) => {
  const { rows } = await pool.query(
    `UPDATE usuario
     SET nombre = $1, apellido = $2, cedula = $3
     WHERE usuarioid = $4
     RETURNING usuarioid, nombre, apellido, correo, cedula`,
    [nombre.trim(), apellido.trim(), cedula.trim(), id]
  );
  return rows[0] ?? null;
};

export const updatePassword = async (id, contrasena) => {
  await pool.query(
    `UPDATE usuario SET contrasena = $1 WHERE usuarioid = $2`,
    [contrasena, id]
  );
};

export const deleteById = async (id) => {
  // ROLASIGNACION se elimina en cascada por FK ON DELETE CASCADE
  const { rows } = await pool.query(
    `DELETE FROM usuario WHERE usuarioid = $1 RETURNING usuarioid`,
    [id]
  );
  return rows[0] ?? null;
};

// ── Roles ──────────────────────────────────────────────────────────────────

export const findAllRoles = async () => {
  const { rows } = await pool.query(
    `SELECT rolid, nombrerol FROM rol ORDER BY rolid`
  );
  return rows;
};

// Recibe un array de nombres y devuelve los registros encontrados.
// Si un nombre no existe, simplemente no aparece en el resultado.
export const findRolesByNombres = async (nombres) => {
  const { rows } = await pool.query(
    `SELECT rolid, nombrerol FROM rol WHERE nombrerol = ANY($1::text[])`,
    [nombres.map((n) => n.toUpperCase().trim())]
  );
  return rows;
};

// Reemplaza TODOS los roles de un usuario dentro de una transacción atómica
export const replaceRoles = async (usuarioid, roleIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM rolasignacion WHERE usuarioid = $1`,
      [usuarioid]
    );
    for (const rolid of roleIds) {
      await client.query(
        `INSERT INTO rolasignacion (usuarioid, rolid) VALUES ($1, $2)`,
        [usuarioid, rolid]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
