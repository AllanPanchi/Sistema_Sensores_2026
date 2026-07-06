import pool from '../../config/db.sensores.js';

// ── Boyas ──────────────────────────────────────────────────────────────────

export const findAllBoyas = async () => {
  const { rows } = await pool.query(
    `SELECT
       b.idboya,
       b.nombre,
       b.estado,
       COUNT(s.idsensor)                                 AS total_sensores,
       COUNT(s.idsensor) FILTER (WHERE s.estado = true)  AS sensores_activos
     FROM boya b
     LEFT JOIN sensor s ON s.idboya = b.idboya
     GROUP BY b.idboya
     ORDER BY b.idboya`
  );
  return rows;
};

export const findBoyaById = async (id) => {
  const { rows } = await pool.query(
    `SELECT
       b.idboya,
       b.nombre,
       b.estado,
       COALESCE(
         json_agg(
           json_build_object(
             'idsensor',          s.idsensor,
             'nombresensor',      s.nombresensor,
             'idunidad',          s.idunidad,
             'unidad',            u.nombreunidad,
             'nomenclatura',      u.nomenclatura,
             'umbralriesgomin',   s.umbralriesgomin,
             'umbralriesgomax',   s.umbralriesgomax,
             'estado',            s.estado
           ) ORDER BY s.idsensor
         ) FILTER (WHERE s.idsensor IS NOT NULL),
         '[]'::json
       ) AS sensores
     FROM boya b
     LEFT JOIN sensor         s ON s.idboya   = b.idboya
     LEFT JOIN unidadesmedida u ON u.idunidad  = s.idunidad
     WHERE b.idboya = $1
     GROUP BY b.idboya`,
    [id]
  );
  return rows[0] ?? null;
};

export const createBoya = async ({ nombre, estado }) => {
  const { rows } = await pool.query(
    `INSERT INTO boya (nombre, estado) VALUES ($1, $2) RETURNING *`,
    [nombre.trim(), estado]
  );
  return rows[0];
};

export const updateBoya = async (id, { nombre, estado }) => {
  const { rows } = await pool.query(
    `UPDATE boya SET nombre = $1, estado = $2
     WHERE idboya = $3
     RETURNING *`,
    [nombre.trim(), estado, id]
  );
  return rows[0] ?? null;
};

export const deleteBoya = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM boya WHERE idboya = $1 RETURNING idboya`,
    [id]
  );
  return rows[0] ?? null;
};

export const countSensoresByBoya = async (idboya) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total FROM sensor WHERE idboya = $1`,
    [idboya]
  );
  return parseInt(rows[0].total, 10);
};

// ── Sensores ───────────────────────────────────────────────────────────────

export const findSensoresByBoya = async (idboya) => {
  const { rows } = await pool.query(
    `SELECT
       s.idsensor,
       s.nombresensor,
       s.idunidad,
       u.nombreunidad,
       u.nomenclatura,
       s.umbralriesgomin,
       s.umbralriesgomax,
       s.estado,
       COALESCE(
         (SELECT json_agg(
            json_build_object(
              'idindicador', i.idindicador,
              'etiqueta',    i.etiqueta,
              'valormin',    i.valormin,
              'valormax',    i.valormax,
              'color',       i.color
            ) ORDER BY i.valormin
          ) FROM indicador i WHERE i.idsensor = s.idsensor),
         '[]'::json
       ) AS indicadores
     FROM sensor s
     LEFT JOIN unidadesmedida u ON u.idunidad = s.idunidad
     WHERE s.idboya = $1
     ORDER BY s.idsensor`,
    [idboya]
  );
  return rows;
};

export const findSensorById = async (idsensor, idboya) => {
  const { rows } = await pool.query(
    `SELECT
       s.idsensor,
       s.nombresensor,
       s.idunidad,
       u.nombreunidad,
       u.nomenclatura,
       s.umbralriesgomin,
       s.umbralriesgomax,
       s.estado
     FROM sensor s
     LEFT JOIN unidadesmedida u ON u.idunidad = s.idunidad
     WHERE s.idsensor = $1 AND s.idboya = $2`,
    [idsensor, idboya]
  );
  return rows[0] ?? null;
};

export const createSensor = async ({
  idboya, idunidad, nombresensor,
  umbralriesgomin, umbralriesgomax,
  estado,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO sensor
       (idboya, idunidad, nombresensor,
        umbralriesgomin, umbralriesgomax, estado)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [idboya, idunidad, nombresensor.trim(),
     umbralriesgomin, umbralriesgomax, estado]
  );
  return rows[0];
};

export const updateSensor = async (idsensor, {
  idunidad, nombresensor,
  umbralriesgomin, umbralriesgomax,
  estado,
}) => {
  const { rows } = await pool.query(
    `UPDATE sensor SET
       idunidad        = $1,
       nombresensor    = $2,
       umbralriesgomin = $3,
       umbralriesgomax = $4,
       estado          = $5
     WHERE idsensor = $6
     RETURNING *`,
    [idunidad, nombresensor.trim(),
     umbralriesgomin, umbralriesgomax,
     estado, idsensor]
  );
  return rows[0] ?? null;
};

export const deleteSensor = async (idsensor) => {
  const { rows } = await pool.query(
    `DELETE FROM sensor WHERE idsensor = $1 RETURNING idsensor`,
    [idsensor]
  );
  return rows[0] ?? null;
};

// ── Unidades de Medida ─────────────────────────────────────────────────────

export const findAllUnidades = async () => {
  const { rows } = await pool.query(
    `SELECT idunidad, nombreunidad, nomenclatura
     FROM unidadesmedida
     ORDER BY idunidad`
  );
  return rows;
};

export const findUnidadById = async (id) => {
  const { rows } = await pool.query(
    `SELECT idunidad, nombreunidad, nomenclatura
     FROM unidadesmedida
     WHERE idunidad = $1`,
    [id]
  );
  return rows[0] ?? null;
};

export const createUnidad = async ({ nombreunidad, nomenclatura }) => {
  const { rows } = await pool.query(
    `INSERT INTO unidadesmedida (nombreunidad, nomenclatura)
     VALUES ($1, $2)
     RETURNING *`,
    [nombreunidad.trim(), nomenclatura.trim()]
  );
  return rows[0];
};

export const deleteUnidad = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM unidadesmedida WHERE idunidad = $1 RETURNING idunidad`,
    [id]
  );
  return rows[0] ?? null;
};

// ── Indicadores (niveles cualitativos por sensor) ──────────────────────────

export const findIndicadoresBySensor = async (idsensor) => {
  const { rows } = await pool.query(
    `SELECT idindicador, idsensor, etiqueta, valormin, valormax, color
     FROM indicador
     WHERE idsensor = $1
     ORDER BY valormin`,
    [idsensor]
  );
  return rows;
};

export const createIndicador = async ({ idsensor, etiqueta, valormin, valormax, color }) => {
  const { rows } = await pool.query(
    `INSERT INTO indicador (idsensor, etiqueta, valormin, valormax, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [idsensor, etiqueta.trim(), valormin, valormax, color.trim()]
  );
  return rows[0];
};

export const deleteIndicador = async (idindicador, idsensor) => {
  const { rows } = await pool.query(
    `DELETE FROM indicador WHERE idindicador = $1 AND idsensor = $2 RETURNING idindicador`,
    [idindicador, idsensor]
  );
  return rows[0] ?? null;
};
