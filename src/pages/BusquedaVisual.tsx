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
  AlertTriangle, 
  FileText,
  Search,
  Wrench,
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
import { analyzeToolImage, interpretUserInput } from '../lib/openrouter';
import { speak, stopSpeaking, setVoiceEnabled, isVoiceEnabled, isSpeechSupported } from '../lib/voiceGuide';
import VoiceInputButton from '../components/VoiceInputButton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  category: string | null;
  photo_url?: string | null;
  current_obra_id?: string | null;
  obras?: { name: string } | null;
}

interface Obra {
  id: string;
  name: string;
}

// Wizard steps - one question per screen
type WizardStep = 
  | 'welcome'           // "¿Cómo querés encontrar la herramienta?"
  | 'photo_upload'      // "Sacá una foto o subí de la galería"
  | 'photo_loading'     // "Analizando..."
  | 'photo_results'     // "¿Cuál es tu herramienta?" (top 3)
  | 'select_obra'       // "¿En qué obra estaba?"
  | 'tools_in_obra'     // "Tocá tu herramienta" (list from obra)
  | 'voice_describe'    // "Describí la herramienta con tu voz"
  | 'voice_loading'     // "Interpretando..."
  | 'voice_results'     // "¿Es alguna de estas?"
  | 'confirm_tool'      // "¿Es esta la herramienta?"
  | 'select_action';    // "¿Qué querés hacer con esta herramienta?"

// ─── Component ───────────────────────────────────────────────────────────────

export default function BusquedaVisual() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data
  const [allTools, setAllTools] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);

  // Wizard state
  const [step, setStep] = useState<WizardStep>('welcome');
  const [voiceOn, setVoiceOn] = useState(false);

  // Photo flow
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [topMatches, setTopMatches] = useState<{ tool: Herramienta; score: number }[]>([]);

  // Obra flow
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [toolsInObra, setToolsInObra] = useState<Herramienta[]>([]);

  // Voice flow
  const [voiceText, setVoiceText] = useState('');
  const [voiceResults, setVoiceResults] = useState<Herramienta[]>([]);

  // Final selection
  const [activeTool, setActiveTool] = useState<Herramienta | null>(null);

  // Voice Command States
  const [isScreenListening, setIsScreenListening] = useState(false);
  const [voiceCommandTranscript, setVoiceCommandTranscript] = useState('');

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
      setVoiceCommandTranscript('');
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
      setVoiceCommandTranscript(transcript);
      processVoiceCommand(transcript);
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
    }
  };

  const processVoiceCommand = (command: string) => {
    console.log('[VoiceCommand] Procesando:', command, 'en paso:', step);

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

    else if (step === 'confirm_tool') {
      if (command.includes('sí') || command.includes('si') || command.includes('correcto') || command.includes('verde') || command.includes('ok')) {
        handleConfirmTool();
      } else if (command.includes('no') || command.includes('rojo') || command.includes('incorrecto') || command.includes('atrás') || command.includes('atras')) {
        handleRejectTool();
      } else {
        guideSpeak('No entendí. Decí SÍ o NO.');
      }
    }

    else if (step === 'select_action') {
      if (command.includes('mover') || command.includes('traslado') || command.includes('llevar') || command.includes('obra') || command.includes('azul')) {
        stopSpeaking();
        navigate('/solicitudes/nueva', { state: { herramientaId: activeTool?.id } });
      } else if (command.includes('rota') || command.includes('falla') || command.includes('roto') || command.includes('dañado') || command.includes('amarillo')) {
        stopSpeaking();
        navigate('/ordenes/nueva', { state: { herramientaId: activeTool?.id } });
      } else if (command.includes('ficha') || command.includes('ver') || command.includes('info')) {
        stopSpeaking();
        navigate(`/herramientas/${activeTool?.id}`);
      } else {
        guideSpeak('No entendí. Decí MOVER, ROTA o FICHA.');
      }
    }
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (isScreenListening || step === 'photo_loading' || step === 'voice_loading') return;

    // Solo habilitar comandos por gestos táctiles en celulares
    if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('input') || target.closest('label');
    
    if (isInteractive) return;

    const voiceActiveSteps: WizardStep[] = ['welcome', 'confirm_tool', 'select_action'];
    if (voiceActiveSteps.includes(step)) {
      listenForScreenCommand();
    }
  };

  // ─── Data Loading ────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      const [toolsRes, obrasRes] = await Promise.all([
        supabase.from('herramientas').select('*, obras(name)'),
        supabase.from('obras').select('id, name').eq('active', true).order('name')
      ]);
      if (toolsRes.data) {
        setAllTools(toolsRes.data.map((h: any) => ({
          ...h,
          obras: Array.isArray(h.obras) ? h.obras[0] : h.obras
        })) as Herramienta[]);
      }
      if (obrasRes.data) setObras(obrasRes.data);
    }
    loadData();
    
    // Forzar desactivación por defecto al ingresar
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
      welcome: '¿Cómo querés encontrar la herramienta? Podés sacar una foto, buscar por obra, o describir la herramienta con tu voz.',
      photo_upload: 'Sacá una foto de la herramienta o elegí una de tu galería.',
      photo_loading: 'Analizando la imagen. Esperá un momento.',
      photo_results: 'Encontré estas herramientas parecidas. Tocá la que sea la tuya.',
      select_obra: '¿En qué obra estaba la herramienta? Tocá la obra.',
      tools_in_obra: 'Estas son las herramientas de esa obra. Tocá la tuya.',
      voice_describe: 'Describí la herramienta con tus palabras. Podés decir cómo se ve, para qué sirve, o de qué color es. Apretá el botón del micrófono y hablá.',
      voice_loading: 'Estoy interpretando lo que dijiste. Esperá un momento.',
      voice_results: 'Encontré estas herramientas. Tocá la que sea la tuya.',
      confirm_tool: '¿Es esta la herramienta que buscás? Si es correcta, tocá Sí.',
      select_action: '¿Qué querés hacer con esta herramienta? Elegí una opción.',
    };
    if (messages[step]) {
      // Small delay so the UI renders first
      const timer = setTimeout(() => guideSpeak(messages[step]), 400);
      return () => clearTimeout(timer);
    }
  }, [step, guideSpeak]);

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
    setToolsInObra([]);
    setVoiceText('');
    setVoiceResults([]);
    setActiveTool(null);
  };

  // ─── Photo Flow ──────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    goToStep('photo_loading');

    try {
      const compressed = await compressImage(file);
      setPhotoUrl(compressed);

      const parsed = await analyzeToolImage(compressed);
      setAiResult(parsed);

      // Fuzzy match top 3
      const matches = findTopMatches(parsed);
      if (matches.length > 0) {
        setTopMatches(matches);
        goToStep('photo_results');
      } else {
        toast({ title: 'No se encontró en el inventario', description: 'Probá buscando por obra.' });
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
    const brandNorm = (aiData.marca || '').toLowerCase().trim();
    const modelNorm = (aiData.modelo || '').toLowerCase().trim();
    const nameNorm = (aiData.nombre_sugerido || '').toLowerCase().trim();
    const catNorm = (aiData.categoria || '').toLowerCase().trim();

    const scored = allTools.map(tool => {
      let score = 0;
      const tName = tool.name.toLowerCase();
      const tBrand = (tool.brand || '').toLowerCase();
      const tModel = (tool.model || '').toLowerCase();
      const tCat = (tool.category || '').toLowerCase();

      if (brandNorm && tBrand && (tBrand.includes(brandNorm) || brandNorm.includes(tBrand))) score += 15;
      if (modelNorm && tModel) {
        if (tModel === modelNorm) score += 30;
        else if (tModel.includes(modelNorm) || modelNorm.includes(tModel)) score += 20;
      }
      if (nameNorm && tName) {
        const words = nameNorm.split(/\s+/);
        score += words.filter(w => w.length > 2 && tName.includes(w)).length * 5;
        if (tName.includes(nameNorm) || nameNorm.includes(tName)) score += 10;
      }
      if (catNorm && tCat && (tCat.includes(catNorm) || catNorm.includes(tCat))) score += 5;
      return { tool, score };
    });

    return scored.filter(x => x.score > 5).sort((a, b) => b.score - a.score).slice(0, 3);
  };

  // ─── Obra Flow ───────────────────────────────────────────────────────────

  const handleSelectObra = (obra: Obra) => {
    setSelectedObra(obra);
    const filtered = allTools.filter(t => t.current_obra_id === obra.id);
    setToolsInObra(filtered);
    goToStep('tools_in_obra');
  };

  // ─── Voice Flow ──────────────────────────────────────────────────────────

  const handleVoiceSearch = async () => {
    if (!voiceText.trim()) return;
    goToStep('voice_loading');

    try {
      const interpreted = await interpretUserInput(voiceText);
      toast({ title: `Entendido: "${interpreted.tipo_herramienta}"`, description: interpreted.descripcion });

      const terms = [interpreted.tipo_herramienta.toLowerCase(), ...interpreted.terminos.map(t => t.toLowerCase())];
      const scored = allTools.map(tool => {
        let score = 0;
        const allText = `${tool.name} ${tool.brand || ''} ${tool.model || ''} ${tool.category || ''}`.toLowerCase();
        for (const term of terms) {
          for (const w of term.split(/\s+/)) {
            if (w.length > 2 && allText.includes(w)) score += 5;
          }
        }
        return { tool, score };
      });

      const results = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
      setVoiceResults(results.map(x => x.tool));

      if (results.length > 0) {
        goToStep('voice_results');
      } else {
        toast({ variant: 'destructive', title: 'No encontré nada', description: 'Probá con otras palabras o buscá por obra.' });
        goToStep('voice_describe');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      goToStep('voice_describe');
    }
  };

  // ─── Tool Selection ──────────────────────────────────────────────────────

  const handleSelectTool = (tool: Herramienta) => {
    setActiveTool(tool);
    goToStep('confirm_tool');
  };

  const handleConfirmTool = () => {
    goToStep('select_action');
  };

  const handleRejectTool = () => {
    setActiveTool(null);
    goToStep('select_obra');
  };

  // ─── Reusable UI Components ──────────────────────────────────────────────

  const ToolCard = ({ tool, onSelect }: { tool: Herramienta; onSelect: () => void }) => (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-200 bg-white text-left transition-all active:scale-[0.97] active:border-peie-blue hover:border-blue-300 hover:shadow-md"
    >
      {tool.photo_url ? (
        <img src={tool.photo_url} alt={tool.name} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shrink-0" />
      ) : (
        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
          <Wrench size={24} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-800 truncate">{tool.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {tool.brand || 'Sin marca'} {tool.model ? `· ${tool.model}` : ''}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={12} className="text-peie-blue shrink-0" />
          <span className="text-xs font-bold text-peie-blue truncate">{tool.obras?.name || 'Base Central'}</span>
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
        <Button variant="ghost" onClick={() => { stopSpeaking(); navigate('/herramientas'); }} className="p-0 hover:bg-transparent text-peie-blue text-xs">
          <ArrowLeft className="mr-1 h-4 w-4" /> Inventario
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

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: WELCOME                                                   */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'welcome' && (
            <div className="space-y-5">
              <StepHeader 
                title="¿Cómo querés encontrar la herramienta?" 
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
                    <p className="text-xs text-white/80 font-medium">Le saco una foto y la busco</p>
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
                    <p className="text-xs text-slate-500 font-medium">Sé en qué obra estaba</p>
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
                    <p className="text-xs text-slate-500 font-medium">La describo y la busco</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: PHOTO UPLOAD                                              */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'photo_upload' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="📷 Sacale una foto" 
                subtitle="Apuntá a la herramienta y sacá la foto"
              />

              <div className="space-y-3">
                <input type="file" id="wizard-photo-camera" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                <input type="file" id="wizard-photo-gallery" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

                <Label
                  htmlFor="wizard-photo-camera"
                  className="flex items-center justify-center gap-3 h-20 rounded-2xl border-2 border-peie-blue/40 border-dashed bg-peie-blue/5 text-peie-blue text-lg font-black cursor-pointer active:scale-95 transition-all"
                >
                  <Camera size={28} /> SACAR FOTO
                </Label>

                <Label
                  htmlFor="wizard-photo-gallery"
                  className="flex items-center justify-center gap-3 h-14 rounded-2xl border-2 border-slate-200 border-dashed bg-white text-slate-600 text-sm font-bold cursor-pointer active:scale-95 transition-all"
                >
                  <ImageIcon size={18} /> Elegir de galería
                </Label>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: PHOTO LOADING                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'photo_loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
              <p className="text-sm font-bold text-peie-blue animate-pulse flex items-center gap-2">
                <Sparkles size={16} /> Analizando la foto...
              </p>
              <p className="text-xs text-slate-400">Esto tarda unos segundos</p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: PHOTO RESULTS (top 3)                                     */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'photo_results' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="¿Cuál es tu herramienta?" 
                subtitle="Tocá la correcta"
              />

              <div className="space-y-3">
                {topMatches.map(({ tool }) => (
                  <ToolCard key={tool.id} tool={tool} onSelect={() => handleSelectTool(tool)} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToStep('select_obra')}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-rose-200 text-rose-600 font-bold text-sm active:scale-[0.97] transition-all hover:bg-rose-50"
              >
                <X size={18} /> Ninguna de estas
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: SELECT OBRA                                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'select_obra' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="¿En qué obra estaba?" 
                subtitle="Tocá la obra donde viste la herramienta"
              />

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {obras.map(obra => (
                  <button
                    key={obra.id}
                    type="button"
                    onClick={() => handleSelectObra(obra)}
                    className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-left text-base font-bold text-slate-700 active:scale-[0.97] transition-all hover:border-peie-blue hover:bg-blue-50/30"
                  >
                    <MapPin size={20} className="text-peie-blue shrink-0" />
                    {obra.name}
                    <ChevronRight size={18} className="text-slate-300 ml-auto shrink-0" />
                  </button>
                ))}
              </div>

              {/* Shortcut to voice */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => goToStep('voice_describe')}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold active:scale-[0.97] transition-all"
                >
                  <Mic size={16} /> No sé la obra, quiero describirla con voz
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: TOOLS IN OBRA                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'tools_in_obra' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToStep('select_obra')} />
              <StepHeader 
                title={`Herramientas en ${selectedObra?.name || 'la obra'}`} 
                subtitle={toolsInObra.length > 0 ? "Tocá la que buscás" : undefined}
              />

              {toolsInObra.length > 0 ? (
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto">
                  {toolsInObra.map(tool => (
                    <ToolCard key={tool.id} tool={tool} onSelect={() => handleSelectTool(tool)} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Wrench size={28} />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No hay herramientas en esta obra</p>
                  <Button onClick={() => goToStep('select_obra')} variant="outline" className="rounded-xl font-bold">
                    Elegir otra obra
                  </Button>
                </div>
              )}

              {/* Voice fallback */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => goToStep('voice_describe')}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold active:scale-[0.97] transition-all"
                >
                  <Mic size={16} /> No la encuentro, describir con voz
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: VOICE DESCRIBE                                            */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'voice_describe' && (
            <div className="space-y-5">
              <BackButton onBack={resetAll} />
              <StepHeader 
                title="🎤 Describí la herramienta" 
                subtitle="Decí cómo es, de qué color, para qué sirve... lo que sea"
              />

              <div className="space-y-4">
                {/* Big mic button */}
                <div className="flex flex-col items-center gap-3">
                  <VoiceInputButton
                    onTranscript={(text) => setVoiceText(text)}
                    className="!w-20 !h-20 !rounded-full shadow-lg"
                  />
                  <p className="text-xs text-slate-400 font-medium text-center">
                    Tocá el micrófono y hablá
                  </p>
                </div>

                {/* Manual input as backup */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="O escribí acá..."
                    value={voiceText}
                    onChange={e => setVoiceText(e.target.value)}
                    className="pl-9 h-12 rounded-xl bg-white border-slate-200 text-base"
                  />
                </div>

                {voiceText.trim() && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Lo que dijiste:</p>
                    <p className="text-sm text-slate-800 font-medium">"{voiceText}"</p>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleVoiceSearch}
                  disabled={!voiceText.trim()}
                  className="w-full h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} /> BUSCAR
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: VOICE LOADING                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'voice_loading' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-sm font-bold text-emerald-700 animate-pulse flex items-center gap-2">
                <Sparkles size={16} /> Interpretando lo que dijiste...
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: VOICE RESULTS                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'voice_results' && (
            <div className="space-y-5">
              <BackButton onBack={() => goToStep('voice_describe')} />
              <StepHeader 
                title="¿Es alguna de estas?" 
                subtitle="Tocá la herramienta correcta"
              />

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {voiceResults.map(tool => (
                  <ToolCard key={tool.id} tool={tool} onSelect={() => handleSelectTool(tool)} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => goToStep('select_obra')}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-rose-200 text-rose-600 font-bold text-sm active:scale-[0.97] transition-all"
              >
                <X size={18} /> Ninguna, buscar por obra
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: CONFIRM TOOL                                              */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'confirm_tool' && activeTool && (
            <div className="space-y-5">
              <StepHeader title="¿Es esta la herramienta?" />

              {/* Big visual card */}
              <div className="bg-white border-2 border-peie-blue/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-4">
                  {activeTool.photo_url ? (
                    <img src={activeTool.photo_url} alt={activeTool.name} className="w-24 h-24 object-cover rounded-xl border border-slate-100 shrink-0" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                      <Wrench size={32} />
                    </div>
                  )}
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-mono font-bold text-peie-blue uppercase">{activeTool.code}</p>
                    <p className="text-lg font-black text-slate-800 leading-tight">{activeTool.name}</p>
                    <p className="text-sm text-slate-500">
                      {activeTool.brand || 'Sin marca'} {activeTool.model ? `· ${activeTool.model}` : ''}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-peie-blue" />
                      <span className="text-xs font-bold text-peie-blue">{activeTool.obras?.name || 'Base Central'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Big Yes / No buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleConfirmTool}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg shadow-emerald-500/30"
                >
                  <Check size={32} />
                  SÍ
                </button>
                <button
                  type="button"
                  onClick={handleRejectTool}
                  className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg shadow-rose-500/30"
                >
                  <X size={32} />
                  NO
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STEP: SELECT ACTION                                             */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {step === 'select_action' && activeTool && (
            <div className="space-y-5">
              <StepHeader title="¿Qué querés hacer?" />

              {/* Tool mini-summary */}
              <div className="bg-peie-blue/5 rounded-xl p-3 flex items-center gap-3 border border-peie-blue/10">
                {activeTool.photo_url ? (
                  <img src={activeTool.photo_url} alt={activeTool.name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <Wrench size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{activeTool.name}</p>
                  <p className="text-xs text-peie-blue font-semibold flex items-center gap-1">
                    <MapPin size={10} /> {activeTool.obras?.name || 'Base Central'}
                  </p>
                </div>
              </div>

              {/* Action buttons - BIG and clear */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { stopSpeaking(); navigate('/solicitudes/nueva', { state: { herramientaId: activeTool.id } }); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-peie-blue text-white active:scale-[0.97] transition-all shadow-lg shadow-peie-blue/20"
                >
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Truck size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">MOVER A OTRA OBRA</p>
                    <p className="text-xs text-white/80 font-medium">Pedir traslado de la herramienta</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { stopSpeaking(); navigate('/ordenes/nueva', { state: { herramientaId: activeTool.id } }); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-amber-500 text-white active:scale-[0.97] transition-all shadow-lg shadow-amber-500/20"
                >
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">ESTÁ ROTA</p>
                    <p className="text-xs text-white/80 font-medium">Reportar falla o rotura</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { stopSpeaking(); navigate(`/herramientas/${activeTool.id}`); }}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white border-2 border-slate-200 text-slate-800 active:scale-[0.97] transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <FileText size={28} />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black">VER FICHA</p>
                    <p className="text-xs text-slate-500 font-medium">Ver toda la info de la herramienta</p>
                  </div>
                </button>
              </div>

              {/* Search another */}
              <button
                type="button"
                onClick={resetAll}
                className="w-full flex items-center justify-center gap-2 h-11 text-sm font-bold text-slate-400 hover:text-peie-blue transition-colors"
              >
                <RotateCcw size={14} /> Buscar otra herramienta
              </button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Indicador de Control de Voz de pantalla completa (solo en móviles y si la voz está activada) */}
      {!isScreenListening && voiceOn && typeof window !== 'undefined' && window.innerWidth < 768 && ['welcome', 'confirm_tool', 'select_action'].includes(step) && (
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
            {step === 'confirm_tool' && 'Decí: SÍ o NO'}
            {step === 'select_action' && 'Decí: MOVER, ROTA o FICHA'}
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
