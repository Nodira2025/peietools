import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users as UsersIcon, ShieldAlert, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  const [isActive, setIsActive] = useState(true);

  const fetchUsuarios = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
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
    setIsActive(user.active);
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({ 
        role, 
        whatsapp, 
        full_name: fullName, 
        active: isActive 
      })
      .eq('id', selectedUser.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Usuario actualizado' });
      setIsDialogOpen(false);
      fetchUsuarios();
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
                  <SelectItem value="solicitante">Solicitante</SelectItem>
                  <SelectItem value="logistica">Logística</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" className="w-full bg-peie-blue hover:bg-peie-blue/90">Guardar Cambios</Button>
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
                    <span className="text-[10px] font-mono text-slate-400 capitalize">{user.role}</span>
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
                <p className="capitalize"><strong>Rol:</strong> <span className="font-medium text-foreground">{user.role}</span></p>
                <p><strong>WhatsApp:</strong> {user.whatsapp || 'No configurado'}</p>
                <p><strong>Estado:</strong> {user.active ? <span className="text-green-600 font-medium">Activo</span> : <span className="text-red-500 font-medium">Inactivo</span>}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
