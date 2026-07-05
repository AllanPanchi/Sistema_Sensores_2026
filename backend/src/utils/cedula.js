/**
 * Valida una cédula ecuatoriana de persona natural.
 * Algoritmo oficial del Registro Civil:
 *   - 10 dígitos numéricos
 *   - Primeros 2 dígitos: provincia válida (01-24 o 30)
 *   - Tercer dígito: 0-5 (persona natural)
 *   - Dígito verificador (posición 10) calculado con módulo 10
 */
export const validarCedula = (cedula) => {
  if (typeof cedula !== 'string' || !/^\d{10}$/.test(cedula)) return false;

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const tercerDigito = parseInt(cedula[2], 10);
  if (tercerDigito > 5) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(cedula[i], 10) * coeficientes[i];
    if (val >= 10) val -= 9;
    suma += val;
  }

  const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return verificador === parseInt(cedula[9], 10);
};
