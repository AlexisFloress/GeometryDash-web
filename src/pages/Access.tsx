import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, json } from '../lib/api';
import { useAuth } from '../auth';
import type { Session, User } from '../types';
import { ErrorBox } from '../components';

export function Access({ register = false }: { register?: boolean }) {
  const auth = useAuth(); const location = useLocation(); const navigate = useNavigate();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null); const [created, setCreated] = useState(false);
  return <section className="access panel"><h1>{register ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h1><p className="muted">{register ? '' : ''}</p>{created && <div className="notice" role="status">Cuenta creada. Inicia sesión para continuar.</div>}{!!error && <ErrorBox error={error}/>}
  <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); const form = new FormData(e.currentTarget); const email = String(form.get('email')); const password = String(form.get('password'));
    try {
      if (register) { if (password !== form.get('confirm')) throw new Error('Las contraseñas no coinciden.'); await api('/auth/register', json('POST', { userName: form.get('userName'), displayName: form.get('displayName'), email, password }), false); setCreated(true); navigate('/login', { replace: true, state: { created: true } }); }
      else { const session = await api<Session>('/auth/login', json('POST', { email, password }), false); auth.update(session); const from = location.state?.from; navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/my/levels', { replace: true }); }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }}>{register && <><label>Nombre de usuario<input name="userName" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.@+-]+" autoComplete="username" required/></label><label>Nombre visible<input name="displayName" minLength={1} maxLength={60} autoComplete="nickname" required/></label></>}<label>Correo<input name="email" type="email" maxLength={254} autoComplete="email" required/></label><label>Contraseña<input name="password" type="password" minLength={register ? 10 : 1} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} required/></label>{register && <><small>De 10 a 128 caracteres, con mayúscula, minúscula y número.</small><label>Confirmar contraseña<input name="confirm" type="password" autoComplete="new-password" required/></label></>}{location.state?.created && <p role="status">Tu cuenta está lista. Ya puedes entrar.</p>}<button disabled={busy} type="submit">{busy ? 'Enviando…' : register ? 'Crear cuenta' : 'Iniciar sesión'} →</button></form><p>{register ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'} <Link to={register ? '/login' : '/register'}>{register ? 'Inicia sesión' : 'Regístrate'}</Link></p></section>;
}
export function Account() {
  const { session, update, logout } = useAuth(); const [error, setError] = useState<unknown>(null); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  return <section className="access panel"><h1>Mi cuenta</h1><p>{session?.user.email}</p>{!!error && <ErrorBox error={error}/>}<form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(null); setSaved(false); try { const user = await api<User>('/me', json('PATCH', { displayName: new FormData(e.currentTarget).get('displayName') })); if (session) update({ ...session, user }); setSaved(true); } catch (err) { setError(err); } finally { setBusy(false); } }}><label>Nombre visible<input name="displayName" defaultValue={session?.user.displayName} maxLength={60} required/></label><button disabled={busy}>Guardar nombre</button></form>{saved && <p role="status">Nombre actualizado.</p>}<hr/><button className="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await logout(); } catch (err) { setError(err); } finally { setBusy(false); } }}>Cerrar sesión</button></section>;
}
