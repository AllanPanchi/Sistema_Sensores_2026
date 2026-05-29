import { ok } from '../../utils/response.js';
import * as authService from './auth.service.js';

export const login = async (req, res, next) => {
  try {
    const { correo, password } = req.body;
    const data = await authService.login(correo, password);
    ok(res, 'Login exitoso', data);
  } catch (err) {
    next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    ok(res, 'Usuario registrado exitosamente', data, 201);
  } catch (err) {
    next(err);
  }
};
