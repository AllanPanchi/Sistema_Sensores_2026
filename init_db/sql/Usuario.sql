/*==============================================================*/
/* DBMS name:      PostgreSQL 8                                 */
/* Created on:     19/5/2026 18:20:29                           */
/*==============================================================*/


drop index ROL_PK;

drop table ROL;

drop index TENER_FK;

drop index ASIGNADO_FK;

drop index ROLASIGNACION_PK;

drop table ROLASIGNACION;

drop index USUARIO_PK;

drop table USUARIO;

/*==============================================================*/
/* Table: ROL                                                   */
/*==============================================================*/
create table ROL (
   ROLID                SERIAL               not null,
   NOMBREROL            VARCHAR(100)         null,
   constraint PK_ROL primary key (ROLID)
);

/*==============================================================*/
/* Index: ROL_PK                                                */
/*==============================================================*/
create unique index ROL_PK on ROL (
ROLID
);

/*==============================================================*/
/* Table: ROLASIGNACION                                         */
/*==============================================================*/
create table ROLASIGNACION (
   USUARIOID            INT4                 not null,
   ROLID                INT4                 not null,
   constraint PK_ROLASIGNACION primary key (USUARIOID, ROLID)
);

/*==============================================================*/
/* Index: ROLASIGNACION_PK                                      */
/*==============================================================*/
create unique index ROLASIGNACION_PK on ROLASIGNACION (
USUARIOID,
ROLID
);

/*==============================================================*/
/* Index: ASIGNADO_FK                                           */
/*==============================================================*/
create  index ASIGNADO_FK on ROLASIGNACION (
ROLID
);

/*==============================================================*/
/* Index: TENER_FK                                              */
/*==============================================================*/
create  index TENER_FK on ROLASIGNACION (
USUARIOID
);

/*==============================================================*/
/* Table: USUARIO                                               */
/*==============================================================*/
create table USUARIO (
   USUARIOID            SERIAL               not null,
   NOMBRE               VARCHAR(100)         null,
   APELLIDO             VARCHAR(100)         null,
   CORREO               VARCHAR(100)         null,
   CEDULA               VARCHAR(100)         null,
   constraint PK_USUARIO primary key (USUARIOID)
);

/*==============================================================*/
/* Index: USUARIO_PK                                            */
/*==============================================================*/
create unique index USUARIO_PK on USUARIO (
USUARIOID
);

alter table ROLASIGNACION
   add constraint FK_ROLASIGN_ASIGNADO_ROL foreign key (ROLID)
      references ROL (ROLID)
      on delete restrict on update restrict;

alter table ROLASIGNACION
   add constraint FK_ROLASIGN_TENER_USUARIO foreign key (USUARIOID)
      references USUARIO (USUARIOID)
      on delete restrict on update restrict;

