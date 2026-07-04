import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsuariosPage from './pages/UsuariosPage';
import BoyasPage from './pages/BoyasPage';
import TelemetriaPage from './pages/TelemetriaPage';
import PerfilPage from './pages/PerfilPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route
              path="usuarios"
              element={
                <PrivateRoute roles={['ADMINISTRADOR']}>
                  <UsuariosPage />
                </PrivateRoute>
              }
            />
            <Route path="boyas" element={<BoyasPage />} />
            <Route path="telemetria" element={<TelemetriaPage />} />
            <Route path="perfil" element={<PerfilPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
