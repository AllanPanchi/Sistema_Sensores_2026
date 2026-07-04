import { Point } from '@influxdata/influxdb-client';
import { getWriteApi, getQueryApi } from '../../config/influxdb.js';

const MEASUREMENT = 'telemetria';

// Escribe un lote de filas ya validadas en InfluxDB.
// Cada fila: { ts: Date, campos: { nombre_campo: number, ... } }
export const writeTelemetria = async (idboya, filas) => {
  const writeApi = getWriteApi();
  try {
    for (const fila of filas) {
      const point = new Point(MEASUREMENT)
        .tag('boya', String(idboya))
        .timestamp(fila.ts);
      for (const [campo, valor] of Object.entries(fila.campos)) {
        point.floatField(campo, valor);
      }
      writeApi.writePoint(point);
    }
  } finally {
    // close() vacía el buffer de escritura — obligatorio (ver config/influxdb.js)
    await writeApi.close();
  }
  return filas.length;
};

// Últimas mediciones de una boya, pivoteadas: una fila por timestamp
// con una columna por sensor.
export const queryTelemetria = async (idboya, horas, limite) => {
  const queryApi = getQueryApi();
  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${horas}h)
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.boya == "${idboya}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: ${limite})
  `;
  const rows = await queryApi.collectRows(flux);
  // Limpiar metadatos internos de Flux antes de devolver
  return rows.map(({ result, table, _start, _stop, _measurement, boya, _time, ...campos }) => ({
    fecha: _time,
    ...campos,
  }));
};
