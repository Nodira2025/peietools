import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users as UsersIcon, ShieldAlert, Edit, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Zap } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string;
  whatsapp: string | null;
  photo_url?: string | null;
  active: boolean;
  user_passwords?: { clear_password: string } | { clear_password: string }[] | null;
}

export default function Usuarios() {
  const { profile, checkUser } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [elevating, setElevating] = useState(false);
  const { toast } = useToast();

  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [role, setRole] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const getRoleLabel = (roleName: string) => {
    switch (roleName?.toLowerCase()) {
      case 'admin': return 'Administrador';
      case 'solicitante': return 'Coordinador';
      case 'logistica': return 'Logística';
      default: return roleName;
    }
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*, user_passwords(clear_password)').order('full_name');
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los usuarios' });
    } else {
      setUsuarios(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleEdit = (user: Profile) => {
    setSelectedUser(user);
    setRole(user.role);
    setWhatsapp(user.whatsapp || '');
    setFullName(user.full_name || '');
    setEmail(user.username || ''); // Cargamos el username actual
    setPassword(''); // No cargamos la contraseña por seguridad
    setIsActive(user.active);
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);

    try {
      // Usamos la nueva función RPC para actualizar datos sensibles (auth.users) y perfil
      const { error } = await supabase.rpc('admin_update_user', {
        p_user_id: selectedUser.id,
        p_new_username: email, // El campo 'email' actúa como username
        p_new_password: password || null, // Solo se cambia si se escribe algo
        p_new_full_name: fullName,
        p_new_role: role,
        p_new_whatsapp: whatsapp
      });

      if (error) throw error;

      toast({ title: 'Éxito', description: 'Usuario actualizado correctamente' });
      setIsDialogOpen(false);
      fetchUsuarios();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Usamos la nueva función RPC para crear el usuario con confirmación automática
      const { data: newUserId, error } = await supabase.rpc('admin_create_user', {
        p_username: email, // Usamos el campo 'email' como username
        p_password: password,
        p_full_name: fullName,
        p_role: role,
        p_whatsapp: whatsapp
      });

      if (error) throw error;

      toast({ 
        title: 'Usuario Creado', 
        description: `Se ha registrado a ${fullName} correctamente. Ya puede ingresar.` 
      });
      setIsCreateDialogOpen(false);
      fetchUsuarios();
      
      // Limpiar campos
      setEmail(''); setPassword(''); setFullName(''); setWhatsapp(''); setRole('solicitante');
      
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al crear usuario', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoElevate = async () => {
    if (!profile) return;
    setElevating(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', profile.id);

    setElevating(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error al elevar permisos', description: error.message });
    } else {
      toast({ title: '¡Permisos de Administrador Concedidos!', description: 'Ahora posees control total del sistema.' });
      await checkUser(); // Refrescar el perfil local al instante
      fetchUsuarios();
    }
  };

  return (
    <div className="space-y-6 pb-safe">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-peie-blue">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los roles y contactos del personal.</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-peie-blue hover:bg-peie-blue/90 text-white rounded-xl shadow-md flex items-center gap-2">
                <UsersIcon size={18} />
                <span>Nuevo Usuario</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Completa los datos para registrar un nuevo usuario en el sistema.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="createFullName">Nombre Completo</Label>
                  <Input id="createFullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Ej: Juan Pérez" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createEmail">Nombre de Usuario (ej: juan)</Label>
                  <Input id="createEmail" value={email} onChange={e => setEmail(e.target.value)} required placeholder="juan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createPassword">Contraseña</Label>
                  <Input id="createPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="min. 6 caracteres" />
                </div>
                <div className="space-y-2">
                  <Label>Rol Inicial</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="solicitante">Coordinador</SelectItem>
                      <SelectItem value="logistica">Logística</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createWhatsapp">WhatsApp</Label>
                  <Input id="createWhatsapp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="549XXXXXXXXXX" />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-peie-blue hover:bg-peie-blue/90">
                  {loading ? 'Creando...' : 'Registrar Usuario'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* BOTÓN DISCRETO PARA QUE TE CONVIERTAS EN ADMIN SI ESTÁS CON OTRO USUARIO */}
        {profile && profile.role !== 'admin' && (
          <Button 
            onClick={handleAutoElevate} 
            disabled={elevating}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md flex items-center gap-2 animate-bounce"
          >
            <Zap size={16} className="fill-white" />
            <span>{elevating ? 'Concediendo...' : 'Convertirme en Admin Maestro'}</span>
          </Button>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario: {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>
              Modifica los permisos o datos de contacto del usuario seleccionado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Rol del Usuario</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="solicitante">Coordinador</SelectItem>
                  <SelectItem value="logistica">Logística</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario (para ingresar)</Label>
              <Input 
                id="username" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Ej: franco"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nueva Contraseña (dejar en blanco para no cambiar)</Label>
              <Input 
                id="password" 
                type="password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre Completo</Label>
              <Input 
                id="fullName" 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                placeholder="Nombre y Apellido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número de WhatsApp (con código de país, ej: 54911...)</Label>
              <Input 
                id="whatsapp" 
                value={whatsapp} 
                onChange={e => setWhatsapp(e.target.value)} 
                placeholder="549XXXXXXXXXX"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="active" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-peie-blue focus:ring-peie-blue"
              />
              <Label htmlFor="active">Usuario Activo</Label>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-peie-blue hover:bg-peie-blue/90">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando usuarios...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usuarios.map(user => (
            <Card key={user.id} className="relative">
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center space-x-3">
                  {user.photo_url ? (
                    <img 
                      src={user.photo_url} 
                      alt={user.full_name || ''} 
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-peie-blue/20 shadow-sm"
                      onError={(e) => {
                        // Fallback discreto si no encuentra el archivo jpg customizado
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className={`p-2 rounded-xl ${user.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-peie-light/10 text-peie-blue'}`}>
                      {user.role === 'admin' ? <ShieldAlert className="h-5 w-5" /> : <UsersIcon className="h-5 w-5" />}
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">{user.full_name || 'Sin nombre'}</CardTitle>
                    <span className="text-[10px] font-mono text-slate-400 capitalize">{getRoleLabel(user.role)}</span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-peie-blue -mr-2 -mt-2"
                  onClick={() => handleEdit(user)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="text-sm space-y-1 mt-2 text-muted-foreground">
                <p className="capitalize"><strong>Rol:</strong> <span className="font-medium text-foreground">{getRoleLabel(user.role)}</span></p>
                <p><strong>WhatsApp:</strong> {user.whatsapp || 'No configurado'}</p>
                <p><strong>Estado:</strong> {user.active ? <span className="text-green-600 font-medium">Activo</span> : <span className="text-red-500 font-medium">Inactivo</span>}</p>
                
                {(() => {
                  const clearPassword = Array.isArray(user.user_passwords)
                    ? user.user_passwords[0]?.clear_password
                    : (user.user_passwords as any)?.clear_password;
                  
                  return (
                    <p className="flex items-center gap-1.5">
                      <strong>Contraseña:</strong> 
                      <span className="font-mono text-foreground font-medium">
                        {clearPassword ? (visiblePasswords[user.id] ? clearPassword : '••••••••') : 'Desconocida'}
                      </span>
                      {clearPassword && (
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-slate-400 hover:text-peie-blue p-0.5 ml-1 transition-colors flex items-center justify-center"
                          type="button"
                          title={visiblePasswords[user.id] ? "Ocultar Contraseña" : "Mostrar Contraseña"}
                        >
                          {visiblePasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
