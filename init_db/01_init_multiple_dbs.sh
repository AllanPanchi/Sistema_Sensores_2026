#!/bin/bash
set -e

echo "===================================================="
echo "INICIANDO CREACIÓN DE BASES DE DATOS MULTIDOMINIO"
echo "===================================================="

# 1. Crear las dos bases de datos de forma explícitas
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    CREATE DATABASE usuarios;
    CREATE DATABASE sensores;
EOSQL

echo "Bases de datos 'usuarios' y 'sensores' creadas con éxito."

# 2. Ejecutar el script Usuario.sql dentro de la base de datos 'usuarios'
echo "Cargando esquema de tablas en base de datos: usuarios..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "usuarios" -f /docker-entrypoint-initdb.d/sql/Usuario.sql

# 3. Ejecutar el script Boyas.sql dentro de la base de datos 'sensores'
echo "Cargando esquema de tablas en base de datos: sensores..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "sensores" -f /docker-entrypoint-initdb.d/sql/Boyas.sql

echo "===================================================="
echo "PROCESO DE INICIALIZACIÓN COMPLETADO CON ÉXITO"
echo "===================================================="