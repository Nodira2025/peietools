import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { 
  ArrowLeft, 
  Wrench, 
  Building, 
  User, 
  FileText, 
  Send, 
  MessageCircle, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { buildWhatsAppLink } from '../lib/whatsapp';

interface Obra {
  id: string;
  name: string;
  encargado_name?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  whatsapp?: string | null;
}

export default function NuevoReporteObra() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [obras, setObras] = useState<Obra[]>([]);
  const [coordinadores, setCoordinadores] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedObraId, setSelectedObraId] = useState('');
  const [selectedCoordinadorId, setSelectedCoordinadorId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [tipoAccion, setTipoAccion] = useState<'reparacion_carga' | 'mantenimiento' | 'ingreso' | 'entrega' | 'otro'>('reparacion_carga');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // Fetch active obras
      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('id, name, encargado_name')
        .eq('active', true)
        .order('name');

      if (obrasError) throw obrasError;
      setObras(obrasData || []);

      // Fetch coordinators / profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, whatsapp')
        .order('full_name');

      if (profilesError) throw profilesError;
      setCoordinadores(profilesData || []);
    } catch (err: any) {
      console.error('Error al cargar datos:', err);
      toast({
        variant: 'destructive',
        title: 'Error de carga',
        description: 'No se pudieron cargar las obras y coordinadores.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-select coordinator if obra matches encargado_name
  const handleObraChange = (obraId: string) => {
    setSelectedObraId(obraId);
    const selectedObra = obras.find((o) => o.id === obraId);
    if (selectedObra?.encargado_name) {
      const matchedProfile = coordinadores.find(
        (c) => c.full_name?.toLowerCase().includes(selectedObra.encargado_name!.toLowerCase())
      );
      if (matchedProfile) {
        setSelectedCoordinadorId(matchedProfile.id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedObraId) {
      toast({ variant: 'destructive', title: 'Obra requerida', description: 'Por favor, seleccioná una obra.' });
      return;
    }
    if (!itemDescription.trim()) {
      toast({ variant: 'destructive', title: 'Descripción requerida', description: 'Por favor, indicá el detalle de los ítems (ej: 2 garrafas chicas).' });
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        created_by: profile?.id || null,
        creator_role: profile?.role || 'logistica',
        obra_id: selectedObraId,
        coordinador_id: selectedCoordinadorId || null,
        item_description: itemDescription.trim(),
        tipo_accion: tipoAccion,
        estado: 'Pendiente',
        observaciones: observaciones.trim() || null,
      };

      const { data, error } = await supabase
        .from('reportes_novedades_obra')
        .insert([payload])
        .select()
        .single();

      if (error) {
        // En caso de que la tabla aún no exista en Supabase online, notificar al usuario con fallback
        console.error('Error insertando reporte:', error);
        throw error;
      }

      const obraObj = obras.find((o) => o.id === selectedObraId);
      const coordObj = coordinadores.find((c) => c.id === selectedCoordinadorId);

      toast({
        title: 'Reporte Creado con Éxito',
        description: `Se registró el reporte para la obra ${obraObj?.name || ''}.`,
      });

      // Opción de notificar por WhatsApp a Administración
      const adminWhatsApp = '5493816654321'; // Ejemplo / Número predeterminado de administración
      const msgText = `📋 *NUEVO REPORTE DE LOGÍSTICA / OBRA*\n\n` +
        `🏗 *Obra:* ${obraObj?.name || 'No especificada'}\n` +
        `👤 *Coordinador:* ${coordObj?.full_name || obraObj?.encargado_name || 'No especificado'}\n` +
        `📦 *Ítems / Novedad:* ${itemDescription}\n` +
        `🛠 *Tipo:* ${tipoAccion === 'reparacion_carga' ? 'Arreglo y Carga' : tipoAccion.toUpperCase()}\n` +
        `📝 *Notas:* ${observaciones || 'Sin observaciones'}\n` +
        `🧑‍💻 *Registrado por:* ${profile?.full_name || 'Logística'}`;

      const waLink = buildWhatsAppLink(adminWhatsApp, msgText);

      // Redigir a la lista de reportes
      navigate('/reportes-novedades-obra', { state: { waLink, msgText } });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Atención',
        description: 'Se requiere ejecutar la migración SQL en Supabase (`migracion_reportes_novedades_obra.sql`). ' + (err.message || ''),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <span className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
          Emisor: {profile?.role === 'solicitante' ? 'Coordinador' : profile?.role === 'admin' ? 'Administrador' : 'Logística'}
        </span>
      </div>

      <Card className="border-t-4 border-t-amber-500 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Nuevo Reporte de Obra / Reparaciones</CardTitle>
              <CardDescription>
                Registrá entrega de herramientas, cargas o mantenimientos (ej: 2 garrafas chicas para arreglar).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Seleccionar Obra */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold">
                <Building className="h-4 w-4 text-slate-500" /> Obra Destino / Origen *
              </Label>
              <Select value={selectedObraId} onValueChange={handleObraChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná la obra (ej: Cantares)" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.name} {obra.encargado_name ? `(Coord: ${obra.encargado_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Coordinador a cargo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold">
                <User className="h-4 w-4 text-slate-500" /> Coordinador a Cargo
              </Label>
              <Select value={selectedCoordinadorId} onValueChange={setSelectedCoordinadorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná o confirmá el coordinador (ej: Franco Lobo)" />
                </SelectTrigger>
                <SelectContent>
                  {coordinadores.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.full_name || coord.email} {coord.role ? `(${coord.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Trabajo / Acción */}
            <div className="space-y-2">
              <Label className="font-semibold">Tipo de Novedad / Trabajo</Label>
              <Select
                value={tipoAccion}
                onValueChange={(val: any) => setTipoAccion(val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reparacion_carga">🔧 Reparación y Carga (ej: Garrafas, herramientas)</SelectItem>
                  <SelectItem value="mantenimiento">🛠 Mantenimiento preventivo / correctivo</SelectItem>
                  <SelectItem value="ingreso">📦 Ingreso / Recepción de Insumos</SelectItem>
                  <SelectItem value="entrega">🚚 Entrega en Obra</SelectItem>
                  <SelectItem value="otro">📋 Otro / General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descripción del item */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold">
                <FileText className="h-4 w-4 text-slate-500" /> Detalle de los Ítems / Equipos *
              </Label>
              <Textarea
                placeholder="Ej: Me entregaron el viernes 2 garrafas chicas para arreglar y cargar."
                rows={3}
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
            </div>

            {/* Observaciones adicionales */}
            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Observaciones o Instrucciones Adicionales</Label>
              <Textarea
                placeholder="Detalles sobre tiempos de entrega, proveedor o urgencia..."
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium"
              >
                {submitting ? 'Guardando...' : <><Send className="h-4 w-4" /> Registrar Reporte</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
