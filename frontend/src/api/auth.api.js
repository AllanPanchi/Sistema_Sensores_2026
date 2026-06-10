import http from './http';

export const login = (correo, password) =>
  http.post('/auth/login', { correo, password });

export const register = (data) =>
  http.post('/auth/register', data);
