import { createContext, useContext, useState, useCallback } from 'react';
import { login as apiLogin } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (correo, password) => {
    const { data: res } = await apiLogin(correo, password);
    const { token, usuario } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(usuario));
    setUser(usuario);
    return usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role) => user?.roles?.includes(role) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
