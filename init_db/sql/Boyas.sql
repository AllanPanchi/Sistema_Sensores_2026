/*==============================================================*/
/* DBMS name:      PostgreSQL 8                                 */
/* Created on:     19/5/2026 18:18:57                           */
/*==============================================================*/


drop index BOYA_PK;

drop table BOYA;

drop index TIENE_FK;

drop index REPRESENTA_FK;

drop index SENSOR_PK;

drop table SENSOR;

drop index UNIDADESMEDIDA_PK;

drop table UNIDADESMEDIDA;

/*==============================================================*/
/* Table: BOYA                                                  */
/*==============================================================*/
create table BOYA (
   IDBOYA               SERIAL               not null,
   NOMBRE               VARCHAR(100)         null,
   ESTADO               BOOL                 null,
   constraint PK_BOYA primary key (IDBOYA)
);

/*==============================================================*/
/* Index: BOYA_PK                                               */
/*==============================================================*/
create unique index BOYA_PK on BOYA (
IDBOYA
);

/*==============================================================*/
/* Table: SENSOR                                                */
/*==============================================================*/
create table SENSOR (
   IDSENSOR             SERIAL               not null,
   IDUNIDAD             INT4                 null,
   IDBOYA               INT4                 null,
   NOMBRESENSOR         VARCHAR(100)         null,
   RANGOOPERATIVOMIN    NUMERIC              null,
   UMBRALRIESGOMIN      NUMERIC              null,
   RANGOOPERATIVOMAX    NUMERIC              null,
   UMBRALRIESGOMAX      NUMERIC              null,
   ESTADO               BOOL                 null,
   constraint PK_SENSOR primary key (IDSENSOR)
);

/*==============================================================*/
/* Index: SENSOR_PK                                             */
/*==============================================================*/
create unique index SENSOR_PK on SENSOR (
IDSENSOR
);

/*==============================================================*/
/* Index: REPRESENTA_FK                                         */
/*==============================================================*/
create  index REPRESENTA_FK on SENSOR (
IDUNIDAD
);

/*==============================================================*/
/* Index: TIENE_FK                                              */
/*==============================================================*/
create  index TIENE_FK on SENSOR (
IDBOYA
);

/*==============================================================*/
/* Table: UNIDADESMEDIDA                                        */
/*==============================================================*/
create table UNIDADESMEDIDA (
   IDUNIDAD             SERIAL               not null,
   NOMBREUNIDAD         VARCHAR(100)         null,
   NOMENCLATURA         VARCHAR(100)         null,
   constraint PK_UNIDADESMEDIDA primary key (IDUNIDAD)
);

/*==============================================================*/
/* Index: UNIDADESMEDIDA_PK                                     */
/*==============================================================*/
create unique index UNIDADESMEDIDA_PK on UNIDADESMEDIDA (
IDUNIDAD
);

alter table SENSOR
   add constraint FK_SENSOR_REPRESENT_UNIDADES foreign key (IDUNIDAD)
      references UNIDADESMEDIDA (IDUNIDAD)
      on delete restrict on update restrict;

alter table SENSOR
   add constraint FK_SENSOR_TIENE_BOYA foreign key (IDBOYA)
      references BOYA (IDBOYA)
      on delete restrict on update restrict;

