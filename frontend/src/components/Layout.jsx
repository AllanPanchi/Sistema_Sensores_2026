import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavItem({ to, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function HamburgerIcon() {
  return (
    <div className="flex flex-col gap-1.5 w-5">
      <span className="block h-0.5 bg-current rounded" />
      <span className="block h-0.5 bg-current rounded" />
      <span className="block h-0.5 bg-current rounded" />
    </div>
  );
}

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cierra el sidebar al navegar (útil en móvil)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Backdrop móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-60 bg-slate-800 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:z-auto md:shrink-0
        `}
      >
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">HidroSentinel</h1>
            <p className="text-slate-400 text-xs mt-0.5">Sistema de Monitoreo</p>
          </div>
          {/* Botón cerrar — solo móvil */}
          <button
            onClick={closeSidebar}
            className="text-slate-400 hover:text-white text-xl leading-none md:hidden"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavItem to="/dashboard" onNavigate={closeSidebar}>Dashboard</NavItem>
          <NavItem to="/boyas" onNavigate={closeSidebar}>Boyas y Sensores</NavItem>
          {hasRole('ADMINISTRADOR') && (
            <NavItem to="/usuarios" onNavigate={closeSidebar}>Usuarios</NavItem>
          )}
          <NavItem to="/perfil" onNavigate={closeSidebar}>Mi Perfil</NavItem>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <p className="text-white text-sm font-medium truncate">
            {user?.nombre} {user?.apellido}
          </p>
          <p className="text-slate-400 text-xs mt-0.5 truncate">
            {user?.roles?.join(', ')}
          </p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar móvil */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Abrir menú"
          >
            <HamburgerIcon />
          </button>
          <span className="font-semibold text-slate-800 text-sm">HidroSentinel</span>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
