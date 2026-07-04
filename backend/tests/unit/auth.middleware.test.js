/**
 * Pruebas unitarias de seguridad — auth.middleware (validación estricta de JWT).
 *
 * Cubre los vectores OWASP de manejo de sesión: token ausente, malformado,
 * firmado con otra clave, expirado, algoritmo "none" y escalada de rol.
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { verifyToken, requireRole } from '../../src/middlewares/auth.middleware.js';

const SECRET = 'clave_de_pruebas_no_productiva';
process.env.JWT_SECRET = SECRET;

// Helpers: simular req/res/next de Express
const mkReq = (authHeader) => ({ headers: authHeader ? { authorization: authHeader } : {} });
const mkNext = () => jest.fn();

const tokenValido = (payload = { sub: 1, correo: 'a@b.c', roles: ['OPERADOR'] }) =>
  jwt.sign(payload, SECRET, { expiresIn: '5m' });

describe('verifyToken — validación estricta del JWT', () => {
  test('rechaza request sin cabecera Authorization', () => {
    const next = mkNext();
    verifyToken(mkReq(null), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('rechaza cabecera sin esquema Bearer', () => {
    const next = mkNext();
    verifyToken(mkReq('Basic dXNlcjpwYXNz'), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('rechaza token firmado con otra clave (secreto robado/incorrecto)', () => {
    const ajeno = jwt.sign({ sub: 1, roles: ['ADMINISTRADOR'] }, 'otra_clave');
    const next = mkNext();
    verifyToken(mkReq(`Bearer ${ajeno}`), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('rechaza token expirado', () => {
    const expirado = jwt.sign({ sub: 1 }, SECRET, { expiresIn: '-1s' });
    const next = mkNext();
    verifyToken(mkReq(`Bearer ${expirado}`), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('rechaza token con algoritmo "none" (bypass clásico de firma)', () => {
    // Un JWT alg:none no lleva firma: header.payload.
    const header  = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 1, roles: ['ADMINISTRADOR'] })).toString('base64url');
    const next = mkNext();
    verifyToken(mkReq(`Bearer ${header}.${payload}.`), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('rechaza token con payload manipulado (firma ya no coincide)', () => {
    const [h, , s] = tokenValido().split('.');
    const payloadAdmin = Buffer.from(
      JSON.stringify({ sub: 1, roles: ['ADMINISTRADOR'] })
    ).toString('base64url');
    const next = mkNext();
    verifyToken(mkReq(`Bearer ${h}.${payloadAdmin}.${s}`), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('acepta token válido y expone req.user', () => {
    const req = mkReq(`Bearer ${tokenValido()}`);
    const next = mkNext();
    verifyToken(req, {}, next);
    expect(next).toHaveBeenCalledWith();       // sin error
    expect(req.user).toMatchObject({ sub: 1, roles: ['OPERADOR'] });
  });
});

describe('requireRole — control de acceso por rol', () => {
  test('bloquea con 403 a un usuario sin el rol requerido', () => {
    const next = mkNext();
    requireRole('ADMINISTRADOR')({ user: { roles: ['OPERADOR'] } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test('bloquea si el token no trae roles (payload forjado incompleto)', () => {
    const next = mkNext();
    requireRole('ADMINISTRADOR')({ user: { sub: 1 } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test('permite el paso con al menos uno de los roles aceptados', () => {
    const next = mkNext();
    requireRole('ADMINISTRADOR', 'OPERADOR')({ user: { roles: ['OPERADOR'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
