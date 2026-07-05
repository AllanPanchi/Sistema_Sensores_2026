/*==============================================================*/
/* DBMS name:      PostgreSQL                                   */
/* Database:       sensores                                     */
/*==============================================================*/

DROP TABLE IF EXISTS SENSOR;
DROP TABLE IF EXISTS BOYA;
DROP TABLE IF EXISTS UNIDADESMEDIDA;

/*==============================================================*/
/* Table: UNIDADESMEDIDA                                        */
/*==============================================================*/
CREATE TABLE UNIDADESMEDIDA (
   IDUNIDAD     SERIAL       NOT NULL,
   NOMBREUNIDAD VARCHAR(100) NOT NULL,
   NOMENCLATURA VARCHAR(20)  NOT NULL,
   CONSTRAINT PK_UNIDADESMEDIDA PRIMARY KEY (IDUNIDAD)
);

/*==============================================================*/
/* Table: BOYA                                                  */
/*==============================================================*/
CREATE TABLE BOYA (
   IDBOYA SERIAL       NOT NULL,
   NOMBRE VARCHAR(100) NOT NULL,
   ESTADO BOOL         NOT NULL DEFAULT TRUE,
   CONSTRAINT PK_BOYA PRIMARY KEY (IDBOYA)
);

/*==============================================================*/
/* Table: SENSOR                                                */
/*==============================================================*/
CREATE TABLE SENSOR (
   IDSENSOR          SERIAL       NOT NULL,
   IDUNIDAD          INT4         NOT NULL,
   IDBOYA            INT4         NOT NULL,
   NOMBRESENSOR      VARCHAR(100) NOT NULL,
   UMBRALRIESGOMIN   NUMERIC      NOT NULL,
   UMBRALRIESGOMAX   NUMERIC      NOT NULL,
   ESTADO            BOOL         NOT NULL DEFAULT TRUE,
   CONSTRAINT PK_SENSOR PRIMARY KEY (IDSENSOR),
   CONSTRAINT FK_SENSOR_UNIDAD FOREIGN KEY (IDUNIDAD)
      REFERENCES UNIDADESMEDIDA (IDUNIDAD) ON DELETE RESTRICT ON UPDATE RESTRICT,
   CONSTRAINT FK_SENSOR_BOYA FOREIGN KEY (IDBOYA)
      REFERENCES BOYA (IDBOYA) ON DELETE RESTRICT ON UPDATE RESTRICT
);

/*==============================================================*/
/* Seed: Unidades de medida típicas para monitoreo marino       */
/*==============================================================*/
INSERT INTO UNIDADESMEDIDA (NOMBREUNIDAD, NOMENCLATURA) VALUES
   ('Potencial de Hidrógeno',    'pH'),
   ('Temperatura',               '°C'),
   ('Salinidad',                 'PSU'),
   ('Oxígeno Disuelto',          'mg/L'),
   ('Turbidez',                  'NTU');
