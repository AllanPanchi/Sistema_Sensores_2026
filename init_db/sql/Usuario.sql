/*==============================================================*/
/* DBMS name:      PostgreSQL                                   */
/* Database:       usuarios                                     */
/*==============================================================*/

DROP TABLE IF EXISTS ROLASIGNACION;
DROP TABLE IF EXISTS USUARIO;
DROP TABLE IF EXISTS ROL;

/*==============================================================*/
/* Table: ROL                                                   */
/*==============================================================*/
CREATE TABLE ROL (
   ROLID      SERIAL       NOT NULL,
   NOMBREROL  VARCHAR(100) NOT NULL UNIQUE,
   CONSTRAINT PK_ROL PRIMARY KEY (ROLID)
);

/*==============================================================*/
/* Table: USUARIO                                               */
/*==============================================================*/
CREATE TABLE USUARIO (
   USUARIOID  SERIAL       NOT NULL,
   NOMBRE     VARCHAR(100) NOT NULL,
   APELLIDO   VARCHAR(100) NOT NULL,
   CORREO     VARCHAR(100) NOT NULL UNIQUE,
   CEDULA     VARCHAR(20)  NOT NULL,
   CONTRASENA VARCHAR(255) NOT NULL,
   CONSTRAINT PK_USUARIO PRIMARY KEY (USUARIOID)
);

/*==============================================================*/
/* Table: ROLASIGNACION                                         */
/*==============================================================*/
CREATE TABLE ROLASIGNACION (
   USUARIOID INT4 NOT NULL,
   ROLID     INT4 NOT NULL,
   CONSTRAINT PK_ROLASIGNACION PRIMARY KEY (USUARIOID, ROLID),
   CONSTRAINT FK_ROLASIGN_USUARIO FOREIGN KEY (USUARIOID)
      REFERENCES USUARIO (USUARIOID) ON DELETE CASCADE ON UPDATE RESTRICT,
   CONSTRAINT FK_ROLASIGN_ROL FOREIGN KEY (ROLID)
      REFERENCES ROL (ROLID) ON DELETE RESTRICT ON UPDATE RESTRICT
);

/*==============================================================*/
/* Seed: Roles del sistema                                      */
/*==============================================================*/
INSERT INTO ROL (NOMBREROL) VALUES ('ADMINISTRADOR');
INSERT INTO ROL (NOMBREROL) VALUES ('OPERADOR');
