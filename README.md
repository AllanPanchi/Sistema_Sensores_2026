<div align="center">

# 🌊 HidroSentinel

### Plataforma de Monitoreo de Riesgo Sanitario Marino

*Trabajo de Integración Curricular (TIC)*

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![InfluxDB](https://img.shields.io/badge/InfluxDB-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

</div>

---

## 📖 Descripción del Proyecto

**HidroSentinel** es una plataforma para la **evaluación y monitoreo de riesgos sanitarios en ambientes marinos**. El sistema integra la gestión de infraestructura IoT (boyas y sensores desplegados en campo) con el procesamiento, almacenamiento y visualización masiva de datos de telemetría capturados en archivos CSV.

La plataforma resuelve un desafío técnico central: **la persistencia de dos naturalezas de datos fundamentalmente distintas**. Por un lado, los metadatos relacionales (usuarios, roles, boyas, sensores y sus rangos operativos); por otro, series temporales de alta frecuencia provenientes de los sensores. HidroSentinel afronta esta dualidad mediante una arquitectura de **persistencia políglota**, empleando el motor de base de datos idóneo para cada dominio.

El núcleo funcional del sistema es su **motor de ingesta de telemetría**, diseñado para procesar cargas masivas de archivos CSV aplicando validación estricta de seguridad, limpieza de datos anómalos y cálculo estadístico (media, mediana y moda) antes de la persistencia en la base de datos de series temporales.

---

## 🏛️ Arquitectura del Sistema

### Monolito Modular con Arquitectura de 3 Capas

El backend se estructura como un **Monolito Modular** organizado por dominios de negocio. Cada módulo respeta una **separación estricta en tres capas**, lo que garantiza bajo acoplamiento, alta cohesión y una clara segregación de responsabilidades:

```
   Petición HTTP
        │
        ▼
┌─────────────────────┐
│  Routes / Controller │   Reciben la petición, delegan al servicio y
│  (solo req/res)      │   formatean la respuesta. Sin lógica de negocio.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│      Service         │   Toda la lógica de negocio, validaciones de dominio,
│  (reglas y lógica)   │   procesamiento de CSV y cálculo estadístico.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│    Repository        │   Único punto de acceso a datos: consultas SQL
│  (acceso a datos)    │   (PostgreSQL) y escrituras/lecturas (InfluxDB).
└─────────────────────┘
```

Esta disciplina arquitectónica permite que la lógica de negocio sea **verificable de forma aislada** mediante *mocking* de la capa de repositorios, sin depender de bases de datos reales durante las pruebas unitarias.

### Persistencia Políglota

| Motor | Rol | Datos que gestiona |
|-------|-----|--------------------|
| **PostgreSQL** | Base de datos relacional | Usuarios, roles, asignaciones, boyas, sensores, unidades de medida. Se emplean **dos bases de datos independientes** (`usuarios` y `sensores`) para segregar los dominios. |
| **InfluxDB** | Base de datos de series temporales | Mediciones de telemetría de alta frecuencia, indexadas por boya y sensor a lo largo del tiempo. |

Cada motor se selecciona por su idoneidad: PostgreSQL aporta integridad referencial y transaccionalidad para los metadatos; InfluxDB aporta escritura y consulta eficiente de grandes volúmenes de datos temporales.

---

## 🧩 Módulos del Sistema

| Módulo | Responsabilidad |
|--------|-----------------|
| **🔐 Autenticación (Auth)** | Inicio de sesión con **JSON Web Tokens (JWT)**, hash de contraseñas con `bcrypt` y middleware de control de acceso basado en roles (`ADMINISTRADOR`, `OPERADOR`). |
| **👥 Gestión de Usuarios** | CRUD de usuarios, asignación de roles mediante transacciones atómicas, y cambio de contraseña con autorización granular (auto-servicio vs. administración). |
| **📡 Gestión de Boyas y Sensores** | CRUD de boyas, sensores y unidades de medida. Incluye validación de la invariante de rangos operativos y umbrales de riesgo, y control de integridad referencial (claves foráneas). |
| **📥 Ingesta de Telemetría (CSV)** | Motor de carga masiva de archivos CSV: validación de seguridad del archivo (firmas binarias, extensión, tamaño), limpieza de datos anómalos por fila y por valor, y persistencia en InfluxDB. Verifica la coherencia entre las columnas del CSV y los sensores registrados. |
| **📊 Analítica** | Cálculo de **media, mediana y moda** por sensor durante la ingesta, y consulta histórica de mediciones para su visualización en el frontend. |

---

## ⚙️ Prerrequisitos

Asegúrate de tener instaladas las siguientes herramientas:

| Herramienta | Versión recomendada |
|-------------|---------------------|
| **Node.js** | ≥ 18 (probado en v24) |
| **Docker** y **Docker Compose** | Última versión estable |
| **Git** | Última versión estable |

---

## 🚀 Guía de Instalación y Ejecución

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Sistema_Sensores_2026
```

### 2. Configurar las variables de entorno

Copia la plantilla y completa los valores en el archivo `.env` de la **raíz del proyecto**:

```bash
cp .env.example .env
```

> ⚠️ **Importante:** `PG_PORT` debe coincidir con `POSTGRES_PORT` (el puerto que el contenedor de PostgreSQL publica al host). Define un `JWT_SECRET` largo y aleatorio, y un `INFLUXDB_TOKEN` seguro.

### 3. Levantar las bases de datos con Docker

Desde la raíz del proyecto, este comando inicia los contenedores de PostgreSQL e InfluxDB. Los scripts de inicialización SQL crean automáticamente las bases de datos y sus tablas en el primer arranque:

```bash
docker compose up -d
```

Verifica que ambos contenedores estén activos:

```bash
docker ps
```

### 4. Iniciar el Backend

```bash
cd backend
npm install
npm run seed      # crea el usuario administrador inicial (una sola vez)
npm run dev       # inicia el servidor en modo desarrollo (hot-reload)
```

El backend valida la conexión a las tres bases de datos antes de aceptar tráfico. Estará disponible en **http://localhost:3000**.

**Credenciales del administrador inicial:**
- **Correo:** `admin@hidrosentinel.ec`
- **Contraseña:** `Admin2026!`

### 5. Iniciar el Frontend

En una **nueva terminal**:

```bash
cd frontend
npm install
npm run dev
```

La interfaz estará disponible en **http://localhost:5173**.

---

## 🧪 Guía de Pruebas (Testing)

El proyecto incluye una suite de pruebas automatizadas que abarca tres frentes. Todos los comandos se ejecutan desde el directorio `backend/`.

### Pruebas Unitarias y de Seguridad

Ejecutan de forma **hermética** (sin conexión a bases de datos reales), realizando *mocking* estricto de la capa de repositorios. Ideales para integración continua.

```bash
npm test
```

Cubren:

- **🔬 Unitarias:** procesamiento de CSV, parseo de formato del datalogger, cálculo estadístico (media/mediana/moda) y limpieza de datos anómalos.
- **🛡️ Seguridad (OWASP):** validación estricta de JWT (tokens ausentes, expirados, firmados con otra clave, algoritmo `none`), rechazo de binarios disfrazados de CSV mediante firmas binarias (*magic bytes*), prevención de inyección de fórmulas (*CSV injection*) y protección ante agotamiento de recursos (*DoS*).

### Pruebas de Integración y Seguridad (con Bases de Datos)

Validan la seguridad **de extremo a extremo** contra PostgreSQL real, confirmando que las consultas parametrizadas neutralizan la inyección SQL y que la capa JWT bloquea accesos no autorizados. Requieren los contenedores activos y el administrador sembrado.

```bash
npm run test:integracion
```

### Pruebas de Carga y Estrés

Simulan concurrencia masiva en la ingesta de CSV para evaluar el rendimiento del motor de telemetría y localizar cuellos de botella en la escritura hacia InfluxDB. El script se encuentra en `scripts/`.

```bash
# Desde la raíz del proyecto — 100 subidas con 10 peticiones concurrentes
node scripts/estres_ingesta.mjs --boya 3 --total 100 --concurrencia 10

# Estrés más agresivo con archivos de mayor tamaño
node scripts/estres_ingesta.mjs --boya 3 --total 200 --concurrencia 50 --filas 300
```

El script reporta *throughput* (peticiones/s y puntos/s), latencias percentiladas (p50, p95, p99) y el detalle de errores.

---

## 🛠️ Scripts Auxiliares

Utilidades ubicadas en el directorio `scripts/` (ejecutar desde la raíz del proyecto):

| Script | Propósito |
|--------|-----------|
| `generar_csv_prueba.py` | Genera archivos CSV sintéticos con el formato del datalogger real, opcionalmente con datos anómalos para probar la limpieza. |
| `cargar_lote.mjs` | Cargador por lotes: sube todos los CSV de una carpeta al endpoint de telemetría. Sirve como carga histórica y prueba de integración end-to-end. |
| `estres_ingesta.mjs` | Prueba de carga y estrés de la ingesta concurrente (ver sección de Testing). |

**Ejemplos de uso:**

```bash
# Generar 5 archivos CSV de prueba con 3% de datos anómalos
python scripts/generar_csv_prueba.py --archivos 5 --filas 500 --basura 0.03

# Cargar una carpeta de CSVs históricos a la boya 3
node scripts/cargar_lote.mjs --carpeta ./data_historica --boya 3
```

---

## 📂 Estructura del Repositorio

```
Sistema_Sensores_2026/
├── backend/
│   ├── src/
│   │   ├── config/        # Conectores a PostgreSQL (x2) e InfluxDB
│   │   ├── middlewares/   # Autenticación JWT y manejo de errores
│   │   ├── modules/       # auth · usuarios · boyas · telemetria (3 capas c/u)
│   │   ├── utils/         # Formateador de respuestas estándar
│   │   ├── app.js         # Configuración de Express
│   │   └── server.js      # Verificación de BD y arranque
│   ├── scripts/           # Semilla del administrador inicial
│   └── tests/             # unit · seguridad · integracion
├── frontend/              # Aplicación React (Vite + Tailwind CSS)
├── init_db/               # Scripts SQL de inicialización de PostgreSQL
├── scripts/               # Utilidades de generación, carga y estrés
├── docker-compose.yml     # Contenedores de PostgreSQL e InfluxDB
└── .env.example           # Plantilla de variables de entorno
```

---

<div align="center">

**HidroSentinel** — Trabajo de Integración Curricular

*Arquitectura de Monolito Modular · Persistencia Políglota · Node.js + React*

</div>
