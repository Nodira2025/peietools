import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Camera, 
  Sparkles, 
  Check, 
  X, 
  Truck, 
  MessageCircle,
  FileText,
  Search,
  User,
  MapPin,
  Building,
  Volume2,
  VolumeX,
  Mic,
  ChevronRight,
  RotateCcw,
  ImageIcon
} from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import { analyzeEmployeeImage, interpretEmployeeInput } from '../lib/openrouter';
import { speak, stopSpeaking, setVoiceEnabled, isSpeechSupported } from '../lib/voiceGuide';
import VoiceInputButton from '../components/VoiceInputButton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Empleado {
  id: string;
  full_name: string;
  specialty: string | null;
  whatsapp: string | null;
  status: 'Trabajando' | 'Libre';
  photo_url: string | null;
  obra_id: string | null;
  obras?: { name: string } | null;
}

interface Obra {
  id: string;
  name: string;
}

type WizardStep = 
  | 'welcome'           // "¿Cómo querés encontrar al empleado?"
  | 'photo_upload'      // "Sacá una foto..."
  | 'photo_loading'     // "Analizando..."
  | 'photo_results'     // "¿Cuál es el empleado?" (top 3)
  | 'select_obra'       // "¿En qué obra trabaja?"
  | 'employees_in_obra' // "Tocá al empleado" (list from obra)
  | 'voice_describe'    // "Describí al empleado..."
  | 'voice_loading'     // "Interpretando..."
  | 'voice_results'     // "¿Es alguno de estos?"
  | 'confirm_employee'  // "¿Es este el empleado?"
  | 'select_action';    // "¿Qué querés hacer con este empleado?"

// ─── Component ───────────────────────────────────────────────────────────────

export default function BusquedaPersonal() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data
  const [allEmployees, setAllEmployees] = useState<Empleado[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('welcome');
  const [voiceOn, setVoiceOn] = useState(false); // Desactivada por defecto

  // Photo flow
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [topMatches, setTopMatches] = useState<{ employee: Empleado; score: number }[]>([]);

  // Obra flow
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [employeesInObra, setEmployeesInObra] = useState<Empleado[]>([]);

  // Voice flow
  const [voiceText, setVoiceText] = useState('');
  const [voiceResults, setVoiceResults] = useState<Empleado[]>([]);

  // Final selection
  const [activeEmployee, setActiveEmployee] = useState<Empleado | null>(null);

  // Screen voice listening state
  const [isScreenListening, setIsScreenListening] = useState(false);

  // ─── Data Loading ────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      const [empRes, obrasRes] = await Promise.all([
        supabase.from('empleados').select('*, obras(name)'),
        supabase.from('obras').select('id, name').eq('active', true).order('name')
      ]);
      
      if (empRes.data) {
        setAllEmployees(empRes.data.map((e: any) => ({
          ...e,
          obras: Array.isArray(e.obras) ? e.obras[0] : e.obras
        })) as Empleado[]);
      }
      if (obrasRes.data) setObras(obrasRes.data);
    }
    loadData();

    // Sincronizar desactivación por defecto al ingresar
    setVoiceEnabled(false);
    stopSpeaking();

    return () => {
      stopSpeaking();
    };
  }, []);

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

  // Speak on step change
  useEffect(() => {
    const messages: Record<WizardStep, string> = {
      welcome: '¿Cómo querés encontrar al empleado? Podés sacar una foto, buscar por obra, o describirlo con tu voz.',
      photo_upload: 'Sacale una foto al operario o elegí una de tu galería.',
      photo_loading: 'Analizando la imagen. Esperá un momento.',
      photo_results: 'Encontré estos operarios parecidos. Tocá el correcto.',
      select_obra: '¿En qué obra trabaja el empleado? Tocá la obra.',
      employees_in_obra: 'Estos son los empleados de esa obra. Tocá el que buscás.',
      voice_describe: 'Describí al operario con tus palabras. Podés decir su nombre, apodo, especialidad u obra. Apretá el micrófono y hablá.',
      voice_loading: 'Estoy interpretando lo que dijiste. Esperá un momento.',
      voice_results: 'Encontré estos empleados. Tocá el correcto.',
      confirm_employee: '¿Es este el operario? Si es correcto, tocá Sí.',
      select_action: '¿Qué querés hacer con este empleado? Elegí una opción.',
    };
    if (messages[step]) {
      const timer = setTimeout(() => guideSpeak(messages[step]), 400);
      return () => clearTimeout(timer);
    }
  }, [step, guideSpeak]);

  // ─── Voice Command Operations ────────────────────────────────────────────

  const listenForScreenCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Comandos por voz no soportados", description: "Tu dispositivo no soporta esta función." });
      return;
    }

    stopSpeaking();

    const rec = new SpeechRecognition();
    rec.lang = 'es-AR';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsScreenListening(true);
    };

    rec.onend = () => {
      setIsScreenListening(false);
    };

    rec.onerror = (e: any) => {
      console.error('[VoiceCommand] Error:', e.error);
      setIsScreenListening(false);
      if (e.error !== 'no-speech') {
        guideSpeak('No te escuché bien. Tocá de nuevo para hablar.');
      }
    };

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
    console.log('[VoiceCommand] Personal:', command, 'Step:', step);

    if (step === 'welcome') {
      if (command.includes('foto') || command.includes('cámara') || command.includes('camara') || command.includes('imagen')) {
        goToStep('photo_upload');
      } else if (command.includes('obra') || command.includes('lugar') || command.includes('construcción')) {
        goToStep('select_obra');
      } else if (command.includes('voz') || command.includes('hablar') || command.includes('describir')) {
        goToStep('voice_describe');
      } else {
        guideSpeak('No entendí. Decí FOTO, OBRA o VOZ.');
      }
    }

    else if (step === 'confirm_employee') {
      if (command.includes('sí') || command.includes('si') || command.includes('correcto') || command.includes('verde') || command.includes('ok')) {
        handleConfirmEmployee();
      } else if (command.includes('no') || command.includes('rojo') || command.includes('incorrecto') || command.includes('atrás') || command.includes('atras')) {
        handleRejectEmployee();
      } else {
        guideSpeak('No entendí. Decí SÍ o NO.');
      }
    }

    else if (step === 'select_action') {
      if (command.includes('mover') || command.includes('traslado') || command.includes('llevar') || command.includes('obra') || command.includes('azul')) {
        stopSpeaking();
        navigate(`/personal/trasladar/${activeEmployee?.id}`);
      } else if (command.includes('whatsapp') || command.includes('mensaje') || command.includes('chat') || command.includes('llamar') || command.includes('verde')) {
        if (activeEmployee?.whatsapp) {
          stopSpeaking();
          window.open(`https://wa.me/${activeEmployee.whatsapp}`, '_blank');
        } else {
          guideSpeak('El empleado no tiene cargado un número de whatsapp.');
        }
      } else if (command.includes('perfil') || command.includes('ver') || command.includes('ficha')) {
        stopSpeaking();
        navigate(`/personal?empId=${activeEmployee?.id}`);
      } else {
        guideSpeak('No entendí. Decí MOVER, WHATSAPP o PERFIL.');
      }
    }
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (isScreenListening || step === 'photo_loading' || step === 'voice_loading') return;
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('input') || target.closest('label');
    if (isInteractive) return;

    const voiceActiveSteps: WizardStep[] = ['welcome', 'confirm_employee', 'select_action'];
    if (voiceActiveSteps.includes(step)) {
      listenForScreenCommand();
    }
  };

  // ─── Navigation Helpers ──────────────────────────────────────────────────

  const goToStep = (newStep: WizardStep) => {
    stopSpeaking();
    setStep(newStep);
  };

  const resetAll = () => {
    stopSpeaking();
    setStep('welcome');
    setPhotoUrl(null);
    setAiResult(null);
    setTopMatches([]);
    setSelectedObra(null);
    setEmployeesInObra([]);
    setVoiceText('');
    setVoiceResults([]);
    setActiveEmployee(null);
  };

  // ─── Photo Flow ──────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    goToStep('photo_loading');

    try {
      const compressed = await compressImage(file);
      setPhotoUrl(compressed);

      const parsed = await analyzeEmployeeImage(compressed);
      setAiResult(parsed);

      const matches = findTopMatches(parsed);
      if (matches.length > 0) {
        setTopMatches(matches);
        goToStep('photo_results');
      } else {
        toast({ title: 'No se encontraron coincidencias', description: 'Probá buscando por obra.' });
        goToStep('select_obra');
      }
    } catch (err: any) {
      if (err.message === 'CONFIG_REQUIRED') {
        const userKey = window.prompt("Ingresá tu API Key de OpenRouter:");
        if (userKey) {
          localStorage.setItem('VITE_OPENROUTER_API_KEY', userKey.trim());
          toast({ title: "Llave guardada", description: "Intentá de nuevo." });
        }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo analizar la foto.' });
      }
      goToStep('photo_upload');
    }
  };

  const findTopMatches = (aiData: any) => {
    const nameNorm = (aiData.nombre_sugerido || '').toLowerCase().trim();
    const specNorm = (aiData.specialty || '').toLowerCase().trim();

    const scored = allEmployees.map(emp => {
      let score = 0;
      const eName = emp.full_name.toLowerCase();
      const eSpec = (emp.specialty || '').toLowerCase();

      // Check name match
      if (nameNorm && eName.includes(nameNorm)) {
        score += 30;
      }
      
      // Specialty match
      if (specNorm && eSpec && (eSpec.includes(specNorm) || specNorm.includes(eSpec))) {
        score += 15;
      }

      return { employee: emp, score };
    });

    return scored.filter(x => x.score > 10).sort((a, b) => b.score - a.score).slice(0, 3);
  };

  // ─── Obra Flow ───────────────────────────────────────────────────────────

  const handleSelectObra = (obra: Obra) => {
    setSelectedObra(obra);
    const filtered = allEmployees.filter(e => e.obra_id === obra.id);
    setEmployeesInObra(filtered);
    goToStep('employees_in_obra');
  };

  // ─── Voice Flow ──────────────────────────────────────────────────────────

  const handleVoiceSearch = async () => {
    if (!voiceText.trim()) return;
    goToStep('voice_loading');

    try {
      const interpreted = await interpretEmployeeInput(voiceText);
      toast({ title: `Entendido: "${interpreted.nombre || interpreted.especialidad}"` });

      const terms = [interpreted.nombre.toLowerCase(), interpreted.especialidad.toLowerCase(), ...interpreted.terminos.map(t => t.toLowerCase())];
      const scored = allEmployees.map(emp => {
        let score = 0;
        const allText = `${emp.full_name} ${emp.specialty || ''} ${emp.obras?.name || ''}`.toLowerCase();
        for (const term of terms) {
          if (term.length < 2) continue;
          for (const w of term.split(/\s+/)) {
            if (w.length > 2 && allText.includes(w)) score += 5;
          }
        }
        return { employee: emp, score };
      });

      const results = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
      setVoiceResults(results.map(x => x.employee));

      if (results.length > 0) {
        goToStep('voice_results');
      } else {
        toast({ variant: 'destructive', title: 'Sin resultados', description: 'Intentá con otras palabras.' });
        goToStep('voice_describe');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      goToStep('voice_describe');
    }
  };

  // ─── Employee Selection ──────────────────────────────────────────────────

  const handleSelectEmployee = (emp: Empleado) => {
    setActiveEmployee(emp);
    goToStep('confirm_employee');
  };

  const handleConfirmEmployee = () => {
    goToStep('select_action');
  };

  const handleRejectEmployee = () => {
    setActiveEmployee(null);
    goToStep('select_obra');
  };

  // ─── Reusable UI Components ──────────────────────────────────────────────

  const EmployeeCard = ({ employee, onSelect }: { employee: Empleado; onSelect: () => void }) => (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white text-left transition-all active:scale-[0.97] active:border-peie-blue hover:border-blue-300 hover:shadow-md"
    >
      {employee.photo_url ? (
        <img src={employee.photo_url} alt={employee.full_name} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0" />
      ) : (
        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
          <User size={24} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-800 truncate">{employee.full_name}</p>
        <p className="text-xs text-slate-500 truncate">
          Especialidad: {employee.specialty || 'General'}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={12} className="text-peie-blue shrink-0" />
          <span className="text-xs font-bold text-peie-blue truncate">{employee.obras?.name || 'Libre / Base Central'}</span>
        </div>
      </div>
      <ChevronRight size={20} className="text-slate-300 shrink-0" />
    </button>
  );

  const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="text-center space-y-2 py-2">
      <h2 className="text-xl font-black text-slate-800 leading-tight">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 font-medium">{subtitle}</p>}
    </div>
  );

  const BackButton = ({ onBack }: { onBack: () => void }) => (
    <button
      type="button"
      onClick={() => { stopSpeaking(); onBack(); }}
      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-peie-blue transition-colors py-2"
    >
      <ArrowLeft size={14} /> Volver
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div onClick={handleScreenClick} className="space-y-4 max-w-xl mx-auto pb-safe min-h-[85vh] cursor-pointer">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => { stopSpeaking(); navigate('/personal'); }} className="p-0 hover:bg-transparent text-peie-blue text-xs">
          <ArrowLeft className="mr-1 h-4 w-4" /> Personal
        </Button>
        {isSpeechSupported() && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              voiceOn 
                ? 'bg-peie-blue text-white' 
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {voiceOn ? 'Voz ON' : 'Voz OFF'}
          </button>
        )}
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
        <CardContent className="px-5 py-6 space-y-5">

          {/* STEP: WELCOME */}
          {step === 'welcome' && (
            <div className="space-y-5">
              <StepHeader 
                title="¿Cómo querés encontrar al empleado?" 
                subtitle="Elegí una opción"
              />

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => goToStep('photo_upload')}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-peie-blue to-peie-light text-white active:scale-[0.97] transition-all shadow-lg shadow-peie-blue/20"
                >
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Camera size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">SACAR FOTO</p>
                    <p className="text-xs text-white/80 font-medium">Le saco una foto y lo busco</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => goToStep('select_obra')}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 active:scale-[0.97] transition-all hover:border-blue-200"
                >
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-peie-blue shrink-0">
                    <Building size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">BUSCAR POR OBRA</p>
                    <p className="text-xs text-slate-500 font-medium">Sé en qué obra trabaja</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => goToStep('voice_describe')}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 active:scale-[0.97] transition-all hover:border-emerald-200"
                >
                  <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Mic size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">DESCRIBIR CON VOZ</p>
                    <p className="text-xs text-slate-500 font-medium">Lo describo y lo busco</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP: PHOTO UPLOAD */}
          {step === 'photo_upload' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="📷 Sacale una foto" 
                subtitle="Apuntá al operario y sacá la foto"
              />

              <div className="space-y-3">
                <input type="file" id="wizard-photo-camera-emp" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                <input type="file" id="wizard-photo-gallery-emp" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

                <Label
                  htmlFor="wizard-photo-camera-emp"
                  className="flex items-center justify-center gap-3 h-20 rounded-2xl border-2 border-peie-blue/40 border-dashed bg-peie-blue/5 text-peie-blue text-lg font-black cursor-pointer active:scale-95 transition-all"
                >
                  <Camera size={28} /> SACAR FOTO
                </Label>

                <Label
                  htmlFor="wizard-photo-gallery-emp"
                  className="flex items-center justify-center gap-3 h-14 rounded-2xl border-2 border-slate-200 border-dashed bg-white text-slate-600 text-sm font-bold cursor-pointer active:scale-95 transition-all"
                >
                  <ImageIcon size={18} /> Elegir de galería
                </Label>
              </div>
            </div>
          )}

          {/* STEP: PHOTO LOADING */}
          {step === 'photo_loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
              <p className="text-sm font-bold text-peie-blue animate-pulse flex items-center gap-2">
                <Sparkles size={16} /> Analizando la foto...
              </p>
            </div>
          )}

          {/* STEP: PHOTO RESULTS */}
          {step === 'photo_results' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="¿Quién es el operario?" 
                subtitle="Tocá el correcto"
              />

              <div className="space-y-3">
                {topMatches.map(({ employee }) => (
                  <EmployeeCard key={employee.id} employee={employee} onSelect={() => handleSelectEmployee(employee)} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToStep('select_obra')}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-rose-200 text-rose-600 font-bold text-sm active:scale-[0.97] transition-all"
              >
                <X size={18} /> Ninguno de estos
              </button>
            </div>
          )}

          {/* STEP: SELECT OBRA */}
          {step === 'select_obra' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="¿En qué obra trabaja?" 
                subtitle="Tocá la obra para ver su personal"
              />

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {obras.map(obra => (
                  <button
                    key={obra.id}
                    type="button"
                    onClick={() => handleSelectObra(obra)}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-left text-base font-bold text-slate-700 active:scale-[0.97] transition-all"
                  >
                    <MapPin size={20} className="text-peie-blue shrink-0" />
                    {obra.name}
                    <ChevronRight size={18} className="text-slate-300 ml-auto shrink-0" />
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => goToStep('voice_describe')}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold active:scale-[0.97] transition-all"
                >
                  <Mic size={16} /> No sé la obra, describirlo con voz
                </button>
              </div>
            </div>
          )}

          {/* STEP: EMPLOYEES IN OBRA */}
          {step === 'employees_in_obra' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToStep('select_obra')} />
              <StepHeader 
                title={`Personal en ${selectedObra?.name}`} 
                subtitle={employeesInObra.length > 0 ? "Tocá el que buscás" : undefined}
              />

              {employeesInObra.length > 0 ? (
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto">
                  {employeesInObra.map(emp => (
                    <EmployeeCard key={emp.id} employee={emp} onSelect={() => handleSelectEmployee(emp)} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <User size={28} />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No hay operarios registrados en esta obra</p>
                </div>
              )}
            </div>
          )}

          {/* STEP: VOICE DESCRIBE */}
          {step === 'voice_describe' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="🎤 Describilo con tu voz" 
                subtitle="Decí su nombre, apodo, especialidad o lo que recuerdes"
              />

              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <VoiceInputButton onTranscript={(text) => setVoiceText(text)} className="!w-20 !h-20 !rounded-full shadow-lg" />
                  <p className="text-xs text-slate-400 font-medium">Tocá y hablá</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="O escribí acá..." value={voiceText} onChange={e => setVoiceText(e.target.value)} className="pl-9 h-12 rounded-xl text-base" />
                </div>

                {voiceText.trim() && (
                  <div className="bg-slate-50 rounded-xl p-3 border">
                    <p className="text-[10px] text-slate-400 font-bold mb-1">Lo que dijiste:</p>
                    <p className="text-sm font-medium">"{voiceText}"</p>
                  </div>
                )}

                <Button type="button" onClick={handleVoiceSearch} disabled={!voiceText.trim()} className="w-full h-14 text-base font-black rounded-2xl">
                  BUSCAR
                </Button>
              </div>
            </div>
          )}

          {/* STEP: VOICE LOADING */}
          {step === 'voice_loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm font-bold text-emerald-700 animate-pulse">Interpretando descripción...</p>
            </div>
          )}

          {/* STEP: VOICE RESULTS */}
          {step === 'voice_results' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToStep('voice_describe')} />
              <StepHeader title="¿Es alguno de estos?" subtitle="Tocá el correcto" />

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {voiceResults.map(emp => (
                  <EmployeeCard key={emp.id} employee={emp} onSelect={() => handleSelectEmployee(emp)} />
                ))}
              </div>
            </div>
          )}

          {/* STEP: CONFIRM EMPLOYEE */}
          {step === 'confirm_employee' && activeEmployee && (
            <div className="space-y-5">
              <StepHeader title="¿Es este el operario?" />

              <div className="bg-white border-2 border-peie-blue/20 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  {activeEmployee.photo_url ? (
                    <img src={activeEmployee.photo_url} alt={activeEmployee.full_name} className="w-24 h-24 object-cover rounded-xl shrink-0" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                      <User size={32} />
                    </div>
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="text-lg font-black text-slate-800 leading-tight">{activeEmployee.full_name}</p>
                    <p className="text-sm text-slate-500">Especialidad: {activeEmployee.specialty || 'General'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-peie-blue" />
                      <span className="text-xs font-bold text-peie-blue">{activeEmployee.obras?.name || 'Libre / Base Central'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleConfirmEmployee}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all"
                >
                  <Check size={32} /> SÍ
                </button>
                <button
                  type="button"
                  onClick={handleRejectEmployee}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-[0.95] transition-all"
                >
                  <X size={32} /> NO
                </button>
              </div>
            </div>
          )}

          {/* STEP: SELECT ACTION */}
          {step === 'select_action' && activeEmployee && (
            <div className="space-y-5">
              <StepHeader title="¿Qué querés hacer?" />

              <div className="bg-peie-blue/5 rounded-xl p-3 flex items-center gap-3 border border-peie-blue/10">
                {activeEmployee.photo_url ? (
                  <img src={activeEmployee.photo_url} alt={activeEmployee.full_name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <User size={18} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-slate-800">{activeEmployee.full_name}</p>
                  <p className="text-xs text-peie-blue font-semibold">{activeEmployee.obras?.name || 'Libre / Base Central'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigate(`/personal/trasladar/${activeEmployee.id}`)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-peie-blue text-white active:scale-[0.97] transition-all shadow-lg"
                >
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Truck size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">TRASLADAR A OTRA OBRA</p>
                    <p className="text-xs text-white/80 font-medium">Pedir traslado del empleado</p>
                  </div>
                </button>

                {activeEmployee.whatsapp && (
                  <button
                    type="button"
                    onClick={() => window.open(`https://wa.me/${activeEmployee.whatsapp}`, '_blank')}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-emerald-600 text-white active:scale-[0.97] transition-all shadow-lg"
                  >
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <MessageCircle size={28} />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-black">WHATSAPP</p>
                      <p className="text-xs text-white/80 font-medium">Abrir chat directo</p>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate(`/personal?empId=${activeEmployee.id}`)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 active:scale-[0.97] transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <FileText size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">VER FICHA</p>
                    <p className="text-xs text-slate-500 font-medium">Ver legajo de personal</p>
                  </div>
                </button>
              </div>

              <button type="button" onClick={resetAll} className="w-full flex items-center justify-center gap-2 h-11 text-sm font-bold text-slate-400 hover:text-peie-blue">
                <RotateCcw size={14} /> Buscar otro empleado
              </button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Indicador de Control de Voz de pantalla completa (solo en móviles y si la voz está activada) */}
      {!isScreenListening && voiceOn && typeof window !== 'undefined' && window.innerWidth < 768 && ['welcome', 'confirm_employee', 'select_action'].includes(step) && (
        <div className="text-center p-3 bg-peie-blue/5 rounded-2xl border border-peie-blue/10 animate-pulse">
          <p className="text-xs text-peie-blue font-bold flex items-center justify-center gap-1.5">
            <Mic size={14} /> Tocá la pantalla libre y decí tu opción en voz alta
          </p>
        </div>
      )}

      {/* Overlay de Escucha de Comandos por Voz */}
      {isScreenListening && (
        <div className="fixed inset-0 bg-peie-blue/95 z-50 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center animate-ping absolute" />
          <div className="w-20 h-20 rounded-full bg-white text-peie-blue flex items-center justify-center relative shadow-lg">
            <Mic size={36} className="animate-pulse" />
          </div>
          <h3 className="text-2xl font-black mt-8 text-center uppercase tracking-wider">Escuchando...</h3>
          <p className="text-sm mt-3 text-slate-200 font-semibold text-center max-w-xs">
            {step === 'welcome' && 'Decí: FOTO, OBRA o VOZ'}
            {step === 'confirm_employee' && 'Decí: SÍ o NO'}
            {step === 'select_action' && 'Decí: MOVER, WHATSAPP o PERFIL'}
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
