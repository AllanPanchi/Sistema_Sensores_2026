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

  let ventana = '1m';

  if (horas > 168 && horas <= 720) {
    ventana = '1h';   // 1 mes: promedio cada hora
  } else if (horas > 720) {
    ventana = '12h';  // 3 a 6 meses: promedio cada 12 horas
  }

  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${horas}h)
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.boya == "${idboya}")
      |> aggregateWindow(every: ${ventana}, fn: mean, createEmpty: false)
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

// Último valor registrado de CADA campo (sensor) de una boya, dentro de una
// ventana de días. `last()` devuelve el punto más reciente por serie (_field).
export const queryUltimosValores = async (idboya, dias) => {
  const queryApi = getQueryApi();
  // idboya y dias se interpolan en Flux → se fuerzan a entero (nunca texto)
  const boya  = parseInt(idboya, 10);
  const rango = parseInt(dias, 10);
  const flux = `
    from(bucket: "${process.env.INFLUXDB_BUCKET}")
      |> range(start: -${rango}d)
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.boya == "${boya}")
      |> last()
  `;
  const rows = await queryApi.collectRows(flux);
  return rows.map((r) => ({ campo: r._field, valor: r._value, fecha: r._time }));
};
