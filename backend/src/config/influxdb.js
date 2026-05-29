import { InfluxDB } from '@influxdata/influxdb-client';

const url   = process.env.INFLUXDB_URL || `http://localhost:${process.env.INFLUXDB_PORT || 8086}`;
const token = process.env.INFLUXDB_TOKEN;
const org   = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;

const client = new InfluxDB({ url, token });

// Retorna una nueva instancia del WriteAPI lista para usar.
// El caller es responsable de llamar .close() al terminar para vaciar el buffer.
export const getWriteApi = () => client.getWriteApi(org, bucket, 'ms');

export const getQueryApi = () => client.getQueryApi(org);

export { url as influxUrl };
