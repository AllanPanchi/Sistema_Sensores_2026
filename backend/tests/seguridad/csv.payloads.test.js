/**
 * Pruebas de seguridad — payloads maliciosos ocultos en archivos CSV.
 *
 * El módulo de telemetría es el único punto donde entra contenido de archivo
 * subido por el usuario. Aquí se valida que binarios disfrazados, inyección de
 * fórmulas (CSV injection), inyección SQL/Flux y bombas de tamaño se neutralicen
 * antes de tocar InfluxDB. La capa de datos está mockeada.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/modules/boyas/boyas.repository.js', () => ({
  findBoyaById:       jest.fn().mockResolvedValue({ idboya: 3, nombre: 'Boya Test' }),
  findSensoresByBoya: jest.fn().mockResolvedValue([
    { idsensor: 1, nombresensor: 'Temp1' },
    { idsensor: 2, nombresensor: 'Ph' },
  ]),
}));
jest.unstable_mockModule('../../src/modules/telemetria/telemetria.repository.js', () => ({
  writeTelemetria: jest.fn().mockImplementation(async (_id, filas) => filas.length),
  queryTelemetria: jest.fn().mockResolvedValue([]),
}));

const telemetriaRepo = await import('../../src/modules/telemetria/telemetria.repository.js');
const service        = await import('../../src/modules/telemetria/telemetria.service.js');

const mkFile = (bufOrStr, nombre = 'datos.csv') => ({
  originalname: nombre,
  buffer: Buffer.isBuffer(bufOrStr) ? bufOrStr : Buffer.from(bufOrStr, 'utf8'),
});

beforeEach(() => jest.clearAllMocks());

describe('Rechazo de binarios disfrazados de .csv (magic bytes)', () => {
  test.each([
    ['ejecutable Windows MZ', Buffer.from([0x4d, 0x5a, 0x90, 0x00])],
    ['ejecutable Linux ELF',  Buffer.from([0x7f, 0x45, 0x4c, 0x46])],
    ['ZIP / XLSX',            Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    ['PDF',                   Buffer.from([0x25, 0x50, 0x44, 0x46])],
  ])('rechaza %s con 400', async (_desc, magic) => {
    const buf = Buffer.concat([magic, Buffer.from('contenido')]);
    await expect(service.procesarCSV('3', mkFile(buf)))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(telemetriaRepo.writeTelemetria).not.toHaveBeenCalled();
  });

  test('rechaza contenido con bytes nulos (binario/corrupto)', async () => {
    const buf = Buffer.from('Fecha;Ph\n11/6/2026 12:20;8\x00\x00', 'binary');
    await expect(service.procesarCSV('3', mkFile(buf)))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('CSV injection — fórmulas de hoja de cálculo', () => {
  // Un atacante inyecta =cmd|... o @SUM(...) esperando ejecución al abrir el CSV
  // en Excel/LibreOffice. El parser numérico estricto debe descartar esos valores.
  test.each(['=cmd|calc', '@SUM(1+1)', '+1234', '-2+3', '=HYPERLINK("http://x")'])(
    'descarta la celda con fórmula %s sin escribir el string',
    async (formula) => {
      const csv = `Fecha;Ph\n11/6/2026 12:20;${formula}`;
      // Ph es la única columna con dato → todo se descarta → 400
      await expect(service.procesarCSV('3', mkFile(csv)))
        .rejects.toMatchObject({ statusCode: 400 });
    }
  );

  test('una fila mixta conserva solo el número, descarta la fórmula', async () => {
    const csv = 'Fecha;Temp1;Ph\n11/6/2026 12:20;=cmd|calc;8,5';
    const res = await service.procesarCSV('3', mkFile(csv));
    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    expect(filas[0].campos).toEqual({ ph: 8.5 }); // fórmula fuera
    expect(res.valores_descartados).toBe(1);
  });
});

describe('Inyección SQL / Flux embebida en celdas y cabeceras', () => {
  test('un string de inyección SQL en una celda numérica se descarta', async () => {
    const csv = "Fecha;Ph\n11/6/2026 12:20;1; DROP TABLE usuarios;--";
    // La fila tiene columnas de más → se descarta entera → 400
    await expect(service.procesarCSV('3', mkFile(csv)))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('inyección Flux en el nombre de columna se neutraliza al normalizar', async () => {
    // Columna válida (Ph) + columna con payload Flux. El nombre malicioso se
    // normaliza a [a-z0-9_], no casa con ningún sensor, y se reporta saneado.
    const csv = 'Fecha;Ph;evil") |> yield(malicioso\n11/6/2026 12:20;8,5;42';
    const res = await service.procesarCSV('3', mkFile(csv));

    // Ph sí se ingesta; la columna inyectada queda fuera
    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    expect(filas[0].campos).toEqual({ ph: 8.5 });

    // Ningún nombre reportado contiene caracteres de inyección Flux (comillas, |>, paréntesis)
    expect(res.columnas_sin_sensor.length).toBeGreaterThan(0);
    expect(res.columnas_sin_sensor.every((c) => /^[a-z0-9_]*$/.test(c))).toBe(true);
  });
});

describe('Bomba de tamaño / DoS', () => {
  test('rechaza un CSV que excede el máximo de filas', async () => {
    const cabecera = 'Fecha;Ph';
    const fila = '11/6/2026 12:20;8,5';
    const bomba = [cabecera, ...Array(100_001).fill(fila)].join('\n');
    await expect(service.procesarCSV('3', mkFile(bomba)))
      .rejects.toMatchObject({ statusCode: 413 });
    expect(telemetriaRepo.writeTelemetria).not.toHaveBeenCalled();
  });
});
