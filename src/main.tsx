import React, { useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, NavLink, Outlet, RouterProvider, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, isAdmin, Private, useAuth } from './auth';
import Catalog from './pages/Catalog';
import { Access, Account } from './pages/Access';
import Details from './pages/Details';
import Library, { CreateLevel } from './pages/Library';
import Docs from './pages/Docs';
import Admin from './pages/Admin';
import Editor from './editor/Editor';
import GamePage from './game/Game';
import { errorText } from './lib/api';
import './style.css';

class ErrorBoundary extends React.Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Do not log user data or tokens. */ }
  render() { return this.state.error ? <main><h1>No se pudo mostrar esta pantalla.</h1><p>Si estabas editando, tu copia local se conserva cuando el almacenamiento está disponible.</p><a href="/">Volver al inicio</a></main> : this.props.children; }
}
function Layout() {
  const { session, ready } = useAuth(); const location = useLocation(); const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  useEffect(() => { window.scrollTo(0, 0); const names: Record<string, string> = { '/': 'Inicio', '/levels': 'Explorar', '/login': 'Entrar', '/register': 'Registro', '/docs/backend': 'Documentación' }; document.title = `${names[location.pathname] ?? 'Tu espacio'} · GeometryDash`; document.getElementById('main-content')?.focus(); }, [location.pathname]);
  return <><a className="skip-link" href="#main-content">Saltar al contenido</a><header className="site-header"><Link className="brand" to="/"><span>◈</span> GeometryDash</Link><nav aria-label="Principal"><NavLink to="/levels">Explorar</NavLink><NavLink to="/create">Crear</NavLink><NavLink to="/docs/backend">Documentación</NavLink>{session && <NavLink to="/my/levels">Mi biblioteca</NavLink>}{isAdmin(session) && <NavLink to="/admin">Administración</NavLink>}</nav><div className="account-nav">{!ready ? <span className="small">Sesión…</span> : session ? <NavLink to="/account" className="button secondary">{session.user.displayName}</NavLink> : <><Link to="/login">Entrar</Link><Link className="button" to="/register">Crear cuenta</Link></>}</div></header>{!online && <div className="offline" role="status">Sin conexión. Las partidas de práctica siguen disponibles; los cambios del editor se conservan localmente si hay almacenamiento.</div>}<main id="main-content" tabIndex={-1}><Outlet/></main><footer><Link className="brand" to="/">◈ GeometryDash</Link><span>Construye algo que valga otro intento.</span><Link to="/docs/backend">Guía y documentación</Link></footer></>;
}
function EditorRoute() { const { id } = useParams(); const { session } = useAuth(); return <Editor key={`${session?.user.id}:${id}`}/>; }
function RouterError() { return <main><h1>No se pudo abrir la página</h1><p>Vuelve al inicio e inténtalo otra vez.</p><a href="/">Inicio</a></main>; }
const router = createBrowserRouter([{ element: <AuthProvider><Layout/></AuthProvider>, errorElement: <RouterError/>, children: [
  { index: true, element: <Catalog home/> }, { path: 'levels', element: <Catalog/> }, { path: 'levels/:id', element: <Details/> },
  { path: 'login', element: <Access/> }, { path: 'register', element: <Access register/> },
  { path: 'account', element: <Private><Account/></Private> }, { path: 'create', element: <Private><CreateLevel/></Private> },
  { path: 'my/levels', element: <Private><Library key="levels" tab="levels"/></Private> }, { path: 'my/favorites', element: <Private><Library key="favorites" tab="favorites"/></Private> }, { path: 'my/completed', element: <Private><Library key="completed" tab="completed"/></Private> },
  { path: 'editor/:id', element: <Private><EditorRoute/></Private> }, { path: 'play/:id', element: <GamePage/> },
  { path: 'docs/backend', element: <Docs/> }, { path: 'admin', element: <Private><Admin/></Private> },
  { path: '*', element: <section className="empty"><h1>Ese recorrido no existe.</h1><Link to="/levels">Volver al catálogo</Link></section> },
]}]);
createRoot(document.getElementById('root')!).render(<ErrorBoundary><RouterProvider router={router}/></ErrorBoundary>);
