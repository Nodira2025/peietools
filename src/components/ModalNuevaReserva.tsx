import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { crearReservaHerramienta, verificarDisponibilidadHerramienta } from '../lib/reservasService';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Wrench, Building2, User } from 'lucide-react';

interface ModalNuevaReservaProps {
  isOpen: boolean;
  onClose: () => void;
  herramientaId?: string;
  herramientaNombre?: string;
  onReservaCreada?: () => void;
}

interface HerramientaOpt {
  id: string;
  name: string;
  code: string;
}

interface ObraOpt {
  id: string;
  name: string;
}

interface ProfileOpt {
  id: string;
  full_name: string;
}

export function ModalNuevaReserva({
  isOpen,
  onClose,
  herramientaId,
  herramientaNombre,
  onReservaCreada,
}: ModalNuevaReservaProps) {
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [selectedHerramientaId, setSelectedHerramientaId] = useState(herramientaId || '');
  const [herramientas, setHerramientas] = useState<HerramientaOpt[]>([]);
  const [obras, setObras] = useState<ObraOpt[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);

  const [obraId, setObraId] = useState('');
  const [poseedorActualId, setPoseedorActualId] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [notas, setNotas] = useState('');

  const [verificando, setVerificando] = useState(false);
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      cargarOpciones();
      if (herramientaId) {
        setSelectedHerramientaId(herramientaId);
      }
      // Set default dates: inicio = mañana a las 08:00, fin = pasado mañana a las 18:00
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      manana.setHours(8, 0, 0, 0);

      const fin = new Date(manana);
      fin.setDate(fin.getDate() + 2);
      fin.setHours(18, 0, 0, 0);

      setFechaInicio(manana.toISOString().slice(0, 16));
      setFechaFin(fin.toISOString().slice(0, 16));
      setDisponible(null);
    }
  }, [isOpen, herramientaId]);

  const cargarOpciones = async () => {
    try {
      const [resH, resO, resP] = await Promise.all([
        supabase.from('herramientas').select('id, name, code').order('name'),
        supabase.from('obras').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').order('full_name'),
      ]);

      if (resH.data) setHerramientas(resH.data);
      if (resO.data) setObras(resO.data);
      if (resP.data) setProfiles(resP.data);
    } catch (e) {
      console.error('Error cargando listas para reserva:', e);
    }
  };

  const handleVerificarDisponibilidad = async () => {
    const targetTool = selectedHerramientaId || herramientaId;
    if (!targetTool || !fechaInicio || !fechaFin) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor selecciona la herramienta y las fechas de inicio y fin.',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      toast({
        title: 'Fechas inválidas',
        description: 'La fecha de fin debe ser posterior a la fecha de inicio.',
        variant: 'destructive',
      });
      return;
    }

    setVerificando(true);
    try {
      const estaLibre = await verificarDisponibilidadHerramienta(targetTool, fechaInicio, fechaFin);
      setDisponible(estaLibre);
      if (estaLibre) {
        toast({
          title: 'Fechas Disponibles',
          description: 'La herramienta está libre en el rango seleccionado.',
        });
      } else {
        toast({
          title: 'Fechas Ocupadas',
          description: 'Ya existe una reserva confirmada para este equipo en el rango de fechas.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerificando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTool = selectedHerramientaId || herramientaId;

    if (!profile) {
      toast({ title: 'Error de usuario', description: 'Sesión no iniciada.', variant: 'destructive' });
      return;
    }

    if (!targetTool || !fechaInicio || !fechaFin) {
      toast({ title: 'Faltan datos', description: 'Por favor completá los campos obligatorios.', variant: 'destructive' });
      return;
    }

    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      toast({ title: 'Error en fechas', description: 'La fecha de fin debe ser posterior a la de inicio.', variant: 'destructive' });
      return;
    }

    setGuardando(true);
    try {
      const res = await crearReservaHerramienta({
        herramienta_id: targetTool,
        solicitante_id: profile.id,
        poseedor_actual_id: poseedorActualId || null,
        obra_id: obraId || null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        notas,
      });

      if (res.success) {
        toast({
          title: '¡Reserva Agendada con Éxito!',
          description: 'Se notificará al solicitante, a logística y al poseedor de la herramienta.',
        });
        if (onReservaCreada) onReservaCreada();
        onClose();
      } else {
        toast({
          title: 'No se pudo reservar',
          description: res.message || 'La herramienta no está disponible en las fechas indicadas.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: 'Error inesperado',
        description: e.message || 'No se pudo guardar la reserva.',
        variant: 'destructive',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl w-[95%] max-w-lg bg-white border-slate-100 shadow-xl overflow-hidden p-6">
        <DialogHeader className="space-y-1 text-left pb-2 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Reservar Herramienta por Fecha
          </DialogTitle>
          {herramientaNombre && (
            <p className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full w-fit">
              {herramientaNombre}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {!herramientaId && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-400" /> Herramienta *
              </Label>
              <select
                value={selectedHerramientaId}
                onChange={(e) => {
                  setSelectedHerramientaId(e.target.value);
                  setDisponible(null);
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              >
                <option value="">Seleccionar herramienta...</option>
                {herramientas.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} - {h.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Fecha y Hora Inicio *
              </Label>
              <Input
                type="datetime-local"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setDisponible(null);
                }}
                className="rounded-xl border-slate-200 bg-slate-50 text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Fecha y Hora Fin *
              </Label>
              <Input
                type="datetime-local"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setDisponible(null);
                }}
                className="rounded-xl border-slate-200 bg-slate-50 text-sm"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVerificarDisponibilidad}
              disabled={verificando}
              className="rounded-xl text-xs border-amber-200 hover:bg-amber-50 text-amber-700 font-medium"
            >
              {verificando ? 'Verificando...' : 'Comprobar Disponibilidad'}
            </Button>
          </div>

          {disponible === true && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Las fechas seleccionadas están disponibles para esta herramienta.
            </div>
          )}

          {disponible === false && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ¡Conflicto! La herramienta ya posee una reserva activa en ese período.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Obra Destino
              </Label>
              <select
                value={obraId}
                onChange={(e) => setObraId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">Seleccionar obra...</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Poseedor Actual (Afectado)
              </Label>
              <select
                value={poseedorActualId}
                onChange={(e) => setPoseedorActualId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              >
                <option value="">Quien la tiene actualmente...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Notas / Motivo de la Reserva</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Trabajos en altura en sector Norte..."
              className="rounded-xl border-slate-200 bg-slate-50 text-sm min-h-[70px]"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-xl text-slate-600 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando || disponible === false}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs px-5 shadow-sm"
            >
              {guardando ? 'Reservando...' : 'Confirmar Reserva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
