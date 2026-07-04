#!/usr/bin/env python3
"""
Generador de CSVs de telemetria de prueba para HidroSentinel.

Replica el formato exacto del datalogger real:
  - Separador de columnas: ';'
  - Separador decimal: ',' (formato europeo)
  - Fecha: d/m/yyyy H:MM (sin ceros a la izquierda), con varias lecturas por minuto
  - 9 columnas, incluyendo un sensor NTC averiado (valor constante) y nivel fijo

Los valores derivan lentamente (random walk acotado) para parecerse a mediciones
reales de sensores. Opcionalmente inyecta filas "basura" (campos vacios, spikes
fuera de rango, texto malformado) para probar la limpieza del modulo de telemetria.

Uso:
    python generar_csv_prueba.py                      # 3 archivos, ~250 filas c/u
    python generar_csv_prueba.py --archivos 5 --filas 500
    python generar_csv_prueba.py --basura 0.05        # 5% de filas basura
    python generar_csv_prueba.py --salida ./mis_csv
"""

import argparse
import os
import random
from datetime import datetime, timedelta

# Cabecera identica a la del archivo real
CABECERA = ["Fecha", "Temp1", "Humedad 1", "Temp 2", "Humedad 2",
            "TDS", "Temperatura NTC", "Ph", "Nivel (m)"]

# Configuracion por sensor: (valor_inicial, minimo, maximo, paso_max, decimales)
SENSORES = {
    "Temp1":           (23.0,  18.0, 30.0, 0.1, 1),
    "Humedad 1":       (48.0,  40.0, 60.0, 0.2, 1),
    "Temp 2":          (22.2,  18.0, 28.0, 0.1, 1),
    "Humedad 2":       (54.0,  45.0, 65.0, 0.3, 1),
    "TDS":             (274.0, 250.0, 320.0, 2.0, 0),
    "Temperatura NTC": (-148.87, -148.87, -148.87, 0.0, 2),  # sensor averiado: constante
    "Ph":              (8.58,  7.5, 9.0, 0.02, 2),
    "Nivel (m)":       (0.23,  0.10, 0.80, 0.0, 2),  # nivel estable
}


def num_es(valor: float, decimales: int) -> str:
    """Formatea un numero con coma decimal (formato europeo). Sin decimales -> entero."""
    if decimales == 0:
        return str(int(round(valor)))
    return f"{valor:.{decimales}f}".replace(".", ",")


def fecha_es(dt: datetime) -> str:
    """Formatea fecha como d/m/yyyy H:MM sin ceros a la izquierda."""
    return f"{dt.day}/{dt.month}/{dt.year} {dt.hour}:{dt.minute:02d}"


def paso(valor: float, minimo: float, maximo: float, paso_max: float) -> float:
    """Aplica un paso aleatorio (random walk) acotado al rango del sensor."""
    if paso_max == 0:
        return valor
    nuevo = valor + random.uniform(-paso_max, paso_max)
    return max(minimo, min(maximo, nuevo))


def fila_basura(dt: datetime) -> str:
    """Genera una fila con datos corruptos para probar la limpieza."""
    tipo = random.choice(["vacios", "spike", "texto", "incompleta"])
    if tipo == "vacios":
        # Varios campos vacios
        return f"{fecha_es(dt)};;;;;274;-148,87;;0,23"
    if tipo == "spike":
        # Valores fisicamente imposibles
        return f"{fecha_es(dt)};999;-50;22,1;999;9999;-148,87;99,9;0,23"
    if tipo == "texto":
        # Texto donde deberia haber numeros
        return f"{fecha_es(dt)};ERROR;N/A;22,1;54,5;274;-148,87;8,59;0,23"
    # incompleta: faltan columnas
    return f"{fecha_es(dt)};23,2;48,1;22,1"


def generar_archivo(ruta: str, n_filas: int, inicio: datetime, prob_basura: float) -> int:
    """Genera un CSV. Devuelve el numero de filas basura inyectadas."""
    # Estado inicial de cada sensor (con pequena variacion entre archivos)
    estado = {}
    for nombre, (ini, mn, mx, _, _) in SENSORES.items():
        estado[nombre] = paso(ini, mn, mx, abs(ini) * 0.02)

    dt = inicio
    basura_total = 0
    lineas = [";".join(CABECERA)]

    for _ in range(n_filas):
        # Varias lecturas comparten el mismo minuto (como el datalogger real).
        # Cada 3-6 filas avanza un minuto.
        if random.random() < 0.25:
            dt += timedelta(minutes=random.randint(1, 3))

        if random.random() < prob_basura:
            lineas.append(fila_basura(dt))
            basura_total += 1
            continue

        # Avanzar el random walk de cada sensor
        campos = [fecha_es(dt)]
        for nombre, (_, mn, mx, pmax, dec) in SENSORES.items():
            estado[nombre] = paso(estado[nombre], mn, mx, pmax)
            campos.append(num_es(estado[nombre], dec))
        lineas.append(";".join(campos))

    with open(ruta, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(lineas) + "\n")

    return basura_total


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera CSVs de telemetria de prueba para HidroSentinel.")
    parser.add_argument("--archivos", type=int, default=3, help="Numero de archivos a generar (default: 3)")
    parser.add_argument("--filas", type=int, default=250, help="Filas de datos por archivo (default: 250)")
    parser.add_argument("--basura", type=float, default=0.0, help="Proporcion de filas basura 0.0-1.0 (default: 0.0)")
    parser.add_argument("--salida", type=str, default="data_prueba", help="Carpeta de salida (default: data_prueba)")
    parser.add_argument("--seed", type=int, default=None, help="Semilla aleatoria para resultados reproducibles")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    os.makedirs(args.salida, exist_ok=True)

    # Cada archivo simula un dia distinto de mediciones
    base = datetime(2026, 4, 1, 12, 20)
    print(f"Generando {args.archivos} archivo(s) en '{args.salida}/' ...\n")

    for i in range(args.archivos):
        inicio = base + timedelta(days=i)
        nombre = f"Datos Sensores - {inicio.day:02d}{inicio.month:02d}{inicio.year}.csv"
        ruta = os.path.join(args.salida, nombre)
        basura = generar_archivo(ruta, args.filas, inicio, args.basura)
        detalle = f"  ({basura} filas basura)" if basura else ""
        print(f"  OK  {nombre}  ->  {args.filas} filas{detalle}")

    print(f"\nListo. {args.archivos} archivo(s) generado(s).")


if __name__ == "__main__":
    main()
