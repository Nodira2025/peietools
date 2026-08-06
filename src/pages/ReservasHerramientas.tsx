import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { ModalNuevaReserva } from '../components/ModalNuevaReserva';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal';
import { buildWhatsAppLink } from '../lib/whatsapp';
import { 
  obtenerTodasLasReservas, 
  cancelarReservaHerramienta, 
  type ReservaHerramienta 
} from '../lib/reservasService';

import { 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  User, 
  Wrench, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  ArrowRight,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function ReservasHerramientas() {
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [reservas, setReservas] = useState<ReservaHerramienta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('todas');
  const [filterTab, setFilterTab] = useState<'todas' | 'mias' | 'proximas'>('todas');

  const [isModalOpen, setIsModalOpen] = useState(false);

  // WhatsApp modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPhone, setPreviewPhone] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewRecipientName, setPreviewRecipientName] = useState('');

  const isAdminOrLogistica = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    cargarReservas();
  }, []);

  const cargarReservas = async () => {
    setLoading(true);
    try {
      const data = await obtenerTodasLasReservas();
      setReservas(data);
    } catch (e) {
      console.error('Error cargando reservas:', e);
      toast({
        title: 'Error de carga',
        description: 'No se pudieron recuperar las reservas agendadas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarReserva = async (id: string) => {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;

    const ok = await cancelarReservaHerramienta(id);
    if (ok) {
      toast({ title: 'Reserva Cancelada', description: 'La reserva ha sido anulada con éxito.' });
      cargarReservas();
    } else {
      toast({ title: 'Error', description: 'No se pudo cancelar la reserva.', variant: 'destructive' });
    }
  };

  const handleAbrirWhatsAppAlert = (reserva: ReservaHerramienta, targetRole: 'solicitante' | 'poseedor') => {
    let phone = '';
    let recipient = '';
    const toolName = reserva.herramientas?.name || 'la herramienta';
    const startDate = new Date(reserva.fecha_inicio).toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (targetRole === 'solicitante') {
      phone = reserva.solicitante?.whatsapp || '';
      recipient = reserva.solicitante?.full_name || 'Solicitante';
    } else {
      phone = reserva.poseedor_actual?.whatsapp || '';
      recipient = reserva.poseedor_actual?.full_name || 'Poseedor Actual';
    }

    const msg = `Hola *${recipient}*, te recordamos que se aproxima la fecha pactada para la herramienta *${toolName}* el día *${startDate}*. Por favor coordinar el traspaso con Logística.`;

    setPreviewPhone(phone);
    setPreviewRecipientName(recipient);
    setPreviewMessage(msg);
    setIsPreviewOpen(true);
  };

  // Filtrado de lista
  const reservasFiltradas = reservas.filter((r) => {
    // Tab filter
    if (filterTab === 'mias' && r.solicitante_id !== profile?.id && r.poseedor_actual_id !== profile?.id) {
      return false;
    }

    if (filterTab === 'proximas') {
      const ahora = new Date().getTime();
      const inicio = new Date(r.fecha_inicio).getTime();
      const difHoras = (inicio - ahora) / (1000 * 60 * 60);
      // Próximas en las siguientes 48hs
      if (difHoras < 0 || difHoras > 48) return false;
    }

    // Estado filter
    if (filterEstado !== 'todas' && r.estado !== filterEstado) {
      return false;
    }

    // Search term filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchTool = r.herramientas?.name.toLowerCase().includes(term) || r.herramientas?.code.toLowerCase().includes(term);
      const matchSol = r.solicitante?.full_name.toLowerCase().includes(term);
      const matchPos = r.poseedor_actual?.full_name.toLowerCase().includes(term);
      const matchObra = r.obra?.name.toLowerCase().includes(term);

      return matchTool || matchSol || matchPos || matchObra;
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-amber-500" />
            Reserva de Herramientas
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Programación de préstamos con fechas asignadas y alertas a los 3 involucrados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={cargarReservas}
            disabled={loading}
            className="rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nueva Reserva
          </Button>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-fit border border-slate-200/60">
          <button
            onClick={() => setFilterTab('todas')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filterTab === 'todas'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todas las Reservas
          </button>
          <button
            onClick={() => setFilterTab('mias')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
              filterTab === 'mias'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Mis Reservas
          </button>
          <button
            onClick={() => setFilterTab('proximas')}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              filterTab === 'proximas'
                ? 'bg-amber-500 text-white shadow-sm font-semibold'
                : 'text-amber-700 hover:text-amber-900 bg-amber-50/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Próximas (24-48h)
          </button>
        </div>

        {/* Search & Select Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar herramienta, persona u obra..."
              className="pl-9 rounded-2xl border-slate-200 bg-white text-xs"
            />
          </div>

          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="h-9 px-3 rounded-2xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
          >
            <option value="todas">Todos los estados</option>
            <option value="confirmada">Confirmada</option>
            <option value="en_curso">En Curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Reservation Cards List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : reservasFiltradas.length === 0 ? (
        <Card className="rounded-3xl border-slate-100 shadow-sm p-8 text-center bg-white">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No se encontraron reservas</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || filterEstado !== 'todas'
              ? 'Probá ajustando los filtros de búsqueda.'
              : 'Todavía no hay reservas registradas. ¡Agendá la primera con el botón Nueva Reserva!'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservasFiltradas.map((res) => {
            const startDate = new Date(res.fecha_inicio).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });
            const endDate = new Date(res.fecha_fin).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card
                key={res.id}
                className="rounded-3xl border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3 border-b border-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {res.herramientas?.code || 'HERR'}
                        </span>
                        <BadgeEstado estado={res.estado} />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-800 mt-1.5">
                        {res.herramientas?.name || 'Herramienta'}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-3.5 text-xs text-slate-600 flex-1">
                  {/* Dates Range Box */}
                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl space-y-1 text-amber-900">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5 text-amber-800">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Período de Reserva
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <div>
                        <span className="text-amber-700 block text-[10px]">INICIO</span>
                        <span className="font-bold">{startDate}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div className="text-right">
                        <span className="text-amber-700 block text-[10px]">FIN</span>
                        <span className="font-bold">{endDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3 Involved Users */}
                  <div className="space-y-2 pt-1">
                    {/* Solicitante */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" /> Solicitante:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">
                          {res.solicitante?.full_name || 'Desconocido'}
                        </span>
                        {res.solicitante?.whatsapp && (
                          <button
                            onClick={() => handleAbrirWhatsAppAlert(res, 'solicitante')}
                            className="p-1 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Avisar por WhatsApp al solicitante"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Poseedor Actual (Afectado) */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-slate-400" /> Poseedor Actual:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">
                          {res.poseedor_actual?.full_name || 'Sin especificar'}
                        </span>
                        {res.poseedor_actual?.whatsapp && (
                          <button
                            onClick={() => handleAbrirWhatsAppAlert(res, 'poseedor')}
                            className="p-1 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Avisar por WhatsApp al poseedor"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Obra Destino */}
                    {res.obra && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" /> Obra Destino:
                        </span>
                        <span className="font-semibold text-slate-700">{res.obra.name}</span>
                      </div>
                    )}
                  </div>

                  {res.notas && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                      "{res.notas}"
                    </p>
                  )}
                </CardContent>

                <div className="p-4 pt-0 border-t border-slate-50 flex items-center justify-between gap-2 mt-auto">
                  {(isAdminOrLogistica || res.solicitante_id === profile?.id) && res.estado === 'confirmada' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelarReserva(res.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs"
                    >
                      Cancelar Reserva
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Crear Reserva */}
      <ModalNuevaReserva
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReservaCreada={cargarReservas}
      />

      {/* WhatsApp Modal Preview */}
      <WhatsAppPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        phone={previewPhone}
        message={previewMessage}
        recipientName={previewRecipientName}
        onConfirmSend={() => {
          const link = buildWhatsAppLink(previewPhone, previewMessage);
          window.open(link, '_blank');
          setIsPreviewOpen(false);
        }}
      />
    </div>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  switch (estado) {
    case 'confirmada':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmada
        </span>
      );
    case 'en_curso':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" /> En Curso
        </span>
      );
    case 'completada':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3 h-3 text-blue-600" /> Completada
        </span>
      );
    case 'cancelada':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          <XCircle className="w-3 h-3 text-slate-400" /> Cancelada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {estado}
        </span>
      );
  }
}
