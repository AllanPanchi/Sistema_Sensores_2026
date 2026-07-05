import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../../middlewares/error.middleware.js';
import * as repo from './auth.repository.js';
import { validarCedula } from '../../utils/cedula.js';

export const login = async (correo, password) => {
  if (!correo || !password) {
    throw new AppError('Correo y contraseña son requeridos', 400);
  }

  const usuario = await repo.findByCorreo(correo);
  // Mensaje genérico para no revelar si el correo existe o no
  if (!usuario) throw new AppError('Credenciales inválidas', 401);

  const match = await bcrypt.compare(password, usuario.contrasena);
  if (!match) throw new AppError('Credenciales inválidas', 401);

  const token = jwt.sign(
    { sub: usuario.usuarioid, correo: usuario.correo, roles: usuario.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    token,
    usuario: {
      id:       usuario.usuarioid,
      nombre:   usuario.nombre,
      apellido: usuario.apellido,
      correo:   usuario.correo,
      roles:    usuario.roles,
    },
  };
};

export const register = async ({ nombre, apellido, correo, cedula, password, rol = 'OPERADOR' }) => {
  if (!nombre || !apellido || !correo || !cedula || !password) {
    throw new AppError('Todos los campos son requeridos', 400);
  }
  if (!validarCedula(cedula.trim())) {
    throw new AppError('La cédula ecuatoriana ingresada no es válida', 400);
  }
  if (password.length < 8) {
    throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
  }

  const existe = await repo.findByCorreo(correo);
  if (existe) throw new AppError('El correo ya está registrado', 409);

  const rolRecord = await repo.findRolByNombre(rol);
  if (!rolRecord) throw new AppError(`El rol '${rol}' no existe en el sistema`, 400);

  const contrasena = await bcrypt.hash(password, 10);
  const nuevo = await repo.create({ nombre, apellido, correo, cedula, contrasena });
  await repo.assignRol(nuevo.usuarioid, rolRecord.rolid);

  return {
    id:       nuevo.usuarioid,
    nombre:   nuevo.nombre,
    apellido: nuevo.apellido,
    correo:   nuevo.correo,
    cedula:   nuevo.cedula,
    rol,
  };
};
