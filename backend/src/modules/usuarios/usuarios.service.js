import bcrypt from 'bcryptjs';
import { AppError } from '../../middlewares/error.middleware.js';
import * as repo from './usuarios.repository.js';

export const listarUsuarios = () => repo.findAll();

export const listarRoles = () => repo.findAllRoles();

export const obtenerUsuario = async (id) => {
  const usuario = await repo.findById(id);
  if (!usuario) throw new AppError(`Usuario con ID ${id} no encontrado`, 404);
  return usuario;
};

// Devuelve el perfil del usuario autenticado usando el ID del JWT
export const obtenerPerfil = (userId) => obtenerUsuario(userId);

export const actualizarUsuario = async (id, { nombre, apellido, cedula }) => {
  if (!nombre?.trim() || !apellido?.trim() || !cedula?.trim()) {
    throw new AppError('nombre, apellido y cedula son requeridos', 400);
  }
  const usuario = await repo.update(id, { nombre, apellido, cedula });
  if (!usuario) throw new AppError(`Usuario con ID ${id} no encontrado`, 404);
  return usuario;
};

export const cambiarPassword = async (targetId, requestUser, { currentPassword, newPassword }) => {
  if (!newPassword || newPassword.length < 8) {
    throw new AppError('La nueva contraseña debe tener al menos 8 caracteres', 400);
  }

  const isOwn  = requestUser.sub === parseInt(targetId, 10);
  const isAdmin = requestUser.roles?.includes('ADMINISTRADOR') ?? false;

  if (!isOwn && !isAdmin) {
    throw new AppError('No tienes permisos para cambiar esta contraseña', 403);
  }

  const usuario = await repo.findByIdWithPassword(targetId);
  if (!usuario) throw new AppError(`Usuario con ID ${targetId} no encontrado`, 404);

  // El propio usuario SIEMPRE debe confirmar su contraseña actual, incluso si es admin
  if (isOwn) {
    if (!currentPassword) {
      throw new AppError('La contraseña actual es requerida', 400);
    }
    const match = await bcrypt.compare(currentPassword, usuario.contrasena);
    if (!match) throw new AppError('La contraseña actual es incorrecta', 401);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await repo.updatePassword(targetId, hashed);
};

export const actualizarRoles = async (targetId, roles) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new AppError('Se debe proporcionar al menos un rol en el array', 400);
  }

  const usuario = await repo.findById(targetId);
  if (!usuario) throw new AppError(`Usuario con ID ${targetId} no encontrado`, 404);

  const encontrados = await repo.findRolesByNombres(roles);
  if (encontrados.length !== roles.length) {
    const validos   = encontrados.map((r) => r.nombrerol);
    const invalidos = roles
      .map((r) => r.toUpperCase().trim())
      .filter((r) => !validos.includes(r));
    throw new AppError(`Los siguientes roles no existen: ${invalidos.join(', ')}`, 400);
  }

  await repo.replaceRoles(parseInt(targetId, 10), encontrados.map((r) => r.rolid));

  return { id: parseInt(targetId, 10), roles: encontrados.map((r) => r.nombrerol) };
};

export const eliminarUsuario = async (targetId, requesterId) => {
  if (parseInt(targetId, 10) === requesterId) {
    throw new AppError('No puedes eliminar tu propia cuenta', 400);
  }
  const eliminado = await repo.deleteById(targetId);
  if (!eliminado) throw new AppError(`Usuario con ID ${targetId} no encontrado`, 404);
  return eliminado;
};
