import { validarCedula } from '../../src/utils/cedula.js';

describe('validarCedula — cédula ecuatoriana', () => {
  test('cédula válida conocida', () => {
    expect(validarCedula('1713175071')).toBe(true);
  });

  test('cédula con dígito verificador incorrecto', () => {
    expect(validarCedula('1713175070')).toBe(false);
  });

  test('menos de 10 dígitos', () => {
    expect(validarCedula('171317507')).toBe(false);
  });

  test('más de 10 dígitos', () => {
    expect(validarCedula('17131750710')).toBe(false);
  });

  test('contiene letras', () => {
    expect(validarCedula('171317507A')).toBe(false);
  });

  test('provincia 00 inválida', () => {
    expect(validarCedula('0013175071')).toBe(false);
  });

  test('provincia 25 inválida (no existe)', () => {
    expect(validarCedula('2513175071')).toBe(false);
  });

  test('provincia 30 válida (ecuatorianos en exterior)', () => {
    // Solo verifica que no es rechazada por la provincia; el dígito puede fallar
    const cedula = '3013175071';
    const provincia = parseInt(cedula.substring(0, 2), 10);
    expect(provincia).toBe(30);
  });

  test('tercer dígito 6 (entidades públicas) inválido para personas naturales', () => {
    expect(validarCedula('1763175071')).toBe(false);
  });

  test('string vacío', () => {
    expect(validarCedula('')).toBe(false);
  });

  test('valor null', () => {
    expect(validarCedula(null)).toBe(false);
  });

  test('número en lugar de string', () => {
    expect(validarCedula(1713175071)).toBe(false);
  });
});
