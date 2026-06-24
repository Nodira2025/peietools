import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

export default function Login() {
  const { user, profile } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'auto' | 'mobile' | 'desktop'>('auto');
  const { toast } = useToast();

  if (user && profile) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Si el usuario no escribe el @peie.com, lo agregamos automáticamente por debajo
    const cleanUser = username.toLowerCase().trim();
    const loginEmail = cleanUser.includes('@') ? cleanUser : `${cleanUser}@peie.com`;
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) throw error;
      localStorage.setItem('login_device_mode', deviceMode);
      // Actualizar la sesión en el store de Zustand
      await useAuthStore.getState().checkUser();
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Acceso denegado",
        description: error.message === 'Invalid login credentials' 
          ? 'El usuario o la contraseña son incorrectos. Por favor, verifica tus datos.' 
          : error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center bg-gradient-to-br from-peie-bg via-white to-peie-light/10 p-4 pt-safe pb-safe">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        
        {/* Cabecera con Logo Oficial */}
        <div className="flex flex-col items-center justify-center mb-6 text-center">
          <div className="w-48 md:w-56 mb-2 relative drop-shadow-md transition-transform duration-300 hover:scale-105">
            <img 
              src="/logo-peie.png" 
              alt="PEIE Oficial" 
              className="w-full h-auto object-contain"
            />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-peie-blue/5 text-peie-blue border border-peie-blue/10">
            <Sparkles size={12} className="text-peie-light animate-pulse" />
            Trazabilidad de Herramientas
          </span>
        </div>

        {/* Tarjeta de Login Premium */}
        <Card className="shadow-2xl border-0 ring-1 ring-peie-blue/5 bg-white/80 backdrop-blur-md overflow-hidden rounded-2xl">
          <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
          
          <CardHeader className="space-y-1 pb-4 pt-6 px-6">
            <CardTitle className="text-2xl font-bold text-center text-peie-blue tracking-tight">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-center text-xs md:text-sm">
              Ingresa tus credenciales de acceso para continuar
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-peie-blue uppercase tracking-wider">
                  Usuario
                </Label>
                <Input 
                  id="username" 
                  type="text" 
                  placeholder="Usuario (ej: martin)" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect="off"
                  required
                  className="h-12 px-4 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-peie-light focus-visible:border-peie-light text-base shadow-sm transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-peie-blue uppercase tracking-wider">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-12 pl-4 pr-12 rounded-xl border-slate-200 bg-white/50 focus-visible:ring-peie-light focus-visible:border-peie-light text-base shadow-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-peie-blue transition-colors rounded-lg"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deviceMode" className="text-xs font-semibold text-peie-blue uppercase tracking-wider">
                  Modo de Vista (Dispositivo)
                </Label>
                <select 
                  id="deviceMode" 
                  value={deviceMode}
                  onChange={(e) => setDeviceMode(e.target.value as any)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-peie-light/20 text-slate-700 text-sm shadow-sm transition-all cursor-pointer"
                >
                  <option value="auto">📱💻 Automático (Adaptable)</option>
                  <option value="mobile">📱 Forzar Vista Celular / Móvil</option>
                  <option value="desktop">💻 Forzar Vista Computadora (PC)</option>
                </select>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 mt-2 rounded-xl bg-peie-blue hover:bg-peie-blue/90 active:scale-[0.98] text-white font-medium text-base shadow-md shadow-peie-blue/20 transition-all duration-200" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  'Ingresar al Sistema'
                )}
              </Button>

              <div className="text-center pt-2">
                <a 
                  href="https://wa.me/5493814015738?text=Hola,%20olvid%C3%A9%20mi%20contrase%C3%B1a%20de%20PEIE%20Tools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-peie-blue hover:underline font-semibold transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

            </form>
          </CardContent>

          <CardFooter className="py-4 px-6 bg-slate-50/50 border-t border-slate-100 flex justify-center text-center">
            <p className="text-xs text-slate-400">
              Desarrollado exclusivo para <span className="font-semibold text-slate-600">PEIE SRL</span>
            </p>
          </CardFooter>
        </Card>

      </div>
    </div>
  );
}
