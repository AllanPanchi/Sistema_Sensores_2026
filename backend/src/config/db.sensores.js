import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB_SENSORES,
});

pool.on('error', (err) => {
  console.error('[DB:sensores] Error inesperado en el pool:', err.message);
});

export default pool;
