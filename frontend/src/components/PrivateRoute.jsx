import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, roles = [] }) {
  const { user, hasRole } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
