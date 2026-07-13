# Actualizaciones pendientes — HidroSentinel Manual de Usuario

El manual actual (`HidroSentinel_Manual_Usuario.docx`, v1.0) llega hasta el commit `942d0d6`
(7 jul). Desde entonces se añadió: Docker Compose (`ba820a1`), Reportes + Indicadores +
arreglo de sensores (`61db124`) y Validaciones/Usabilidad (`83b9701`). Abajo está todo el
contenido nuevo, en el orden y con el estilo (Rol requerido, cajas ATENCIÓN/NOTA/RESTRICCIÓN,
pasos numerados) que ya usa el documento. Cada bloque indica **dónde pegarlo**.

Como se inserta una sección completa nueva (Instalación), todo lo que va **después** de
"1.1 Roles del sistema" se recorre un número. Al final de este documento hay la tabla de
renumeración completa.

---

## 1. Sección nueva: "2. Instalación y Despliegue"

**Dónde:** pégala completa justo antes del encabezado actual **"2. Autenticación"**
(que pasará a ser "3. Autenticación", ver tabla de renumeración al final).

> Esta sección está dirigida a la persona responsable de instalar el sistema (no es
> necesaria para el uso diario de la plataforma). Describe cómo levantar HidroSentinel
> completo (bases de datos, backend y frontend) usando Docker Compose.

### 2.1 Requisitos previos

| Herramienta | Versión recomendada |
|---|---|
| Docker y Docker Compose | Última versión estable |
| Git | Última versión estable |
| Node.js (opcional, solo para desarrollo local) | ≥ 18 |

### 2.2 Configurar variables de entorno

1. Clona el repositorio del proyecto y ubícate en la carpeta raíz (`Sistema_Sensores_2026`).
2. Copia la plantilla de configuración: duplica `.env.example` como `.env`.
3. Completa los valores del archivo `.env`: define un `JWT_SECRET` largo y aleatorio, un
   `INFLUXDB_TOKEN` seguro, y verifica que `PG_PORT` coincida con `POSTGRES_PORT`.

> **ATENCIÓN** — `PG_PORT` debe coincidir con `POSTGRES_PORT` (el puerto que el contenedor
> de PostgreSQL publica al host). Si estos valores no coinciden, el backend no podrá
> conectarse a la base de datos al arrancar.

### 2.3 Levantar el sistema con Docker Compose

Desde la raíz del proyecto, ejecuta:

```
docker compose up -d --build
```

Este comando construye e inicia los cuatro servicios en el orden correcto: las bases de
datos primero, el backend espera a que estén saludables, y el frontend espera al backend.
En el primer arranque se crean automáticamente las bases de datos, sus tablas, y el
usuario administrador inicial.

Verifica que los cuatro contenedores estén activos:

```
docker compose ps
```

### 2.4 Acceder a la aplicación

| Servicio | URL |
|---|---|
| Frontend (interfaz web) | http://localhost:8080 |
| Backend (API REST) | http://localhost:3000 |

Credenciales del administrador inicial:
- Correo: `admin@hidrosentinel.ec`
- Contraseña: `Admin2026!`

> **ATENCIÓN** — Cambia la contraseña del administrador inicial después del primer
> ingreso (ver sección 3.2 Cambiar contraseña, antes 2.2). No debe conservarse en un
> entorno de producción.

### 2.5 Comandos de uso diario

| Comando | Efecto |
|---|---|
| `docker compose up -d --build` | Levanta el sistema (reconstruye tras cambios de código). |
| `docker compose ps` | Muestra el estado de los contenedores. |
| `docker compose logs -f backend` | Muestra los logs del backend en vivo. |
| `docker compose stop` | Detiene los contenedores sin borrar datos. |
| `docker compose down` | Detiene y elimina los contenedores (conserva los datos). |
| `docker compose down -v` | Detiene y elimina los contenedores, **borrando también** los datos de las bases de datos. |

> **ATENCIÓN** — El comando `docker compose down -v` elimina permanentemente todos los
> datos almacenados en PostgreSQL e InfluxDB. Úsalo solo si deseas reiniciar el sistema
> desde cero.

**Captura sugerida:** terminal mostrando `docker compose ps` con los 4 contenedores "Up",
y/o la pantalla de login del frontend en `localhost:8080`.

---

## 2. Subsección nueva: "5.4 Indicadores (niveles cualitativos)"

**Dónde:** al final de la sección actual "4. Boyas y sensores" (que pasará a ser "5."),
después de "4.3 Unidades de medida" (pasará a "5.3") y antes del encabezado actual
"5. Telemetría" (pasará a "6.").

Los indicadores permiten definir niveles cualitativos sobre el rango de un sensor (por
ejemplo, Ácido / Neutro / Alcalino para un sensor de pH). Se muestran como una barra de
colores (gauge) en las tarjetas de telemetría y en los reportes exportados.

Rol requerido: ADMINISTRADOR

**Agregar un nivel**

1. En el detalle de la boya, junto al sensor deseado, haz clic en "Niveles".
2. Completa la etiqueta (ej. "Óptimo"), el valor "Desde" y "Hasta" del nivel, y elige un
   color de la paleta o uno personalizado.
3. Haz clic en "+ Agregar nivel". El nivel aparecerá de inmediato en la barra visual.

**Captura sugerida:** modal de "Niveles / Indicadores" de un sensor con 2-3 niveles ya
creados.

> **RESTRICCIÓN** — Cada nivel debe quedar dentro de los umbrales de riesgo del sensor
> [umbral mínimo, umbral máximo] y no puede solaparse con un nivel ya existente. El
> sistema rechaza los niveles que incumplan cualquiera de estas dos condiciones.

**Eliminar un nivel**

1. Haz clic en "Eliminar" junto al nivel deseado en la lista.
2. Confirma la acción en el diálogo que aparece.

---

## 3. Nota a añadir en "5.3 Gráficas históricas" (pasará a "6.3")

**Dónde:** agrega esta frase como paso adicional (o nota) justo antes de la ilustración
"Tarjetas de mediciones", después del paso "4. Pasa el cursor sobre la gráfica...".

> Si el sensor tiene niveles configurados (ver 5.4 Indicadores), la tarjeta muestra
> además una barra de colores (gauge) con el nivel correspondiente al último valor
> medido.

---

## 4. Subsección nueva: "6.5 Notas y observaciones en las gráficas"

**Dónde:** después de "5.4 Estadísticas del período" (pasará a "6.4"), antes del
encabezado actual "6. Alertas" (pasará a "7.").

Roles requeridos: ADMINISTRADOR, OPERADOR

Dentro de la gráfica detallada de un sensor (ver 6.3), puedes dejar observaciones
asociadas a un punto específico de la serie, útil para registrar eventos relevantes como
mantenimiento, calibración o condiciones climáticas.

1. Abre la gráfica detallada haciendo clic en la tarjeta del sensor.
2. Haz clic sobre el punto de la serie donde deseas dejar una observación.
3. Escribe el texto de la nota y haz clic en "Guardar nota".
4. Los puntos con una nota se marcan con un círculo ámbar; al pasar el cursor sobre
   ellos se muestra el texto guardado.

**Captura sugerida:** gráfica detallada (modal) con un punto marcado en ámbar y su nota
visible en el tooltip.

> **NOTA** — Las notas se guardan localmente en el navegador (localStorage), asociadas a
> la boya, el sensor y la fecha del punto. No se sincronizan entre distintos dispositivos
> o navegadores, y se incluyen en el reporte exportado (ver 6.6).

**Eliminar una nota**

1. Haz clic nuevamente sobre el punto marcado con el círculo ámbar.
2. Haz clic en "Eliminar" dentro del editor de la nota.

---

## 5. Subsección nueva: "6.6 Exportar reporte"

**Dónde:** inmediatamente después de "6.5 Notas y observaciones en las gráficas" (bloque
anterior), antes del encabezado "6. Alertas" (pasará a "7.").

Roles requeridos: ADMINISTRADOR, OPERADOR

Genera un archivo HTML autocontenido con las gráficas, el gauge de niveles, las
estadísticas y las observaciones de todos los sensores para la boya y el rango de tiempo
seleccionados.

1. Selecciona la boya y el rango de tiempo deseados.
2. Haz clic en "Exportar reporte", en la esquina superior derecha de los filtros.
3. El navegador descargará un archivo con el nombre `reporte_<boya>_<fecha>.html`.
4. Abre el archivo descargado; usa el botón "Imprimir / Guardar PDF" dentro del propio
   reporte si necesitas una versión en PDF.

**Captura sugerida:** el archivo de reporte exportado, abierto en el navegador.

> **NOTA** — El botón permanece deshabilitado si no hay mediciones cargadas en el rango
> seleccionado.

---

## 6. Frase nueva en "6. Alertas" (pasará a "7. Alertas")

**Dónde:** agrégala justo antes de la caja "NOTA SOBRE LA FECHA", después de la lista de
lo que muestra cada alerta ("Límites configurados: umbral mínimo y máximo...").

> Haz clic en cualquier tarjeta de alerta para abrir directamente el módulo de
> Telemetría con la boya correspondiente ya seleccionada.

---

## 7. Actualizaciones menores de texto existente

- **Tabla de módulos (sección 1, fila "Boyas y sensores"):** cambia la descripción a
  *"Registro y configuración de boyas, sensores, indicadores (niveles cualitativos) y
  unidades de medida."*
- **Tabla de módulos (fila "Telemetría"):** cambia la descripción a *"Carga de archivos
  CSV, gráficas históricas, estadísticas, notas y exportación de reportes."*
- **Portada:** actualiza "Versión" a `1.1` y "Fecha" a la fecha en que termines de
  actualizar el documento.
- **Pie de página final:** cambia `v1.0` por `v1.1`.

---

## Tabla de renumeración de encabezados

Todo lo que sigue a "1.1 Roles del sistema" se recorre **+1** en el primer nivel (por
la sección de Instalación insertada como "2."). Dentro de "Boyas y sensores" y de
"Telemetría" se agregan subsecciones nuevas al final de cada una.

| Texto actual | Texto nuevo |
|---|---|
| 2. Autenticación | 3. Autenticación |
| 2.1 Iniciar sesión | 3.1 Iniciar sesión |
| 2.2 Cambiar contraseña | 3.2 Cambiar contraseña |
| 2.3 Cerrar sesión | 3.3 Cerrar sesión |
| 3. Gestión de usuarios | 4. Gestión de usuarios |
| 3.1 Lista de usuarios | 4.1 Lista de usuarios |
| 3.2 Crear usuario | 4.2 Crear usuario |
| 3.3 Editar datos del usuario | 4.3 Editar datos del usuario |
| 3.4 Gestionar roles | 4.4 Gestionar roles |
| 3.5 Eliminar usuario | 4.5 Eliminar usuario |
| 4. Boyas y sensores | 5. Boyas y sensores |
| 4.1 Gestionar boyas | 5.1 Gestionar boyas |
| 4.2 Gestionar sensores | 5.2 Gestionar sensores |
| 4.3 Unidades de medida | 5.3 Unidades de medida |
| *(nueva)* | 5.4 Indicadores (niveles cualitativos) |
| 5. Telemetría | 6. Telemetría |
| 5.1 Cargar archivo CSV | 6.1 Cargar archivo CSV |
| 5.2 Preview de columnas | 6.2 Preview de columnas |
| 5.3 Gráficas históricas | 6.3 Gráficas históricas |
| 5.4 Estadísticas del período | 6.4 Estadísticas del período |
| *(nueva)* | 6.5 Notas y observaciones en las gráficas |
| *(nueva)* | 6.6 Exportar reporte |
| 6. Alertas | 7. Alertas |

No es necesario tocar los encabezados de nivel 3 sin número (Crear boya, Editar o
desactivar boya, Eliminar boya, Crear sensor, Asignación manual de columnas grises):
esos no llevan numeración y no cambian.
