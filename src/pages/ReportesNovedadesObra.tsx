import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { 
  Plus, 
  Wrench, 
  Search, 
  Building, 
  User, 
  Calendar, 
  FileSpreadsheet, 
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ArrowLeft,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { buildWhatsAppLink } from '../lib/whatsapp';

interface ReporteItem {
  id: string;
  created_at: string;
  creator_role: string | null;
  item_description: string;
  tipo_accion: string;
  estado: string;
  observaciones: string | null;
  obras?: { id: string; name: string } | null;
  coordinador?: { id: string; full_name: string | null; email: string | null } | null;
  creador?: { id: string; full_name: string | null; role: string | null } | null;
}

export default function ReportesNovedadesObra() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [reportes, setReportes] = useState<ReporteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');

  // WhatsApp dialog state if passed from navigation
  const [waLink, setWaLink] = useState<string | null>(location.state?.waLink || null);

  useEffect(() => {
    fetchReportes();
  }, []);

  const fetchReportes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reportes_novedades_obra')
        .select(`
          *,
          obras (id, name),
          coordinador:profiles!reportes_novedades_obra_coordinador_id_fkey (id, full_name, email),
          creador:profiles!reportes_novedades_obra_created_by_fkey (id, full_name, role)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback si la relación foreign key tiene nombres genéricos
        const { data: fallbackData } = await supabase
          .from('reportes_novedades_obra')
          .select('*, obras(id, name)')
          .order('created_at', { ascending: false });

        setReportes(fallbackData || []);
      } else {
        setReportes(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching reportes_novedades_obra:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reportes_novedades_obra')
        .update({ estado: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Estado Actualizado',
        description: `El reporte cambió a estado "${newStatus}".`,
      });

      setReportes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado: newStatus } : r))
      );
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: err.message,
      });
    }
  };

  const exportToExcel = () => {
    if (reportes.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay reportes para exportar.' });
      return;
    }

    const exportData = filteredReportes.map((r) => ({
      Fecha: new Date(r.created_at).toLocaleDateString('es-AR'),
      Obra: r.obras?.name || 'S/D',
      Coordinador: r.coordinador?.full_name || 'S/D',
      Detalle: r.item_description,
      Tipo: r.tipo_accion,
      Estado: r.estado,
      CreadoPor: r.creador?.full_name || 'Logística',
      RolCreador: r.creator_role || 'logistica',
      Observaciones: r.observaciones || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reportes_Obra');
    XLSX.writeFile(wb, `Reportes_Novedades_Obra_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredReportes = reportes.filter((r) => {
    const matchSearch =
      r.item_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.obras?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.coordinador?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchEstado = filterEstado === 'todos' || r.estado === filterEstado;
    const matchTipo = filterTipo === 'todos' || r.tipo_accion === filterTipo;

    return matchSearch && matchEstado && matchTipo;
  });

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'Completado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'En Proceso':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300';
      case 'Cancelado':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Wrench className="h-6 w-6 text-amber-600" /> Novedades e Insumos de Obra
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-10">
            Seguimiento de entregas, reparaciones y cargas entre Logística, Coordinación y Administración.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToExcel} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Excel
          </Button>
          <Button
            onClick={() => navigate('/nuevo-reporte-obra')}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium"
          >
            <Plus className="h-4 w-4" /> Nuevo Reporte
          </Button>
        </div>
      </div>

      {/* Banner de notificación WhatsApp si acaba de crear */}
      {waLink && (
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-600 text-white rounded-full">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">
                  ¿Querés enviar un aviso inmediato a Administración por WhatsApp?
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  El reporte ya fue guardado en el sistema. Podés notificar al instante a Fede / Administración.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs">
                  <MessageCircle className="h-4 w-4" /> Enviar Aviso WhatsApp
                </Button>
              </a>
              <Button variant="ghost" size="sm" onClick={() => setWaLink(null)}>
                Descartar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por detalle (ej: garrafas), obra o coordinador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="En Proceso">En Proceso</SelectItem>
                <SelectItem value="Completado">Completado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Tipos</SelectItem>
                <SelectItem value="reparacion_carga">Arreglo y Carga</SelectItem>
                <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="entrega">Entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List / Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando reportes de obras...</div>
      ) : filteredReportes.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <Wrench className="h-12 w-12 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">No se encontraron reportes</p>
            <p className="text-sm text-slate-400">
              Registrá una nueva entrega o reparación usando el botón "Nuevo Reporte".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredReportes.map((reporte) => (
            <Card key={reporte.id} className="hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(reporte.created_at).toLocaleDateString('es-AR')} - {new Date(reporte.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-1">
                      <Building className="h-4 w-4 text-amber-600" />
                      {reporte.obras?.name || 'Obra Sin Especificar'}
                    </h3>
                  </div>

                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium border ${getStatusBadge(reporte.estado)}`}>
                    {reporte.estado}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border space-y-1">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    {reporte.tipo_accion === 'reparacion_carga' ? '🔧 Reparación y Carga' : reporte.tipo_accion}
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {reporte.item_description}
                  </p>
                  {reporte.observaciones && (
                    <p className="text-xs text-slate-500 italic pt-1">
                      "{reporte.observaciones}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Coord: <strong>{reporte.coordinador?.full_name || 'Sin asignar'}</strong></span>
                  </div>

                  {/* Acciones de cambio de estado para Admin y Logística */}
                  <div className="flex items-center gap-1">
                    <Select
                      value={reporte.estado}
                      onValueChange={(val) => handleUpdateStatus(reporte.id, val)}
                    >
                      <SelectTrigger className="h-7 text-xs w-28 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="En Proceso">En Proceso</SelectItem>
                        <SelectItem value="Completado">Completado</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
