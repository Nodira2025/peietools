import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  User, 
  Briefcase, 
  Phone, 
  Building, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Mic,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { speak, stopSpeaking, setVoiceEnabled, isSpeechSupported } from '../lib/voiceGuide';

interface Obra {
  id: string;
  name: string;
}

type WizardStep = 
  | 'enter_name'      // ¿Cómo se llama el empleado?
  | 'select_specialty' // ¿Cuál es su especialidad?
  | 'enter_whatsapp'   // ¿Cuál es su WhatsApp?
  | 'select_obra'      // ¿A qué obra va asignado?
  | 'confirm_employee'; // Confirmar registro

export default function NuevoPersonalAsistido() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  // Data State
  const [obras, setObras] = useState<Obra[]>([]);
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('Electricista');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  
  // UX State
  const [isMobile, setIsMobile] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('enter_name');
  const [voiceOn, setVoiceOn] = useState(false);
  const [loading, setLoading] = useState(false);

  const specialties = [
    'Electricista',
    'Ayudante',
    'Media Tensión',
    'Oficial Liniero',
    'Chofer Logística',
    'Encargado de Obra',
    'Seguridad e Higiene'
  ];

  // Check size and redirect if desktop
  useEffect(() => {
    const checkSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        // Redirigir a la vista clásica en PC
        navigate('/personal');
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [navigate]);

  // Load Obras
  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
      if (data) setObras(data);
    }
    fetchObras();

    setVoiceEnabled(false);
    stopSpeaking();
    return () => stopSpeaking();
  }, []);

  // Voice guide trigger
  const guideSpeak = useCallback((text: string) => {
    if (voiceOn) speak(text);
  }, [voiceOn]);

  const toggleVoice = () => {
    const newState = !voiceOn;
    setVoiceOn(newState);
    setVoiceEnabled(newState);
    if (!newState) stopSpeaking();
  };

  useEffect(() => {
    if (!isMobile) return;
    const messages: Record<WizardStep, string> = {
      enter_name: '¿Cómo se llama el nuevo empleado? Escribí su nombre completo.',
      select_specialty: 'Seleccioná la especialidad o rol del empleado en la lista.',
      enter_whatsapp: 'Escribí su número de teléfono con el código de área para enviar notificaciones de WhatsApp.',
      select_obra: '¿A qué obra estará asignado inicialmente el empleado? Seleccioná una o marcá Sin Asignar.',
      confirm_employee: 'Por favor, confirmá los datos del nuevo empleado para registrarlo en el sistema.',
    };
    if (messages[wizardStep]) {
      const timer = setTimeout(() => guideSpeak(messages[wizardStep]), 400);
      return () => clearTimeout(timer);
    }
  }, [wizardStep, isMobile, guideSpeak]);

  const goToWizardStep = (step: WizardStep) => {
    stopSpeaking();
    setWizardStep(step);
  };

  const handleSaveEmployee = async () => {
    if (!fullName.trim()) {
      toast({ variant: 'destructive', title: 'Falta información', description: 'El nombre completo es requerido.' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        specialty: specialty.trim() || 'Electricista',
        whatsapp: whatsapp.trim() || null,
        obra_id: selectedObraId || null,
        status: (selectedObraId ? 'Trabajando' : 'Libre') as 'Trabajando' | 'Libre',
        active: true
      };

      const { error } = await supabase.from('empleados').insert([payload]);

      if (error) {
        toast({ variant: 'destructive', title: 'Error al registrar', description: error.message });
      } else {
        toast({ title: '¡Registro Exitoso!', description: `${payload.full_name} fue registrado con éxito.` });
        navigate('/personal');
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error inesperado al registrar.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedObraObject = obras.find(o => o.id === selectedObraId);

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-safe min-h-[85vh]">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => { stopSpeaking(); navigate(-1); }} className="p-0 hover:bg-transparent text-peie-blue text-xs font-bold">
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver
        </Button>
        {isSpeechSupported() && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              voiceOn ? 'bg-peie-blue text-white shadow-sm' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {voiceOn ? 'Voz ON' : 'Voz OFF'}
          </button>
        )}
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-[24px]">
        <div className="h-1.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-600" />
        <CardContent className="px-5 py-6 space-y-5">

          {/* STEP 1: ENTER NAME */}
          {wizardStep === 'enter_name' && (
            <div className="space-y-5">
              <StepHeader 
                title="¿Cómo se llama el empleado?" 
                subtitle="Ingresá su nombre y apellido completo"
              />
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input
                    placeholder="Nombre y Apellido completo..."
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="h-14 pl-12 rounded-2xl border-slate-200 focus-visible:ring-violet-600 text-base font-semibold"
                  />
                </div>
                <Button
                  onClick={() => goToWizardStep('select_specialty')}
                  disabled={!fullName.trim()}
                  className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl text-base shadow-lg shadow-violet-600/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Continuar <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT SPECIALTY */}
          {wizardStep === 'select_specialty' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToWizardStep('enter_name')} />
              <StepHeader 
                title="¿Cuál es su rol o especialidad?" 
                subtitle="Seleccioná de la lista o escribila abajo"
              />
              
              <div className="space-y-3">
                {/* Opciones rápidas */}
                <div className="grid grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1">
                  {specialties.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSpecialty(spec)}
                      className={`h-12 px-4 rounded-xl border-2 font-bold text-xs transition-all active:scale-[0.97] ${
                        specialty === spec 
                          ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input
                    placeholder="Escribí otra especialidad si no está..."
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    className="h-14 pl-12 rounded-2xl border-slate-200 focus-visible:ring-violet-600 text-sm font-semibold bg-slate-50/50"
                  />
                </div>

                <Button
                  onClick={() => goToWizardStep('enter_whatsapp')}
                  disabled={!specialty.trim()}
                  className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl text-base shadow-lg shadow-violet-600/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Continuar <ChevronRight size={18} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: ENTER WHATSAPP */}
          {wizardStep === 'enter_whatsapp' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToWizardStep('select_specialty')} />
              <StepHeader 
                title="¿Cuál es su WhatsApp?" 
                subtitle="Número de teléfono para notificaciones"
              />
              <div className="space-y-3">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input
                    type="tel"
                    placeholder="Ej: 5493815556677..."
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    className="h-14 pl-12 rounded-2xl border-slate-200 focus-visible:ring-violet-600 text-base font-semibold"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-tight px-1">
                  Código de país (ej: 54 para Argentina) seguido del código de área sin el 15. Sin espacios ni guiones.
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  <Button
                    onClick={() => goToWizardStep('select_obra')}
                    className="w-full h-14 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SELECT OBRA */}
          {wizardStep === 'select_obra' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToWizardStep('enter_whatsapp')} />
              <StepHeader 
                title="¿A qué obra estará asignado?" 
                subtitle="Seleccioná la obra inicial de destino"
              />

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedObraId(null);
                    goToWizardStep('confirm_employee');
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left text-base font-bold active:scale-[0.97] transition-all ${
                    selectedObraId === null
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <X size={20} className={selectedObraId === null ? 'text-violet-600' : 'text-slate-400'} />
                  Sin Asignar (Disponible / Libre)
                  <ChevronRight size={18} className="text-slate-300 ml-auto" />
                </button>

                <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                  {obras.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedObraId(o.id);
                        goToWizardStep('confirm_employee');
                      }}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left text-base font-bold active:scale-[0.97] transition-all ${
                        selectedObraId === o.id
                          ? 'border-violet-600 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Building size={20} className={selectedObraId === o.id ? 'text-violet-600' : 'text-slate-400'} />
                      {o.name}
                      <ChevronRight size={18} className="text-slate-300 ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRM REGISTER */}
          {wizardStep === 'confirm_employee' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToWizardStep('select_obra')} />
              <StepHeader 
                title="Confirmar Registro de Empleado" 
                subtitle="Revisá los datos antes de guardarlos"
              />

              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nombre Completo</span>
                  <p className="text-base font-black text-slate-800 flex items-center gap-2">
                    <User size={16} className="text-violet-600" /> {fullName}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Especialidad / Rol</span>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Briefcase size={16} className="text-violet-600" /> {specialty}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WhatsApp</span>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Phone size={16} className="text-violet-600" /> {whatsapp || 'No especificado'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Obra Asignada</span>
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building size={16} className="text-violet-600" /> {selectedObraObject?.name || 'Ninguna (Libre)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  <Check size={32} />
                  GUARDAR
                </button>
                <button
                  type="button"
                  onClick={() => goToWizardStep('enter_name')}
                  disabled={loading}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg shadow-rose-500/10 disabled:opacity-50"
                >
                  <X size={32} />
                  CANCELAR
                </button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

// ─── Auxiliary UI Components ──────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center space-y-2 py-1">
      <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 font-medium">{subtitle}</p>}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { stopSpeaking(); onBack(); }}
      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors py-1.5"
    >
      <ArrowLeft size={14} /> Volver
    </button>
  );
}

