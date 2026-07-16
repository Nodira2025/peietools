import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  HardHat, 
  MapPin, 
  Building2, 
  Send, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Mic, 
  ChevronRight 
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { Input } from '@/components/ui/input';
import { speak, stopSpeaking, setVoiceEnabled, isSpeechSupported } from '../lib/voiceGuide';

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 
  | 'select_obra'      // "¿A qué obra querés trasladar al operario?"
  | 'confirm_transfer'; // "¿Confirmás el traslado?"

// ─── Component ───────────────────────────────────────────────────────────────

export default function NuevoTrasladoPersonal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();

  // Data
  const [empleado, setEmpleado] = useState<any>(null);
  const [obras, setObras] = useState<any[]>([]);
  const [targetObraId, setTargetObraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');

  // Layout View Mode (Form vs Wizard)
  const [isMobile, setIsMobile] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('select_obra');
  const [voiceOn, setVoiceOn] = useState(false); // Desactivada por defecto

  // Screen voice listening state
  const [isScreenListening, setIsScreenListening] = useState(false);

  // ─── Check Device Size ───────────────────────────────────────────────────

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // ─── Fetch Details ───────────────────────────────────────────────────────

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    setLoading(true);
    // Traer datos del empleado
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obra_id, obras:obra_id(name, encargado_name)')
      .eq('id', id)
      .single();

    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'Empleado no encontrado.' });
      navigate('/personal');
      return;
    }
    setEmpleado(empData);

    // Traer lista de obras destino (activas y excluyendo la actual)
    const { data: obrasData } = await supabase
      .from('obras')
      .select('id, name, encargado_name, status')
      .eq('active', true)
      .neq('id', empData.obra_id || '00000000-0000-0000-0000-000000000000')
      .order('name');
    
    let filteredObrasData = obrasData || [];
    const isAdminOrLogistica = profile?.role === 'admin' || profile?.role === 'logistica';
    if (!isAdminOrLogistica && profile) {
      filteredObrasData = (obrasData || []).filter(o => 
        (typeof o.encargado_name === 'string' && typeof profile.full_name === 'string' && o.encargado_name.toLowerCase().trim() === profile.full_name.toLowerCase().trim()) ||
        o.id === profile.obra_id
      );
    }
    
    setObras(filteredObrasData);
    setLoading(false);
  };

  // ─── Voice Guide ─────────────────────────────────────────────────────────

  const guideSpeak = useCallback((text: string) => {
    if (voiceOn) speak(text);
  }, [voiceOn]);

  const toggleVoice = () => {
    const newState = !voiceOn;
    setVoiceOn(newState);
    setVoiceEnabled(newState);
    if (!newState) stopSpeaking();
  };

  // Speak on wizard step change
  useEffect(() => {
    if (!isMobile || loading || !empleado) return;
    const messages: Record<WizardStep, string> = {
      select_obra: `¿A qué obra querés trasladar a ${empleado.full_name}? Tocá la obra de destino en la lista.`,
      confirm_transfer: `¿Confirmás el traslado de ${empleado.full_name}? Tocá SÍ para notificar por WhatsApp.`,
    };
    if (messages[wizardStep]) {
      const timer = setTimeout(() => guideSpeak(messages[wizardStep]), 400);
      return () => clearTimeout(timer);
    }
  }, [wizardStep, isMobile, loading, empleado, guideSpeak]);

  // ─── Voice Command Operations ────────────────────────────────────────────

  const listenForScreenCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Comandos por voz no soportados" });
      return;
    }

    stopSpeaking();
    const rec = new SpeechRecognition();
    rec.lang = 'es-AR';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsScreenListening(true);
    rec.onend = () => setIsScreenListening(false);
    rec.onerror = () => setIsScreenListening(false);

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      processVoiceCommand(transcript);
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
    }
  };

  const processVoiceCommand = (command: string) => {
    if (wizardStep === 'confirm_transfer') {
      if (command.includes('sí') || command.includes('si') || command.includes('confirmar') || command.includes('verde') || command.includes('ok')) {
        handleTransfer();
      } else if (command.includes('no') || command.includes('cancelar') || command.includes('rojo') || command.includes('atrás') || command.includes('atras')) {
        goToWizardStep('select_obra');
      } else {
        guideSpeak('No entendí. Decí SÍ o NO.');
      }
    }
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (!isMobile || isScreenListening || loading) return;
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select') || target.closest('label');
    if (isInteractive) return;

    if (wizardStep === 'confirm_transfer') {
      listenForScreenCommand();
    }
  };

  // ─── Wizard Helpers ──────────────────────────────────────────────────────

  const goToWizardStep = (step: WizardStep) => {
    stopSpeaking();
    setWizardStep(step);
  };

  const handleSelectObraWizard = (obraId: string) => {
    setTargetObraId(obraId);
    goToWizardStep('confirm_transfer');
  };

  // ─── Submit Action ───────────────────────────────────────────────────────

  const handleTransfer = async () => {
    if (!targetObraId || !profile || !empleado) return;
    setSubmitting(true);

    try {
      // 1. Crear el registro en traslados_personal
      const { data: trasladoData, error: trasladoError } = await supabase
        .from('traslados_personal')
        .insert([{
          empleado_id: empleado.id,
          source_obra_id: empleado.obra_id,
          target_obra_id: targetObraId,
          requester_id: profile.id,
          status: 'Pendiente'
        }])
        .select('id')
        .single();

      if (trasladoError) throw trasladoError;

      // 2. Actualizar el estado del empleado a 'En traslado'
      const { error: empUpdateError } = await supabase
        .from('empleados')
        .update({ status: 'En traslado' })
        .eq('id', empleado.id);

      if (empUpdateError) throw empUpdateError;

      const targetObra = obras.find(o => o.id === targetObraId);
      const sourceObraEncargado = empleado.obras?.encargado_name;
      let sourceProfileData = null;
      if (sourceObraEncargado) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, whatsapp')
          .ilike('full_name', `%${sourceObraEncargado}%`)
          .not('whatsapp', 'is', null)
          .limit(1)
          .maybeSingle();
        sourceProfileData = profileData;
      }

      toast({ 
        title: 'Traslado Iniciado', 
        description: 'Se registró el traslado. Abriendo WhatsApp...',
        className: 'bg-emerald-50 border-emerald-200'
      });

      if (sourceProfileData?.whatsapp) {
        const msg = [
          '*SOLICITUD DE TRASLADO DE PERSONAL (APROBACIÓN REQUERIDA)*',
          '',
          `Hola *${sourceProfileData.full_name.split(' ')[0]}*!`,
          `*${profile.full_name}* solicita trasladar a *${empleado.full_name}* (actualmente en tu obra *${empleado.obras?.name || 'Base'}*) hacia la obra *${targetObra?.name}*.`,
          '',
          'Ingresá al siguiente link para validar y aprobar el traslado:',
          `${APP_URL}/personal/traslados/${trasladoData.id}`
        ].join('\n');
        
        setTimeout(() => { 
          window.open(buildWhatsAppLink(sourceProfileData.whatsapp!, msg), '_blank'); 
          navigate('/personal');
        }, 800);
      } else {
        toast({ 
          variant: 'default', 
          title: 'Aviso', 
          description: 'El encargado no tiene WhatsApp registrado. Aprobación pendiente en el sistema.' 
        });
        setTimeout(() => navigate('/personal'), 1500);
      }

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setSubmitting(false);
    }
  };

  // ─── Filter Logic ────────────────────────────────────────────────────────

  const filteredObras = obras.filter(o => {
    const matchSearch = !searchTerm || o.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEncargado = !filterEncargado || (o.encargado_name === filterEncargado);
    return matchSearch && matchEncargado;
  });

  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter(Boolean))].sort();

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!empleado) return null;

  const targetObraObject = obras.find(o => o.id === targetObraId);

  return (
    <div onClick={handleScreenClick} className="space-y-4 max-w-xl mx-auto pb-safe min-h-[85vh]">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => { stopSpeaking(); navigate('/personal'); }} className="p-0 hover:bg-transparent text-peie-blue text-xs">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
        {isMobile && isSpeechSupported() && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              voiceOn ? 'bg-peie-blue text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {voiceOn ? 'Voz ON' : 'Voz OFF'}
          </button>
        )}
      </div>

      {/* 💻 DESKTOP VIEW (Form) */}
      {!isMobile && (
        <Card className="shadow-sm border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
          <CardHeader className="pb-4 pt-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-peie-blue/10 flex items-center justify-center mb-3">
              <HardHat className="h-8 w-8 text-peie-blue" />
            </div>
            <CardTitle className="text-2xl font-bold text-peie-blue">Trasladar Personal</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Seleccioná la obra de destino</p>
          </CardHeader>
          
          <CardContent className="space-y-5">
            {/* Info del Empleado */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Empleado a trasladar</p>
              <p className="font-bold text-slate-800 text-lg">{empleado.full_name}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" /> Origen actual: <strong>{empleado.obras?.name || 'Sin asignar'}</strong>
              </p>
            </div>

            {/* Selección de Destino */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Obra de Destino
              </label>
              <div className="flex flex-col gap-2">
                <Input 
                  placeholder="Buscar obra por nombre..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-10 rounded-xl"
                />
                <select
                  value={filterEncargado}
                  onChange={e => setFilterEncargado(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="">Todos los encargados</option>
                  {encargadosUnicos.map(e => (
                    <option key={e!} value={e!}>{e}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                {filteredObras.map(obra => (
                  <button
                    key={obra.id}
                    onClick={() => setTargetObraId(obra.id)}
                    className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      targetObraId === obra.id 
                        ? 'border-peie-blue bg-peie-blue/5 text-peie-blue shadow-sm' 
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span>{obra.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {obra.active ? 'Activa' : 'Inactiva'} • {obra.encargado_name || 'Sin Encargado'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredObras.length === 0 && (
                  <p className="text-center py-4 text-xs text-slate-400">No se encontraron obras con esos filtros.</p>
                )}
              </div>
            </div>

            {/* Botón Submit */}
            <div className="pt-4 border-t border-slate-100">
              <Button 
                onClick={handleTransfer} 
                disabled={!targetObraId || submitting}
                className="w-full h-14 rounded-xl font-bold text-white bg-peie-blue hover:bg-peie-blue/90 shadow-md text-base transition-all disabled:opacity-50"
              >
                <Send className="mr-2 h-5 w-5" />
                {submitting ? 'Registrando...' : 'Confirmar Traslado y Avisar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 📱 MOBILE WIZARD VIEW */}
      {isMobile && (
        <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
          <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
          <CardContent className="px-5 py-6 space-y-5">

            {/* STEP 1: SELECT OBRA */}
            {wizardStep === 'select_obra' && (
              <div className="space-y-5">
                <StepHeader 
                  title={`¿A qué obra trasladamos a ${empleado.full_name}?`} 
                  subtitle="Seleccioná la obra de destino"
                />

                {/* Origin Info */}
                <div className="bg-slate-50 rounded-xl p-3 border text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Origen Actual</span>
                  <p className="text-sm font-black text-slate-700">{empleado.obras?.name || 'Base / Sin asignar'}</p>
                </div>

                {/* Dest Obras Lists */}
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                  {obras.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleSelectObraWizard(o.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-left text-base font-bold text-slate-700 active:scale-[0.97] transition-all hover:border-peie-blue"
                    >
                      <Building2 size={20} className="text-peie-blue shrink-0" />
                      <div>
                        <p className="font-black text-slate-800">{o.name}</p>
                        <p className="text-xs text-slate-400">Encargado: {o.encargado_name || 'Sin Encargado'}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 ml-auto shrink-0" />
                    </button>
                  ))}
                  {obras.length === 0 && (
                    <p className="text-center py-6 text-sm text-slate-400 font-medium">No hay obras destino disponibles</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: CONFIRM TRANSFER */}
            {wizardStep === 'confirm_transfer' && targetObraObject && (
              <div className="space-y-5">
                <StepHeader title="¿Confirmás el traslado?" />

                {/* Resume Card */}
                <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-3">
                    <HardHat className="text-peie-blue shrink-0" size={18} />
                    <span className="text-xs text-slate-500 font-bold uppercase">Resumen de Traslado</span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-700 font-medium">
                    <p>👤 <strong className="text-slate-500">Empleado:</strong> {empleado.full_name}</p>
                    <p>🚩 <strong className="text-slate-500">Obra Origen:</strong> {empleado.obras?.name || 'Base / Sin asignar'}</p>
                    <p>📍 <strong className="text-slate-500">Obra Destino:</strong> {targetObraObject.name}</p>
                    <p>🔔 <strong className="text-slate-500">Destino Encargado:</strong> {targetObraObject.encargado_name || 'Sin Encargado'}</p>
                  </div>
                </div>

                {/* Yes/No Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleTransfer}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg disabled:opacity-50"
                  >
                    <Check size={32} />
                    SÍ, TRASLADAR
                  </button>
                  <button
                    type="button"
                    onClick={() => goToWizardStep('select_obra')}
                    disabled={submitting}
                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg disabled:opacity-50"
                  >
                    <X size={32} />
                    MODIFICAR
                  </button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Indicador de Control de Voz en Pantalla Completa (Móvil) */}
      {isMobile && !isScreenListening && voiceOn && wizardStep === 'confirm_transfer' && (
        <div className="text-center p-3 bg-peie-blue/5 rounded-2xl border border-peie-blue/10 animate-pulse">
          <p className="text-xs text-peie-blue font-bold flex items-center justify-center gap-1.5">
            <Mic size={14} /> Tocá la pantalla libre y decí tu opción
          </p>
        </div>
      )}

      {/* Overlay de Escucha de Comandos por Voz (Móvil) */}
      {isMobile && isScreenListening && (
        <div className="fixed inset-0 bg-peie-blue/95 z-50 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center animate-ping absolute" />
          <div className="w-20 h-20 rounded-full bg-white text-peie-blue flex items-center justify-center relative shadow-lg">
            <Mic size={36} className="animate-pulse" />
          </div>
          <h3 className="text-2xl font-black mt-8 text-center uppercase tracking-wider">Escuchando...</h3>
          <p className="text-sm mt-3 text-slate-200 font-semibold text-center max-w-xs">
            Decí: SÍ para trasladar o NO para modificar
          </p>
          <Button 
            onClick={() => setIsScreenListening(false)}
            variant="outline" 
            className="mt-12 border-white/30 text-white hover:bg-white/10 bg-transparent rounded-xl"
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Auxiliary Components ────────────────────────────────────────────────────

const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="text-center space-y-2 py-2">
    <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
    {subtitle && <p className="text-sm text-slate-500 font-medium">{subtitle}</p>}
  </div>
);
