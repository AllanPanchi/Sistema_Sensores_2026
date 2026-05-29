import { ok } from '../../utils/response.js';
import * as usuariosService from './usuarios.service.js';

export const listarUsuarios = async (req, res, next) => {
  try {
    const data = await usuariosService.listarUsuarios();
    ok(res, 'Usuarios obtenidos exitosamente', data);
  } catch (err) { next(err); }
};

export const listarRoles = async (req, res, next) => {
  try {
    const data = await usuariosService.listarRoles();
    ok(res, 'Roles obtenidos exitosamente', data);
  } catch (err) { next(err); }
};

export const obtenerPerfil = async (req, res, next) => {
  try {
    const data = await usuariosService.obtenerPerfil(req.user.sub);
    ok(res, 'Perfil obtenido exitosamente', data);
  } catch (err) { next(err); }
};

export const obtenerUsuario = async (req, res, next) => {
  try {
    const data = await usuariosService.obtenerUsuario(req.params.id);
    ok(res, 'Usuario obtenido exitosamente', data);
  } catch (err) { next(err); }
};

export const actualizarUsuario = async (req, res, next) => {
  try {
    const data = await usuariosService.actualizarUsuario(req.params.id, req.body);
    ok(res, 'Usuario actualizado exitosamente', data);
  } catch (err) { next(err); }
};

export const cambiarPassword = async (req, res, next) => {
  try {
    await usuariosService.cambiarPassword(req.params.id, req.user, req.body);
    ok(res, 'Contraseña actualizada exitosamente');
  } catch (err) { next(err); }
};

export const actualizarRoles = async (req, res, next) => {
  try {
    const data = await usuariosService.actualizarRoles(req.params.id, req.body.roles);
    ok(res, 'Roles actualizados exitosamente', data);
  } catch (err) { next(err); }
};

export const eliminarUsuario = async (req, res, next) => {
  try {
    await usuariosService.eliminarUsuario(req.params.id, req.user.sub);
    ok(res, 'Usuario eliminado exitosamente');
  } catch (err) { next(err); }
};
