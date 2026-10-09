import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import './Login.css';

type DeviceMode = 'auto' | 'mobile' | 'desktop';

export default function Login() {
  const { user, profile } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('auto');
  const { toast } = useToast();

  if (user && profile) return <Navigate to="/bienvenida" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const cleanUser = username.toLowerCase().trim();
    const loginEmail = cleanUser.includes('@') ? cleanUser : `${cleanUser}@peie.com`;
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      localStorage.setItem('login_device_mode', deviceMode);
      await useAuthStore.getState().checkUser();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión. Intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description: message === 'Invalid login credentials'
          ? 'El usuario o la contraseña son incorrectos. Por favor, verifica tus datos.'
          : message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="peie-login">
      <div className="peie-login__shell">
        <aside className="peie-login__story" aria-label="Gestión de obras PEIE">
          <div className="peie-login__story-copy">
            <p className="peie-login__eyebrow">Gestión de obras</p>
            <h2>Tu equipo.<br />Tus obras.<br />Todo conectado.</h2>
            <p>Personas, herramientas y operaciones<br className="peie-login__wide-break" /> en un mismo lugar.</p>
          </div>
        </aside>

        <section className="peie-login__access" aria-labelledby="login-title">
          <img className="peie-login__logo" src="/logo-peie.png" alt="PEIE" width="400" height="225" />
          <div className="peie-login__mobile-banner" aria-hidden="true">
            <p>Todo listo<br />para empezar.</p>
          </div>
          <header className="peie-login__heading">
            <p className="peie-login__eyebrow">Acceso al sistema</p>
            <h1 id="login-title">Bienvenido a PEIE</h1>
            <p>Ingresá con tu usuario y contraseña.</p>
          </header>

          <form className="peie-login__form" onSubmit={handleLogin} aria-busy={loading}>
            <div className="peie-login__field">
              <label htmlFor="username">Usuario</label>
              <div className="peie-login__input-wrap">
                <UserRound size={20} aria-hidden="true" />
                <input id="username" name="username" type="text" placeholder="Tu usuario"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none" autoComplete="username" autoCorrect="off" spellCheck={false} required />
              </div>
            </div>
            <div className="peie-login__field">
              <label htmlFor="password">Contraseña</label>
              <div className="peie-login__input-wrap">
                <LockKeyhole size={20} aria-hidden="true" />
                <input id="password" name="password" type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required />
                <button className="peie-login__visibility" type="button"
                  onClick={() => setShowPassword(!showPassword)} aria-controls="password"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
            </div>
            <button className="peie-login__submit" type="submit" disabled={loading}>
              <span role="status">{loading ? 'Verificando...' : 'Ingresar'}</span>
              {loading ? <LoaderCircle className="animate-spin" size={21} aria-hidden="true" /> : <ArrowRight size={22} aria-hidden="true" />}
            </button>
            <a className="peie-login__recovery"
              href="https://wa.me/5493814015738?text=Hola,%20olvid%C3%A9%20mi%20contrase%C3%B1a%20de%20PEIE%20Tools"
              target="_blank" rel="noopener noreferrer">¿Olvidaste tu contraseña?</a>
          </form>

          <footer className="peie-login__footer">
            <div className="peie-login__view">
              <label htmlFor="deviceMode">Vista:</label>
              <select id="deviceMode" value={deviceMode} onChange={(e) => setDeviceMode(e.target.value as DeviceMode)}>
                <option value="auto">Automática</option>
                <option value="mobile">Celular / Móvil</option>
                <option value="desktop">Computadora (PC)</option>
              </select>
            </div>
            <p>PEIE SRL · Centro de operaciones</p>
          </footer>
        </section>
      </div>
    </main>
  );
}
