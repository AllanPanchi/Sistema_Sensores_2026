/**
 * Pruebas de seguridad — payloads maliciosos en archivos CSV.
 *
 * Valida las defensas del pipeline de ingesta: binarios disfrazados,
 * inyección de fórmulas (CSV injection), inyección de nombres de campo
 * hacia InfluxDB (line protocol) y agotamiento de recursos (DoS).
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/modules/boyas/boyas.repository.js', () => ({
  findBoyaById:       jest.fn(),
  findSensoresByBoya: jest.fn(),
}));
jest.unstable_mockModule('../../src/modules/telemetria/telemetria.repository.js', () => ({
  writeTelemetria: jest.fn(),
  queryTelemetria: jest.fn(),
}));

const boyasRepo      = await import('../../src/modules/boyas/boyas.repository.js');
const telemetriaRepo = await import('../../src/modules/telemetria/telemetria.repository.js');
const service        = await import('../../src/modules/telemetria/telemetria.service.js');

const mkFile = (contenido, nombre = 'datos.csv') => ({
  originalname: nombre,
  buffer: Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8'),
});

beforeEach(() => {
  jest.clearAllMocks();
  boyasRepo.findBoyaById.mockResolvedValue({ idboya: 3, nombre: 'Boya Test' });
  boyasRepo.findSensoresByBoya.mockResolvedValue([{ idsensor: 2, nombresensor: 'Ph' }]);
  telemetriaRepo.writeTelemetria.mockImplementation(async (_id, filas) => filas.length);
});

describe('archivos binarios disfrazados de CSV (magic bytes)', () => {
  const casos = [
    ['ejecutable Windows (MZ)',  Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ['ejecutable Linux (ELF)',   Buffer.from([0x7f, 0x45, 0x4c, 0x46])],
    ['ZIP/XLSX renombrado',      Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    ['PDF renombrado',           Buffer.from([0x25, 0x50, 0x44, 0x46])],
    ['documento OLE (xls/doc)',  Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],
  ];

  test.each(casos)('rechaza %s con 400', async (_nombre, firma) => {
    const buf = Buffer.concat([firma, Buffer.from('resto del archivo')]);
    await expect(service.procesarCSV('3', mkFile(buf, 'inocente.csv')))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(telemetriaRepo.writeTelemetria).not.toHaveBeenCalled();
  });

  test('rechaza contenido con bytes nulos (binario corrupto)', async () => {
    const buf = Buffer.from('Fecha;Ph\n11/6/2026 12:20;8\x00,5');
    await expect(service.procesarCSV('3', mkFile(buf)))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('rechaza extensión distinta a .csv aunque el contenido sea texto', async () => {
    await expect(service.procesarCSV('3', mkFile('Fecha;Ph\n11/6/2026 12:20;8', 'script.exe')))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('rechaza archivo vacío', async () => {
    await expect(service.procesarCSV('3', mkFile('')))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('inyección de fórmulas en celdas (CSV injection / OWASP)', () => {
  const payloads = [
    '=HYPERLINK("http://atacante.ec";"click")',
    '=cmd|/C calc!A1',
    '@SUM(1+9)*cmd',
    '+2-1+cmd|/C calc',
    '-2+3+cmd|/C calc',
  ];

  test.each(payloads)('descarta la celda con payload %s', async (payload) => {
    const csv = `Fecha;Ph\n11/6/2026 12:20;${payload}\n11/6/2026 12:21;8,5`;
    const res = await service.procesarCSV('3', mkFile(csv));

    // El payload se rechaza a nivel de fila (si contiene ';', el separador CSV,
    // parte la fila y se descarta entera) o a nivel de valor (si no). En ambos
    // casos jamás llega a InfluxDB.
    expect(res.filas_descartadas + res.valores_descartados).toBeGreaterThanOrEqual(1);
    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    for (const fila of filas) {
      for (const v of Object.values(fila.campos)) {
        expect(typeof v).toBe('number');   // solo números puros, nunca el string del payload
      }
    }
  });
});

describe('inyección de nombres de campo hacia InfluxDB (line protocol)', () => {
  test('los nombres de columna se normalizan a [a-z0-9_] y no casan con sensores', async () => {
    // Intento de inyectar sintaxis de line protocol en el nombre del campo
    const csv = 'Fecha;ph,tag=evil field=1\n11/6/2026 12:20;8,5';
    const res = await service.procesarCSV('3', mkFile(csv)).catch((e) => e);

    // La columna maliciosa se normaliza ("ph_tag_evil_field_1"), no corresponde
    // a ningún sensor registrado y por tanto se rechaza el archivo con 400
    // (ninguna columna casa) — la sintaxis de line protocol nunca llega a InfluxDB.
    expect(res).toMatchObject({ statusCode: 400 });
    expect(telemetriaRepo.writeTelemetria).not.toHaveBeenCalled();
  });
});