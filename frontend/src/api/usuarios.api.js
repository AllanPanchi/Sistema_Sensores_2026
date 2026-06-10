import http from './http';

export const getUsuarios  = ()        => http.get('/usuarios');
export const getPerfil    = ()        => http.get('/usuarios/perfil');
export const getRoles     = ()        => http.get('/usuarios/roles');
export const getUsuario   = (id)      => http.get(`/usuarios/${id}`);
export const updateUsuario = (id, data) => http.put(`/usuarios/${id}`, data);
export const updatePassword = (id, data) => http.put(`/usuarios/${id}/password`, data);
export const updateRoles  = (id, roles) => http.put(`/usuarios/${id}/roles`, { roles });
export const deleteUsuario = (id)     => http.delete(`/usuarios/${id}`);
