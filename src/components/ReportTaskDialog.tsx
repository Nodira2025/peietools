import { useEffect, useState } from 'react';
import { AlertTriangle, MessageCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import VoiceInputButton from './VoiceInputButton';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';

export default function ReportTaskDialog({ open: isReportOpen, onOpenChange: setIsReportOpen }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const [personCategory, setPersonCategory] = useState<'obra' | 'oficina'>('obra');
  const [oficinaProfiles, setOficinaProfiles] = useState<{id: string, full_name: string, role: string, whatsapp?: string | null}[]>([]);
  const [obraEmployees, setObraEmployees] = useState<{id: string, full_name: string, role: string, whatsapp?: string | null}[]>([]);
  const [allProfiles, setAllProfiles] = useState<{id: string, full_name: string, role: string, whatsapp?: string | null}[]>([]);
  const [reportPerson, setReportPerson] = useState('');
  const [reportRecipient, setReportRecipient] = useState('5493814015738'); // Default: Federico Grande
  const [reportTarea, setReportTarea] = useState('');
  const [reportMotivo, setReportMotivo] = useState('Se trata de una compra / alquiler especial que excede la logística habitual.');
  const [reportMotivoOtro, setReportMotivoOtro] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [share, setShare] = useState<{ phone: string; message: string; name: string } | null>(null);
  useEffect(() => {
    if (!isReportOpen) return;
    let cancelled = false;
    async function loadPeople() {
      try {
        const [{ data: profilesData, error: profilesError }, { data: electricistasData, error: employeesError }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, role, whatsapp').eq('active', true).order('full_name'),
          supabase.from('empleados').select('id, full_name, specialty, whatsapp').order('full_name'),
        ]);
        if (profilesError) throw profilesError;
        if (employeesError) throw employeesError;
        if (cancelled) return;
        const oficinaList: {id: string, full_name: string, role: string, whatsapp?: string | null}[] = [];
        const obraList: {id: string, full_name: string, role: string, whatsapp?: string | null}[] = [];
        const combinedList: {id: string, full_name: string, role: string, whatsapp?: string | null}[] = [];

        if (profilesData) {
          profilesData.forEach(p => {
            const item = { id: p.id, full_name: p.full_name, role: p.role || 'Usuario Sistema', whatsapp: p.whatsapp };
            oficinaList.push(item);
            combinedList.push(item);
          });
        }

        if (electricistasData) {
          electricistasData.forEach(e => {
            const item = {
              id: e.id,
              full_name: e.full_name,
              role: e.specialty || 'Personal de Obra',
              whatsapp: e.whatsapp
            };
            obraList.push(item);
            if (!combinedList.some(c => c.full_name.toLowerCase().trim() === e.full_name.toLowerCase().trim())) {
              combinedList.push(item);
            }
          });
        }

        oficinaList.sort((a, b) => a.full_name.localeCompare(b.full_name));
        obraList.sort((a, b) => a.full_name.localeCompare(b.full_name));
        combinedList.sort((a, b) => a.full_name.localeCompare(b.full_name));

        setOficinaProfiles(oficinaList);
        setObraEmployees(obraList);
        setAllProfiles(combinedList);
      } catch {
        if (!cancelled) toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las personas para el reporte. Cerrá y volvé a intentar.' });
      }
    }
    void loadPeople();
    return () => { cancelled = true; };
  }, [isReportOpen, toast]);
  const handleSendReport = async () => {
    if (saving) return;
    if (!reportPerson) {
      toast({ variant: 'destructive', title: 'Persona requerida', description: 'Por favor, seleccioná a la persona que te encomendó la tarea.' });
      return;
    }

    const personaObj = [...obraEmployees, ...oficinaProfiles].find(p => p.id === reportPerson);
    const personaNombre = personaObj ? `${personaObj.full_name} (${personaObj.role || 'Personal'})` : 'No especificado';
    const recipientObj = allProfiles.find(p => p.id === reportRecipient);

    // Usar el WhatsApp del destinatario o el contacto predeterminado solo si fue seleccionado.
    const targetPhone = (recipientObj?.whatsapp && recipientObj.whatsapp.length > 6)
      ? recipientObj.whatsapp
      : (reportRecipient === '5493814015738' ? reportRecipient : '');

    const recipientName = recipientObj?.full_name || 'Federico Grande';

    const motivoFinal = reportMotivo === 'Otro' ? (reportMotivoOtro.trim() || 'Otro motivo especificado por voz/texto') : reportMotivo;

    // Guardar en la base de datos de Supabase para la página de reportes
    setSaving(true);
    setSaveError('');
    try {
      const { error } = await supabase.from('reportes_excedidos').insert([{
        requester_id: profile?.id,
        requester_name: profile?.full_name || 'Personal Logística',
        target_person_id: oficinaProfiles.some(p => p.id === personaObj?.id) ? personaObj!.id : null,
        target_person_name: personaNombre,
        recipient_name: recipientName,
        tarea: reportTarea.trim() || 'Sin descripción específica',
        motivo: motivoFinal,
        status: 'Pendiente'
      }]);
      if (error) throw error;
    } catch {
      setSaveError('No se pudo guardar el reporte. El texto se conserva; intentá nuevamente.');
      toast({ variant: 'destructive', title: 'No se pudo guardar el reporte', description: 'El texto se conserva. Intentá nuevamente antes de compartirlo.' });
      return;
    } finally { setSaving(false); }

    const waMsg = [
      '*⚠️ REPORTAR TAREA EXCEDIDA DE LOGÍSTICA*',
      '',
      `Hola *${(recipientName || 'Coordinación').split(' ')[0]}*, me encomendaron una tarea que excede la logística habitual:`,

      '',
      `- *Persona que encomendó la tarea:* ${personaNombre}`,
      reportTarea.trim() ? `- *Tarea / Pedido solicitado:* ${reportTarea}` : '',
      `- *Motivo:* ${motivoFinal}`,
      `- *Reportado por:* ${profile?.full_name || 'Personal Logística'}`,
      `- *Fecha:* ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs`,
      '',
      'Esta tarea se trata de una compra/alquiler o requerimiento especial que excede el alcance del área de logística.',
    ].filter(Boolean).join('\n');

    setIsReportOpen(false);
    setReportPerson('');
    setReportTarea('');
    setReportMotivoOtro('');

    toast({ title: 'Reporte guardado', description: 'Ya está registrado para su seguimiento por Administración.' });
    if (targetPhone) setShare({ phone: targetPhone, message: waMsg, name: recipientName });
  };

  return (
      <>
      <WhatsAppPreviewModal isOpen={share !== null} onClose={() => setShare(null)} phone={share?.phone || ''} message={share?.message || ''} recipientName={share?.name} />
      <Dialog open={isReportOpen} onOpenChange={open => { if (!saving) setIsReportOpen(open); }}>
        <DialogContent className="rounded-3xl w-[92%] max-w-md bg-white border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-gradient-to-r from-rose-700 to-red-600 text-white p-5 relative">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-300 animate-bounce" />
                <span>Reportar Tarea</span>
              </DialogTitle>
              <DialogDescription className="text-rose-100 text-xs font-semibold">
                Registrá tareas o compras que exceden la logística y compartilas por WhatsApp si hace falta.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Enviar reporte por WhatsApp a: *
              </label>
              <select
                value={reportRecipient}
                onChange={e => setReportRecipient(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-rose-200 bg-rose-50/40 text-sm font-bold text-rose-950 focus:ring-2 focus:ring-rose-500"
              >
                <option value="5493814015738">Federico Grande (Administración)</option>
                {allProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role || 'Usuario'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Persona que encomendó la tarea *
              </label>

              {/* Pestañas para cambiar entre Personal de Obra y Oficina */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => { setPersonCategory('obra'); setReportPerson(''); }}
                  className={`py-2 rounded-lg transition-all ${
                    personCategory === 'obra'
                      ? 'bg-white text-rose-700 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  👷 Personal en Obra ({obraEmployees.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setPersonCategory('oficina'); setReportPerson(''); }}
                  className={`py-2 rounded-lg transition-all ${
                    personCategory === 'oficina'
                      ? 'bg-white text-rose-700 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🏢 Oficina / Sistema ({oficinaProfiles.length})
                </button>
              </div>

              {/* Selector dinámico según la categoría elegida */}
              <select
                value={reportPerson}
                onChange={e => setReportPerson(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-rose-500"
              >
                <option value="">
                  {personCategory === 'obra'
                    ? 'Seleccionar personal de obra (electricista, operario)...'
                    : 'Seleccionar usuario de oficina (coordinador, admin)...'}
                </option>
                {(personCategory === 'obra' ? obraEmployees : oficinaProfiles).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Tarea / Pedido solicitado (Opcional)</span>
                <span className="text-[10px] text-peie-blue font-semibold">🎙️ Podés dictar</span>
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: Comprar grupo electrógeno 10 KVA / Alquilar bobcat"
                  value={reportTarea}
                  onChange={e => setReportTarea(e.target.value)}
                  className="rounded-xl h-11 flex-1"
                />
                <VoiceInputButton
                  onTranscript={t => setReportTarea(prev => prev ? `${prev} ${t}` : t)}
                  className="h-11 w-11 rounded-xl shrink-0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Motivo del reporte
              </label>
              <select
                value={reportMotivo}
                onChange={e => setReportMotivo(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-rose-500"
              >
                <option value="Se trata de una compra / alquiler especial que excede la logística habitual.">
                  Se trata de una compra / alquiler especial (excede logística)
                </option>
                <option value="No hay vehículo ni chofer disponible para este tipo de traslado pesado.">
                  No hay vehículo / chofer adecuado disponible
                </option>
                <option value="Requiere aprobación previa o fondos de caja chica de gerencia.">
                  Requiere aprobación / fondos de gerencia
                </option>
                <option value="Herramienta en uso crítico en obra, requiere negociación especial.">
                  Herramienta en uso crítico, requiere negociación directa
                </option>
                <option value="Otro">
                  Otro motivo (Escribir o dictar con voz)
                </option>
              </select>

              {reportMotivo === 'Otro' && (
                <div className="pt-1.5 space-y-1 animate-fadeIn">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>Escribí o dictá el motivo personalizado:</span>
                    <span className="text-[10px] text-peie-blue font-semibold">🎙️ Dictar</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: El proveedor no entrega en obra y requiere retirarse en Famaillá..."
                      value={reportMotivoOtro}
                      onChange={e => setReportMotivoOtro(e.target.value)}
                      className="rounded-xl h-11 flex-1"
                      required
                    />
                    <VoiceInputButton
                      onTranscript={t => setReportMotivoOtro(prev => prev ? `${prev} ${t}` : t)}
                      className="h-11 w-11 rounded-xl shrink-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {saveError && <p role="alert" className="px-4 py-2 text-sm text-red-700">{saveError}</p>}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-3xl">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setIsReportOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={!reportPerson || saving}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs h-11 px-5 shadow-lg shadow-rose-600/20 flex items-center gap-2"
            >
              <MessageCircle size={16} /> {saving ? 'Guardando...' : 'Guardar reporte'} <ChevronRight size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>
  );
}
