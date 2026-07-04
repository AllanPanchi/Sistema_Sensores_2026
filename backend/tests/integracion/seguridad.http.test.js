/**
 * Pruebas de integración de seguridad — capa HTTP contra PostgreSQL real.
 *
 * A diferencia de las unitarias, estas SÍ tocan la base de datos: levantan la
 * app Express con supertest y validan que las queries parametrizadas de `pg`
 * neutralizan la inyección SQL, y que la capa JWT bloquea accesos no autorizados.
 *
 * Requisitos: contenedores arriba (docker compose up -d) y admin sembrado
 * (npm run seed). Ejecutar con:  npm run test:integracion
 */
import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

// Cargar el .env de la raíz ANTES de importar la app (los pools leen env al cargar)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const { default: app } = await import('../../src/app.js');

const ADMIN = {
  correo:   process.env.ADMIN_CORREO   || 'admin@hidrosentinel.ec',
  password: process.env.ADMIN_PASSWORD || 'Admin2026!',
};

let tokenAdmin;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/login').send(ADMIN);
  if (res.status === 200) tokenAdmin = res.body.data.token;
});

describe('Inyección SQL en el login (PostgreSQL parametrizado)', () => {
  const payloads = [
    "' OR '1'='1",
    "admin@hidrosentinel.ec' --",
    "' OR 1=1; DROP TABLE usuario; --",
    "') OR ('1'='1",
  ];

  test.each(payloads)('rechaza el bypass de autenticación con: %s', async (inyeccion) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ correo: inyeccion, password: 'cualquier_cosa' });

    // La query parametrizada trata el payload como texto literal → nunca autentica
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.data?.token).toBeUndefined();
  });

  test('la tabla usuario sigue existiendo tras los intentos de DROP', async () => {
    // Si el DROP hubiera funcionado, el login legítimo daría 500, no 200
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });
});

describe('Inyección SQL en parámetros de ruta', () => {
  test('un :id con payload SQL no numérico NO filtra datos ni autentica', async () => {
    if (!tokenAdmin) return; // sin token no aplica
    const res = await request(app)
      .get(`/api/usuarios/${encodeURIComponent("1 OR 1=1")}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    // Propiedad de seguridad: el payload se trata como valor literal. Postgres
    // falla el casteo a INT4 (por eso 500 hoy; sería 400 con validación previa),
    // pero LO CRÍTICO es que nunca devuelve un dump de usuarios ni un 200.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(200);
    expect(Array.isArray(res.body.data)).toBe(false);
    expect(res.body.success).toBe(false);
  });
});

describe('Validación de JWT en la capa HTTP', () => {
  test('bloquea acceso a ruta protegida sin token (401)', async () => {
    const res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(401);
  });

  test('bloquea token con basura (401)', async () => {
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', 'Bearer esto.no.es.un.jwt');
    expect(res.status).toBe(401);
  });

  test('bloquea token forjado con alg:none (401)', async () => {
    const header  = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 1, roles: ['ADMINISTRADOR'] })).toString('base64url');
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(res.status).toBe(401);
  });

  test('un OPERADOR no puede acceder a rutas de ADMINISTRADOR (403)', async () => {
    if (!tokenAdmin) return;
    // Creamos un token de operador reutilizando el secreto real
    const jwt = (await import('jsonwebtoken')).default;
    const tokenOperador = jwt.sign(
      { sub: 99999, correo: 'op@test.ec', roles: ['OPERADOR'] },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenOperador}`);
    expect(res.status).toBe(403);
  });
});

// Cierra los pools de pg para que Jest no quede colgado
afterAll(async () => {
  const { default: poolUsuarios } = await import('../../src/config/db.usuarios.js');
  const { default: poolSensores } = await import('../../src/config/db.sensores.js');
  await poolUsuarios.end();
  await poolSensores.end();
});
