/*==============================================================*/
/* DBMS name:      PostgreSQL                                   */
/* Database:       sensores                                     */
/*==============================================================*/

DROP TABLE IF EXISTS INDICADOR;
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
/* Table: INDICADOR                                             */
/* Niveles cualitativos definidos por el usuario para cada      */
/* sensor (ej. pH: Ácido [0-6.5], Neutro [6.5-7.5], Alcalino).  */
/*==============================================================*/
CREATE TABLE INDICADOR (
   IDINDICADOR SERIAL      NOT NULL,
   IDSENSOR    INT4        NOT NULL,
   ETIQUETA    VARCHAR(50) NOT NULL,
   VALORMIN    NUMERIC     NOT NULL,
   VALORMAX    NUMERIC     NOT NULL,
   COLOR       VARCHAR(20) NOT NULL,
   CONSTRAINT PK_INDICADOR PRIMARY KEY (IDINDICADOR),
   CONSTRAINT FK_INDICADOR_SENSOR FOREIGN KEY (IDSENSOR)
      REFERENCES SENSOR (IDSENSOR) ON DELETE CASCADE ON UPDATE RESTRICT
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
