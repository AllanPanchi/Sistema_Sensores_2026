/**
 * Pruebas unitarias — telemetria.service (procesamiento CSV + estadísticas).
 *
 * La capa de Repositories se mockea por completo (jest.unstable_mockModule,
 * requerido en ESM): ninguna prueba toca PostgreSQL ni InfluxDB.
 */
import { jest } from '@jest/globals';

// ── Mock estricto de la capa de datos ──────────────────────────────────────
jest.unstable_mockModule('../../src/modules/boyas/boyas.repository.js', () => ({
  findBoyaById:       jest.fn(),
  findSensoresByBoya: jest.fn(),
  findAllBoyas:       jest.fn(),
}));
jest.unstable_mockModule('../../src/modules/telemetria/telemetria.repository.js', () => ({
  writeTelemetria:    jest.fn(),
  queryTelemetria:    jest.fn(),
  queryUltimosValores: jest.fn(),
}));

// Con ESM, los mocks deben declararse ANTES del import dinámico del servicio
const boyasRepo      = await import('../../src/modules/boyas/boyas.repository.js');
const telemetriaRepo = await import('../../src/modules/telemetria/telemetria.repository.js');
const service        = await import('../../src/modules/telemetria/telemetria.service.js');

// ── Fixtures ────────────────────────────────────────────────────────────────
const BOYA = { idboya: 3, nombre: 'Boya Test' };
const SENSORES = [
  { idsensor: 1, nombresensor: 'Temp1' },
  { idsensor: 2, nombresensor: 'Ph' },
  { idsensor: 3, nombresensor: 'Nivel (m)' },
];

// Simula el objeto file que produce multer con memoryStorage
const mkFile = (contenido, nombre = 'datos.csv') => ({
  originalname: nombre,
  buffer: Buffer.from(contenido, 'utf8'),
});

beforeEach(() => {
  jest.clearAllMocks();
  boyasRepo.findBoyaById.mockResolvedValue(BOYA);
  boyasRepo.findSensoresByBoya.mockResolvedValue(SENSORES);
  telemetriaRepo.writeTelemetria.mockImplementation(async (_id, filas) => filas.length);
});

// ── Procesamiento de CSV válido ─────────────────────────────────────────────
describe('procesarCSV — camino feliz', () => {
  test('ingesta un CSV válido y escribe en el repositorio', async () => {
    const csv = [
      'Fecha;Temp1;Ph',
      '11/6/2026 12:20;23,1;8,59',
      '11/6/2026 12:21;23,2;8,58',
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));

    expect(res.filas_validas).toBe(2);
    expect(res.puntos_escritos).toBe(2);
    expect(res.filas_descartadas).toBe(0);
    expect(telemetriaRepo.writeTelemetria).toHaveBeenCalledWith(3, expect.any(Array));
  });

  test('convierte coma decimal y fecha d/m/yyyy correctamente', async () => {
    const csv = 'Fecha;Ph\n11/6/2026 12:20;8,59';
    await service.procesarCSV('3', mkFile(csv));

    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    expect(filas[0].campos.ph).toBe(8.59);
    expect(filas[0].ts).toEqual(new Date(2026, 5, 11, 12, 20));
  });

  test('desplaza +1ms los timestamps duplicados para no sobrescribir en InfluxDB', async () => {
    const csv = [
      'Fecha;Ph',
      '11/6/2026 12:20;8,50',
      '11/6/2026 12:20;8,51',
      '11/6/2026 12:20;8,52',
    ].join('\n');

    await service.procesarCSV('3', mkFile(csv));

    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    const tiempos = filas.map((f) => f.ts.getTime());
    expect(new Set(tiempos).size).toBe(3);        // todos distintos
    expect(tiempos[1]).toBe(tiempos[0] + 1);      // +1ms incremental
    expect(tiempos[2]).toBe(tiempos[0] + 2);
  });
});

// ── Cálculo estadístico: media, mediana y moda ──────────────────────────────
describe('procesarCSV — estadísticas', () => {
  test('calcula media, mediana y moda con valores conocidos', async () => {
    // Ph: [6, 7, 7, 12] → media 8, mediana 7, moda 7
    const csv = [
      'Fecha;Ph',
      '11/6/2026 12:20;6',
      '11/6/2026 12:21;7',
      '11/6/2026 12:22;7',
      '11/6/2026 12:23;12',
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));

    expect(res.estadisticas.ph).toEqual({
      media: 8, mediana: 7, moda: 7, muestras: 4,
    });
  });

  test('mediana con número impar de muestras', async () => {
    // [6, 8, 13] → mediana 8
    const csv = [
      'Fecha;Ph',
      '11/6/2026 12:20;6',
      '11/6/2026 12:21;13',
      '11/6/2026 12:22;8',
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));
    expect(res.estadisticas.ph.mediana).toBe(8);
  });

  test('las estadísticas excluyen los valores basura descartados', async () => {
    const csv = [
      'Fecha;Ph',
      '11/6/2026 12:20;7',
      '11/6/2026 12:21;99,9',   // fuera de rango físico (pH 0–14)
      '11/6/2026 12:22;9',
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));
    expect(res.estadisticas.ph.muestras).toBe(2);
    expect(res.estadisticas.ph.media).toBe(8);
    expect(res.valores_descartados).toBe(1);
  });
});

// ── Limpieza de datos basura ────────────────────────────────────────────────
describe('procesarCSV — limpieza', () => {
  test('descarta filas con fecha inválida o columnas incompletas', async () => {
    const csv = [
      'Fecha;Temp1;Ph',
      '11/6/2026 12:20;23,1;8,59',   // válida
      'FECHA_ROTA;23,1;8,59',        // fecha inválida → fila fuera
      '11/6/2026 12:21;23,1',        // faltan columnas → fila fuera
      '99/99/2026 12:22;23,1;8,59',  // fecha imposible → fila fuera
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));
    expect(res.filas_validas).toBe(1);
    expect(res.filas_descartadas).toBe(3);
  });

  test('una celda corrupta descarta el valor, no la fila entera', async () => {
    const csv = [
      'Fecha;Temp1;Ph',
      '11/6/2026 12:20;ERROR;8,59',  // Temp1 basura, Ph válido
    ].join('\n');

    const res = await service.procesarCSV('3', mkFile(csv));
    expect(res.filas_validas).toBe(1);
    expect(res.valores_descartados).toBe(1);

    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    expect(filas[0].campos).toEqual({ ph: 8.59 }); // temp1 no se ingesta
  });

  test('rechaza el archivo si tras la limpieza no queda ningún dato', async () => {
    const csv = 'Fecha;Ph\nBASURA;NO_NUMERICO';
    await expect(service.procesarCSV('3', mkFile(csv)))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Coherencia boya ↔ sensores ──────────────────────────────────────────────
describe('procesarCSV — coherencia con sensores registrados', () => {
  test('rechaza con 404 si la boya no existe', async () => {
    boyasRepo.findBoyaById.mockResolvedValue(null);
    await expect(service.procesarCSV('99', mkFile('Fecha;Ph\n11/6/2026 12:20;8')))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('rechaza con 409 si la boya no tiene sensores registrados', async () => {
    boyasRepo.findSensoresByBoya.mockResolvedValue([]);
    await expect(service.procesarCSV('3', mkFile('Fecha;Ph\n11/6/2026 12:20;8')))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('ignora y reporta columnas sin sensor registrado', async () => {
    const csv = 'Fecha;Ph;Sensor Fantasma\n11/6/2026 12:20;8,5;42';
    const res = await service.procesarCSV('3', mkFile(csv));

    expect(res.columnas_sin_sensor).toEqual(['sensor_fantasma']);
    const [, filas] = telemetriaRepo.writeTelemetria.mock.calls[0];
    expect(filas[0].campos).toEqual({ ph: 8.5 });
  });

  test('rechaza con 400 si ninguna columna corresponde a un sensor', async () => {
    const csv = 'Fecha;Desconocido\n11/6/2026 12:20;1';
    await expect(service.procesarCSV('3', mkFile(csv)))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── Consulta: sanitización de parámetros hacia Flux ─────────────────────────
describe('consultarTelemetria — sanitización de parámetros', () => {
  beforeEach(() => telemetriaRepo.queryTelemetria.mockResolvedValue([]));

  test('acota horas y limite a enteros dentro de rango', async () => {
    await service.consultarTelemetria('3', { horas: '99999', limite: '-5' });
    expect(telemetriaRepo.queryTelemetria).toHaveBeenCalledWith(3, 720, 1);
  });

  test('texto no numérico cae a los valores por defecto', async () => {
    await service.consultarTelemetria('3', { horas: 'abc; drop()', limite: 'x' });
    expect(telemetriaRepo.queryTelemetria).toHaveBeenCalledWith(3, 24, 500);
  });

  test('ID de boya no numérico se rechaza con 400 (nunca llega a Flux)', async () => {
    await expect(service.consultarTelemetria('abc") or true', {}))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(telemetriaRepo.queryTelemetria).not.toHaveBeenCalled();
  });

  test('una inyección con dígito inicial se sanea a entero: Flux recibe el número, nunca el string', async () => {
    // parseInt('3") or true') === 3 → el resto de la cadena se descarta
    await service.consultarTelemetria('3") or true', {});
    expect(telemetriaRepo.queryTelemetria).toHaveBeenCalledWith(3, 24, 500);
    // el argumento es un Number, no el string malicioso
    expect(typeof telemetriaRepo.queryTelemetria.mock.calls[0][0]).toBe('number');
  });
});

// ── Evaluación de alertas: clasificación por rangos y umbrales ──────────────
describe('evaluarAlertas — clasificación de lecturas', () => {
  // Sensor de pH con la invariante rangoMin < umbralMin < umbralMax < rangoMax
  const SENSOR_PH = {
    idsensor: 2, nombresensor: 'Ph', nomenclatura: 'pH',
    rangooperativomin: '0', umbralriesgomin: '6.5',
    umbralriesgomax: '9', rangooperativomax: '14',
  };

  // Configura una sola boya con un sensor y su último valor
  const escenario = (sensor, ultimoValor) => {
    boyasRepo.findAllBoyas.mockResolvedValue([{ idboya: 3, nombre: 'Boya Test' }]);
    boyasRepo.findSensoresByBoya.mockResolvedValue([sensor]);
    telemetriaRepo.queryUltimosValores.mockResolvedValue([
      { campo: 'ph', valor: ultimoValor, fecha: '2026-06-11T13:00:00Z' },
    ]);
  };

  test('valor dentro de la banda segura NO genera alerta', async () => {
    escenario(SENSOR_PH, 7.5); // entre 6.5 y 9
    const res = await service.evaluarAlertas();
    expect(res.total).toBe(0);
  });

  test('valor fuera de la banda pero dentro del rango operativo → RIESGO', async () => {
    escenario(SENSOR_PH, 9.6); // > 9 (umbral) pero < 14 (rango)
    const res = await service.evaluarAlertas();
    expect(res.total).toBe(1);
    expect(res.resumen).toEqual({ anomalias: 0, riesgos: 1 });
    expect(res.alertas[0].nivel).toBe('RIESGO');
    expect(res.alertas[0].mensaje).toContain('por encima del umbral');
  });

  test('valor fuera del rango operativo → ANOMALIA', async () => {
    escenario(SENSOR_PH, 15); // > 14 (rango operativo)
    const res = await service.evaluarAlertas();
    expect(res.resumen).toEqual({ anomalias: 1, riesgos: 0 });
    expect(res.alertas[0].nivel).toBe('ANOMALIA');
    expect(res.alertas[0].mensaje).toContain('fuera del rango operativo');
  });

  test('valor por debajo del umbral mínimo → RIESGO con dirección correcta', async () => {
    escenario(SENSOR_PH, 3); // < 6.5 (umbral) pero > 0 (rango)
    const res = await service.evaluarAlertas();
    expect(res.alertas[0].nivel).toBe('RIESGO');
    expect(res.alertas[0].mensaje).toContain('por debajo del umbral');
  });

  test('anomalías se ordenan antes que riesgos', async () => {
    boyasRepo.findAllBoyas.mockResolvedValue([{ idboya: 3, nombre: 'Boya Test' }]);
    boyasRepo.findSensoresByBoya.mockResolvedValue([
      SENSOR_PH,
      { ...SENSOR_PH, idsensor: 1, nombresensor: 'Temp1', nomenclatura: '°C',
        rangooperativomin: '0', umbralriesgomin: '10', umbralriesgomax: '35', rangooperativomax: '50' },
    ]);
    telemetriaRepo.queryUltimosValores.mockResolvedValue([
      { campo: 'ph',    valor: 9.6, fecha: '2026-06-11T13:00:00Z' }, // RIESGO
      { campo: 'temp1', valor: 55,  fecha: '2026-06-11T13:00:00Z' }, // ANOMALIA
    ]);
    const res = await service.evaluarAlertas();
    expect(res.total).toBe(2);
    expect(res.alertas[0].nivel).toBe('ANOMALIA'); // primero
    expect(res.alertas[1].nivel).toBe('RIESGO');
  });

  test('un sensor sin datos de telemetría no genera alerta', async () => {
    boyasRepo.findAllBoyas.mockResolvedValue([{ idboya: 3, nombre: 'Boya Test' }]);
    boyasRepo.findSensoresByBoya.mockResolvedValue([SENSOR_PH]);
    telemetriaRepo.queryUltimosValores.mockResolvedValue([]); // sin lecturas
    const res = await service.evaluarAlertas();
    expect(res.total).toBe(0);
  });

  test('una boya sin sensores se omite sin consultar InfluxDB', async () => {
    boyasRepo.findAllBoyas.mockResolvedValue([{ idboya: 9, nombre: 'Boya Vacía' }]);
    boyasRepo.findSensoresByBoya.mockResolvedValue([]);
    const res = await service.evaluarAlertas();
    expect(res.total).toBe(0);
    expect(telemetriaRepo.queryUltimosValores).not.toHaveBeenCalled();
  });
});
