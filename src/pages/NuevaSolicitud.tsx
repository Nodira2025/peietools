import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Truck, 
  MessageCircle, 
  AlertCircle, 
  Search, 
  Building, 
  User, 
  Sparkles, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Mic, 
  MapPin, 
  AlertTriangle,
  ChevronRight,
  Wrench,
  Clock
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal';
import { speak, stopSpeaking, setVoiceEnabled, isSpeechSupported } from '../lib/voiceGuide';
import VoiceInputButton from '../components/VoiceInputButton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Obra {
  id: string;
  name: string;
  encargado_name?: string | null;
}

interface Herramienta {
  id: string;
  name: string;
  code: string;
  current_obra_id: string | null;
  status: string;
  obras?: { name: string } | null;
}

interface PersonalLogistica {
  id: string;
  full_name: string;
  whatsapp: string | null;
  role: string;
}

type WizardStep = 
  | 'select_tool'      // "¿Qué herramienta querés trasladar?"
  | 'select_date'      // "¿Para cuándo se necesita en obra?"
  | 'select_obra'      // "¿Hacia dónde debe enviarse?"
  | 'select_logistica' // "¿Quién lo transporta?"
  | 'select_priority'  // "¿Qué tan urgente es?"
  | 'enter_comments'   // "¿Querés agregar algún comentario?"
  | 'confirm_request'; // "Confirmar solicitud de traslado"

// ─── Component ───────────────────────────────────────────────────────────────

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  const preselectedToolId = location.state?.herramientaId || '';

  // Data State
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [personalLogistica, setPersonalLogistica] = useState<PersonalLogistica[]>([]);
  
  // Fields State
  const [selectedToolId, setSelectedToolId] = useState(preselectedToolId);
  const [requestedToolName, setRequestedToolName] = useState('');
  const [targetObraId, setTargetObraId] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');
  const [selectedLogisticaId, setSelectedLogisticaId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [comments, setComments] = useState('');

  const getDefaultNeededDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const [neededDate, setNeededDate] = useState(getDefaultNeededDate());
  const [loading, setLoading] = useState(false);



  // Layout View Mode (Form vs Wizard)
  const [isMobile, setIsMobile] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('select_tool');
  const [voiceOn, setVoiceOn] = useState(false); // Desactivada por defecto

  // WhatsApp Preview state
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waPreviewRecipientName, setWaPreviewRecipientName] = useState('');

  // Autocomplete search states
  const [toolSearch, setToolSearch] = useState('');
  const [isToolDropdownOpen, setIsToolDropdownOpen] = useState(false);
  const [logisticaSearch, setLogisticaSearch] = useState('');
  const [isLogisticaDropdownOpen, setIsLogisticaDropdownOpen] = useState(false);
  const [obraSearch, setObraSearch] = useState('');

  // Screen voice listening state
  const [isScreenListening, setIsScreenListening] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);


  // ─── Check Device Size ───────────────────────────────────────────────────

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // ─── Data Loading ────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchData() {
      // Cargar caché local en 0ms
      const cached = localStorage.getItem('peie_cache_herramientas');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHerramientas(parsed);
          }
        } catch (e) {
          console.error('Error al leer caché', e);
        }
      }

      // 1. Cargar todas las herramientas en segundo plano
      const { data: toolsData } = await supabase
        .from('herramientas')
        .select('id, name, code, current_obra_id, status, obras(name)')
        .order('name');
      if (toolsData) {
        setHerramientas(toolsData as unknown as Herramienta[]);
        try {
          localStorage.setItem('peie_cache_herramientas', JSON.stringify(toolsData));
        } catch (storageError) {
          console.warn('QuotaExceededError ignorado en NuevaSolicitud', storageError);
        }
        if (preselectedToolId) {
          const preTool = toolsData.find(h => h.id === preselectedToolId);
          if (preTool) {
            setToolSearch(`${preTool.name} [${preTool.code}]`);
            setWizardStep('select_obra');
          }
        } else if (!wizardStep) {
          setWizardStep('select_tool');
        }
      }

      // 2. Cargar Obras destino
      const { data: obrasData } = await supabase
        .from('obras')
        .select('id, name, encargado_name')
        .eq('active', true)
        .order('name');
      if (obrasData) {
        setObras(obrasData);
      }

      // 3. Cargar Personal de Logística
      const { data: logisticaData } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp, role')
        .eq('active', true)
        .eq('role', 'logistica')
        .order('full_name');
      if (logisticaData) setPersonalLogistica(logisticaData as PersonalLogistica[]);
    }

    fetchData();

    // Sincronizar desactivación por defecto al ingresar
    setVoiceEnabled(false);
    stopSpeaking();

    return () => {
      stopSpeaking();
    };
  }, [preselectedToolId]);

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
    if (!isMobile) return;
    const messages: Record<WizardStep, string> = {
      select_tool: '¿Qué herramienta deseás trasladar? Buscala por su nombre o código en la lista.',
      select_obra: '¿Hacia qué obra debe enviarse la herramienta? Seleccioná la obra de destino.',
      select_logistica: '¿Quién es el encargado de logística que transportará la herramienta?',
      select_priority: '¿Qué tan urgente es el traslado? Elegí prioridad baja, normal o urgente.',
      enter_comments: '¿Querés agregar algún comentario o especificación para el viaje? Hablá o presioná continuar.',
      confirm_request: 'Por favor, confirmá la solicitud de traslado para notificar por WhatsApp al encargado.',
    };
    if (messages[wizardStep]) {
      const timer = setTimeout(() => guideSpeak(messages[wizardStep]), 400);
      return () => clearTimeout(timer);
    }
  }, [wizardStep, isMobile, guideSpeak]);

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
      const rawText = event.results?.[0]?.[0]?.transcript;
      const transcript = typeof rawText === 'string' ? rawText.toLowerCase().trim() : '';
      processVoiceCommand(transcript);
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
    }
  };

  const processVoiceCommand = (command: string) => {
    if (wizardStep === 'select_priority') {
      if (command.includes('normal') || command.includes('azul')) {
        setPriority('Normal');
        goToWizardStep('enter_comments');
      } else if (command.includes('urgente') || command.includes('rojo') || command.includes('rápido') || command.includes('rapido')) {
        setPriority('Urgente');
        goToWizardStep('enter_comments');
      } else if (command.includes('baja') || command.includes('gris') || command.includes('tranquilo')) {
        setPriority('Baja');
        goToWizardStep('enter_comments');
      } else {
        guideSpeak('No entendí. Decí NORMAL, URGENTE o BAJA.');
      }
    } else if (wizardStep === 'confirm_request') {
      if (command.includes('sí') || command.includes('si') || command.includes('confirmar') || command.includes('verde') || command.includes('enviar')) {
        handleConfirmSubmit();
      } else if (command.includes('no') || command.includes('cancelar') || command.includes('rojo') || command.includes('atrás') || command.includes('atras')) {
        goToWizardStep('enter_comments');
      } else {
        guideSpeak('No entendí. Decí SÍ para confirmar.');
      }
    }
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    if (!isMobile || isScreenListening || loading) return;
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea') || target.closest('label');
    if (isInteractive) return;

    const voiceActiveSteps: WizardStep[] = ['select_priority', 'confirm_request'];
    if (voiceActiveSteps.includes(wizardStep)) {
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
    goToWizardStep('select_priority');
  };

  const handleSelectLogisticaWizard = (logisticaId: string) => {
    setSelectedLogisticaId(logisticaId);
    goToWizardStep('select_priority');
  };


  const handleSelectPriorityWizard = (pri: string) => {
    setPriority(pri);
    goToWizardStep('enter_comments');
  };

  const handleConfirmSubmit = async () => {
    await executeSubmit();
  };

  // ─── Actions & Submissions ───────────────────────────────────────────────

  const normalizeString = (str: string): string => {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const filteredHerramientas = herramientas.filter(t => {
    const searchNorm = normalizeString(toolSearch);
    if (!searchNorm) return true;
    const nameNorm = normalizeString(t.name);
    const codeNorm = normalizeString(t.code);
    return nameNorm.includes(searchNorm) || codeNorm.includes(searchNorm);
  });

  const filteredLogistica = personalLogistica.filter(p => {
    const searchNorm = normalizeString(logisticaSearch);
    if (!searchNorm) return true;
    const nameNorm = normalizeString(p.full_name);
    return nameNorm.includes(searchNorm);
  });

  const filteredObras = obras.filter(o => {
    const matchEncargado = !filterEncargado || o.encargado_name === filterEncargado;
    if (!matchEncargado) return false;
    const searchNorm = normalizeString(obraSearch);
    if (!searchNorm) return true;
    const nameNorm = normalizeString(o.name);
    return nameNorm.includes(searchNorm);
  });
  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter((e): e is string => !!e))].sort();

  const handleEncargadoChange = (val: string) => {
    const actualVal = val === '_all_' ? '' : val;
    setFilterEncargado(actualVal);
    setTargetObraId('');
  };

  const executeSubmit = async () => {
    if (!profile) return;

    const tool = herramientas.find(h => h.id === selectedToolId);
    const finalToolName = requestedToolName.trim() || tool?.name || toolSearch.trim();

    if (!tool && !finalToolName) {
      toast({ 
        variant: 'destructive', 
        title: 'Herramienta requerida', 
        description: 'Por favor indicá el nombre de la herramienta (dictando por voz o escribiendo).' 
      });
      return;
    }

    if (!targetObraId) {
      toast({ 
        variant: 'destructive', 
        title: 'Obra de destino requerida', 
        description: 'Por favor seleccioná la obra de destino.' 
      });
      return;
    }

    const logisticaUser = selectedLogisticaId 
      ? personalLogistica.find(p => p.id === selectedLogisticaId) 
      : (personalLogistica[0] || null);
    const targetObra = obras.find(o => o.id === targetObraId);

    if (!targetObra) {
      toast({ variant: 'destructive', title: 'Error', description: 'Seleccioná una obra de destino válida.' });
      return;
    }

    // Calcular Fecha de Necesidad ISO
    const neededDateObj = neededDate ? new Date(neededDate) : new Date();
    const neededDateIso = neededDateObj.toISOString();

    setLoading(true);
    const securityCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Guardar la solicitud
    const insertPayload: any = {
      requester_id: profile.id,
      herramienta_id: tool ? tool.id : null,
      requested_tool_name: finalToolName,
      source_obra_id: tool ? tool.current_obra_id : null,
      target_obra_id: targetObraId,
      assigned_to: selectedLogisticaId || null,
      assigned_logistica_id: null,

      priority,
      status: 'Pendiente',
      comments: comments.trim() || null,
      needed_date: neededDateIso,
      security_code: securityCode
    };


    let { data: newSolicitud, error } = await supabase.from('solicitudes').insert([insertPayload]).select().single();

    if (error && error.message?.includes('needed_date')) {
      delete insertPayload.needed_date;
      const retry = await supabase.from('solicitudes').insert([insertPayload]).select().single();
      newSolicitud = retry.data;
      error = retry.error;
    }


    if (newSolicitud && tool) {
      await supabase.from('movimientos').insert([{
        herramienta_id: tool.id,
        solicitud_id: newSolicitud.id,
        user_id: profile.id,
        action: 'Generó solicitud de traslado',
        notes: `Hacia obra destino con prioridad ${priority}`
      }]);
    }

    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error al solicitar', description: error.message });
    } else {
      toast({ title: '¡Solicitud Generada!', description: 'Notificando a logística por WhatsApp...' });
      
      const toolDescription = finalToolName;
      const origenActual = tool?.obras?.name || 'Pendiente de asignación por Logística';
      const logName = logisticaUser ? logisticaUser.full_name.split(' ')[0] : 'Logística';
      const waMessage = [
        '*NUEVA SOLICITUD DE TRASLADO*',
        '',
        `Hola *${logName}*, tenés un nuevo pedido de logística:`,
        '',
        `- *Solicita:* ${profile.full_name} (${profile.role || 'Solicitante'})`,
        `- *Herramienta:* ${toolDescription}`,
        `- *Origen actual:* ${origenActual}`,
        `- *Destino:* ${targetObra.name}`,
        `- *Fecha requerida:* ${neededDateObj.toLocaleString('es-AR')}`,
        `- *Prioridad:* ${priority}`,
        '',
        `*Notas:* ${comments.trim() || 'Sin especificaciones'}`,
        '',
        'Gestionar el envío desde la app:',
        `${APP_URL}/solicitudes/${newSolicitud.id}`
      ].join('\n');

      if (logisticaUser?.whatsapp) {

        setWaPreviewPhone(logisticaUser.whatsapp);
        setWaPreviewMessage(waMessage);
        setWaPreviewRecipientName(logisticaUser.full_name);
        setWaPreviewOpen(true);
      } else {
        navigate('/solicitudes/' + newSolicitud.id);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSubmit();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const toolSelectedObject = herramientas.find(h => h.id === selectedToolId);
  const targetObraObject = obras.find(o => o.id === targetObraId);
  const logisticaUserObject = personalLogistica.find(p => p.id === selectedLogisticaId);

  return (
    <div onClick={handleScreenClick} className="space-y-4 max-w-xl mx-auto pb-safe min-h-[85vh]">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => { stopSpeaking(); navigate(-1); }} className="p-0 hover:bg-transparent text-peie-blue text-xs">
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
        <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
          <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
          <CardHeader className="pb-4 pt-6 px-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-peie-light/10 text-peie-blue font-bold">
                <Truck size={20} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-peie-blue">Movimiento de Herramientas</CardTitle>
                <CardDescription className="text-xs">Coordina el traslado seleccionando al personal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Autocomplete Herramienta */}
              <div className="space-y-2 relative">
                <Label htmlFor="tool-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Herramienta *</Label>
                <div className="relative">
                  <Input
                    id="tool-select"
                    placeholder="Escribí para buscar herramienta..."
                    value={toolSearch}
                    onChange={(e) => {
                      setToolSearch(e.target.value);
                      setSelectedToolId('');
                      setIsToolDropdownOpen(true);
                    }}
                    onFocus={() => setIsToolDropdownOpen(true)}
                    className="h-11 rounded-xl bg-slate-50/50"
                  />
                  {selectedToolId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Seleccionado
                    </span>
                  )}
                </div>
                {isToolDropdownOpen && filteredHerramientas.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredHerramientas.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedToolId(t.id);
                          setToolSearch(`${t.name} [${t.code}]`);
                          setIsToolDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700"
                      >
                        {t.name} <span className="text-xs text-slate-400">[{t.code}]</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Encargado Filter */}
              <div className="space-y-2">
                <Label htmlFor="encargado-filter" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Encargado de Obra (Filtrar Destinos)</Label>
                <Select value={filterEncargado || '_all_'} onValueChange={handleEncargadoChange}>
                  <SelectTrigger id="encargado-filter" className="h-11 rounded-xl bg-slate-50/50">
                    <SelectValue placeholder="Todos los encargados" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="_all_">Todos los encargados</SelectItem>
                    {encargadosUnicos.map((e, idx) => (
                      <SelectItem key={idx} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <Label htmlFor="destino-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Destino *</Label>
                <Select value={targetObraId} onValueChange={setTargetObraId}>
                  <SelectTrigger id="destino-select" className="h-11 rounded-xl bg-slate-50/50">
                    <SelectValue placeholder="¿Hacia dónde debe enviarse?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {filteredObras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Autocomplete Responsable de Logística */}
              <div className="space-y-2 relative bg-peie-light/5 p-4 rounded-2xl border border-peie-light/10">
                <Label htmlFor="logistica-select" className="text-xs font-bold text-peie-blue uppercase tracking-wider flex items-center gap-1">
                  <MessageCircle size={14} /> DESPACHAR MENSAJE A LOGÍSTICA *
                </Label>
                <span className="text-[10px] text-slate-400 block font-semibold leading-tight mb-2">
                  Elige de la lista al empleado o administrador encargado para que reciba la orden por WhatsApp.
                </span>
                <div className="relative">
                  <Input
                    id="logistica-select"
                    placeholder="Escribí para buscar responsable..."
                    value={logisticaSearch}
                    onChange={(e) => {
                      setLogisticaSearch(e.target.value);
                      setSelectedLogisticaId('');
                      setIsLogisticaDropdownOpen(true);
                    }}
                    onFocus={() => setIsLogisticaDropdownOpen(true)}
                    className="h-11 rounded-xl bg-white border-slate-200"
                  />
                  {selectedLogisticaId && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      Seleccionado
                    </span>
                  )}
                </div>
                {isLogisticaDropdownOpen && filteredLogistica.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredLogistica.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedLogisticaId(p.id);
                          setLogisticaSearch(p.full_name);
                          setIsLogisticaDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold text-slate-700"
                      >
                        {p.full_name} <span className="text-xs text-slate-400">({p.role === 'admin' ? 'Admin' : 'Logística'})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fecha y Hora de Necesidad en Obra (Único selector) */}
              <div className="space-y-2 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/60">
                <Label htmlFor="needed-date-input" className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600" /> FECHA Y HORA DE NECESIDAD EN OBRA *
                </Label>
                <Input
                  id="needed-date-input"
                  type="datetime-local"
                  value={neededDate}
                  onChange={(e) => setNeededDate(e.target.value)}
                  className="h-11 rounded-xl bg-white border-slate-200 text-sm font-bold text-slate-800"
                  required
                />
              </div>

              {/* Prioridad */}
              <div className="space-y-2">
                <Label htmlFor="prioridad-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nivel de Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="prioridad-select" className="h-11 rounded-xl bg-slate-50/50">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Baja">Baja</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comentarios */}
              <div className="space-y-2">
                <Label htmlFor="comments-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comentarios Adicionales</Label>
                <div className="flex gap-2">
                  <Input
                    id="comments-input"
                    placeholder="Ej: Se requiere para hormigonado de losa..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="h-11 rounded-xl bg-slate-50/50 flex-1"
                  />
                  <VoiceInputButton onTranscript={(text) => setComments(prev => (typeof prev === 'string' ? (prev + ' ' + (text || '')).trim() : (text || '').trim()))} className="h-11 w-11 shrink-0" />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !selectedToolId || !targetObraId || !selectedLogisticaId}
                className="w-full h-12 bg-peie-blue hover:bg-peie-blue/90 font-bold rounded-xl flex items-center justify-center gap-2 mt-6 text-white"
              >
                {loading ? 'Generando solicitud...' : (
                  <>
                    <MessageCircle size={18} /> Confirmar y Notificar por WhatsApp
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 📱 MOBILE WIZARD VIEW */}
      {isMobile && (
        <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
          <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
          <CardContent className="px-5 py-6 space-y-5">

            {/* STEP 0: SELECT TOOL (Catálogo o Dictado Genérico) */}
            {wizardStep === 'select_tool' && (
              <div className="space-y-4">
                <BackButton onBack={() => navigate(-1)} />
                <StepHeader 
                  title="¿Qué herramienta necesitás?" 
                  subtitle="Escribí, dictá por voz o elegí del catálogo"
                />

                {/* Entrada Genérica Rápida / Dictado por Voz */}
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Dictar por voz o escribir (ej: Taladro)
                    </label>
                    <VoiceInputButton
                      onTranscript={(text) => {
                        setRequestedToolName(text);
                        setToolSearch(text);
                      }}
                    />
                  </div>
                  <Input
                    placeholder="Ej: Taladro percutor, Amoladora 7''..."
                    value={requestedToolName || toolSearch}
                    onChange={(e) => {
                      setRequestedToolName(e.target.value);
                      setToolSearch(e.target.value);
                    }}
                    className="h-11 rounded-xl bg-white border-amber-200 text-sm font-bold text-slate-800"
                  />
                  {(requestedToolName || toolSearch).trim().length > 0 && (
                    <Button
                      type="button"
                      onClick={() => {
                        if (!requestedToolName) setRequestedToolName(toolSearch.trim());
                        goToWizardStep('select_date');
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 rounded-xl text-xs shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>Usar "{(requestedToolName || toolSearch).trim()}"</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">O elegí una del catálogo oficial:</p>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por código o nombre..."
                      value={toolSearch}
                      onChange={(e) => {
                        setToolSearch(e.target.value);
                        setSelectedToolId('');
                      }}
                      className="h-12 pl-10 rounded-2xl border-slate-200 focus-visible:ring-peie-blue bg-slate-50/50 text-sm font-semibold"
                    />
                  </div>


                  <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                    {filteredHerramientas.slice(0, 20).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedToolId(t.id);
                          setToolSearch(`${t.name} [${t.code}]`);
                          goToWizardStep('select_date');
                        }}
                        className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left active:scale-[0.97] transition-all ${
                          selectedToolId === t.id
                            ? 'border-peie-blue bg-peie-blue/5'
                            : 'border-slate-200 bg-white hover:border-peie-blue'
                        }`}
                      >
                        <Wrench size={20} className="text-peie-blue shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-700 truncate">{t.name}</p>
                          <p className="text-xs text-slate-400 font-bold">Código: {t.code} • Ubicación: {t.obras?.name || 'Base Central'}</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300 shrink-0" />
                      </button>
                    ))}
                    {filteredHerramientas.length === 0 && (
                      <div className="text-center py-8 text-slate-400 font-semibold text-sm">
                        No se encontraron herramientas en el catálogo.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: SELECT FECHA Y HORA DE NECESIDAD EN OBRA */}
            {wizardStep === 'select_date' && (
              <div className="space-y-5">
                <BackButton onBack={() => goToWizardStep('select_tool')} />
                <StepHeader 
                  title="¿Cuándo se necesita en obra?" 
                  subtitle="Seleccioná el día y la hora exacta de entrega"
                />

                <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock size={20} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Fecha y Hora de Entrega Requerida</span>
                  </div>

                  <Input
                    type="datetime-local"
                    value={neededDate}
                    onChange={(e) => setNeededDate(e.target.value)}
                    className="h-14 rounded-xl text-base font-bold bg-white border-slate-200 text-slate-800"
                    required
                  />

                  <Button
                    disabled={!neededDate}
                    onClick={() => goToWizardStep('select_obra')}
                    className="w-full h-13 bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-xl text-sm shadow-lg flex items-center justify-center gap-2"
                  >
                    Confirmar Fecha y Continuar <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 1: SELECT OBRA */}
            {wizardStep === 'select_obra' && (
              <div className="space-y-5">
                <BackButton onBack={() => goToWizardStep('select_tool')} />
                <StepHeader 
                  title="¿Hacia dónde debe enviarse?" 
                  subtitle="Seleccioná la obra de destino"
                />

                {/* Preselected tool name */}
                {(toolSelectedObject || toolSearch.trim()) && (
                  <div className="bg-slate-50 rounded-xl p-3 border text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Herramienta Pedida</span>
                    <p className="text-sm font-black text-slate-700">{toolSelectedObject ? `${toolSelectedObject.name} [${toolSelectedObject.code}]` : toolSearch.trim()}</p>
                  </div>
                )}

                {/* Search bar for Obra with Voice Dictation */}
                <div className="relative">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Buscar obra..."
                    value={obraSearch}
                    onChange={(e) => setObraSearch(e.target.value)}
                    className="pl-10 pr-12 h-12 rounded-2xl border-2 border-slate-200 bg-white text-base font-medium shadow-sm focus-visible:ring-peie-blue"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {obraSearch && (
                      <button
                        type="button"
                        onClick={() => setObraSearch('')}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <VoiceInputButton
                      onTranscript={(text) => setObraSearch(text)}
                      className="!h-9 !w-9 !rounded-xl"
                    />
                  </div>
                </div>

                {/* Obras lists */}
                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto">
                  {filteredObras.length > 0 ? (
                    filteredObras.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSelectObraWizard(o.id)}
                        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-left text-base font-bold text-slate-700 active:scale-[0.97] transition-all hover:border-peie-blue"
                      >
                        <MapPin size={20} className="text-peie-blue shrink-0" />
                        {o.name}
                        <ChevronRight size={18} className="text-slate-300 ml-auto shrink-0" />
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed text-sm font-medium">
                      No se encontraron obras con ese nombre
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: SELECT LOGISTICA */}
            {wizardStep === 'select_logistica' && (
              <div className="space-y-5">
                <BackButton onBack={() => goToWizardStep('select_obra')} />
                <StepHeader 
                  title="¿Quién lo transporta?" 
                  subtitle="Elegí al encargado de logística"
                />

                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                  {personalLogistica.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectLogisticaWizard(p.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-left text-base font-bold text-slate-700 active:scale-[0.97] transition-all hover:border-peie-blue"
                    >
                      <User size={20} className="text-peie-blue shrink-0" />
                      <div>
                        <p className="font-black text-slate-800">{p.full_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{p.role === 'admin' ? 'Administrador' : 'Logística'}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: SELECT PRIORITY */}
            {wizardStep === 'select_priority' && (
              <div className="space-y-5">
                <BackButton onBack={() => goToWizardStep('select_obra')} />

                <StepHeader 
                  title="¿Qué tan urgente es?" 
                  subtitle="Elegí el nivel de prioridad"
                />

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectPriorityWizard('Normal')}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-peie-blue text-white active:scale-[0.97] transition-all shadow-md"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Truck size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-base font-black">NORMAL</p>
                      <p className="text-xs text-white/80">Envío en el transcurso del día</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPriorityWizard('Urgente')}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-rose-600 text-white active:scale-[0.97] transition-all shadow-md"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <AlertTriangle size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-base font-black">URGENTE</p>
                      <p className="text-xs text-white/80">Envío lo más rápido posible</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPriorityWizard('Baja')}
                    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-slate-500 text-white active:scale-[0.97] transition-all shadow-md"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Check size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-base font-black">BAJA</p>
                      <p className="text-xs text-white/80">Cuando haya espacio disponible</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ENTER COMMENTS */}
            {wizardStep === 'enter_comments' && (
              <div className="space-y-5">
                <BackButton onBack={() => goToWizardStep('select_priority')} />
                <StepHeader 
                  title="¿Querés agregar algún comentario?" 
                  subtitle="Podés especificar alguna nota para el viaje o dejarlo en blanco"
                />

                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <VoiceInputButton
                      onTranscript={(text) => setComments(prev => (typeof prev === 'string' ? (prev + ' ' + (text || '')).trim() : (text || '').trim()))}
                      className="!w-16 !h-16 !rounded-full shadow-lg"
                    />
                    <p className="text-xs text-slate-400 font-medium">Dictar comentarios con voz</p>
                  </div>

                  <textarea
                    placeholder="Escribí o dictá acá..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full h-32 rounded-xl border border-slate-200 p-3 text-base"
                  />

                  <Button
                    type="button"
                    onClick={() => goToWizardStep('confirm_request')}
                    className="w-full h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black text-base rounded-2xl flex items-center justify-center"
                  >
                    CONTINUAR
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: CONFIRM REQUEST */}
            {wizardStep === 'confirm_request' && (
              <div className="space-y-5">
                <StepHeader title="¿Confirmás la solicitud?" />

                {/* Resume Card */}
                <div className="border border-slate-200 bg-slate-50/50 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-3">
                    <Truck className="text-peie-blue shrink-0" size={18} />
                    <span className="text-xs text-slate-500 font-bold uppercase">Resumen del Traslado</span>
                  </div>

                  <div className="space-y-2 text-sm text-slate-700 font-medium">
                    <p>📦 <strong className="text-slate-500">Herramienta:</strong> {toolSelectedObject ? `${toolSelectedObject.name} [${toolSelectedObject.code}]` : (toolSearch.trim() || 'Herramienta solicitada')}</p>
                    <p>🕒 <strong className="text-slate-500">Fecha de Necesidad:</strong> <span className="font-bold text-amber-800">{neededDate ? new Date(neededDate).toLocaleString('es-AR') : 'No especificada'}</span></p>
                    <p>🚩 <strong className="text-slate-500">Origen:</strong> {toolSelectedObject?.obras?.name || 'A determinar por Logística'}</p>
                    <p>📍 <strong className="text-slate-500">Destino:</strong> {targetObraObject?.name || 'No seleccionada'}</p>
                    <p>👤 <strong className="text-slate-500">Encargado Logística:</strong> {logisticaUserObject?.full_name || personalLogistica[0]?.full_name || 'Asignación automática'}</p>
                    <p>🔔 <strong className="text-slate-500">Prioridad:</strong> <span className={priority === 'Urgente' ? 'text-rose-600 font-bold' : 'text-slate-800'}>{priority}</span></p>
                    {(typeof comments === 'string' && comments.trim()) ? <p>💬 <strong className="text-slate-500">Nota:</strong> "{comments}"</p> : null}
                  </div>
                </div>

                {/* Yes/No Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg disabled:opacity-50"
                  >
                    <Check size={32} />
                    SÍ, ENVIAR
                  </button>
                  <button
                    type="button"
                    onClick={() => goToWizardStep('enter_comments')}
                    disabled={loading}
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
      {isMobile && !isScreenListening && voiceOn && ['select_priority', 'confirm_request'].includes(wizardStep) && (
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
            {wizardStep === 'select_priority' && 'Decí: NORMAL, URGENTE o BAJA'}
            {wizardStep === 'confirm_request' && 'Decí: SÍ para enviar o NO para modificar'}
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

      {/* Modal de envío de WhatsApp */}
      <WhatsAppPreviewModal
        isOpen={waPreviewOpen}
        onClose={() => {
          setWaPreviewOpen(false);
          stopSpeaking();
          navigate('/pedidos-herramientas');
        }}
        phone={waPreviewPhone}
        message={waPreviewMessage}
        recipientName={waPreviewRecipientName}
      />
    </div>
  );
}

// ─── Auxiliary Components ────────────────────────────────────────────────────

// ─── Auxiliary Components ────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center space-y-2 py-2">
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
      className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-peie-blue transition-colors py-2"
    >
      <ArrowLeft size={14} /> Volver
    </button>
  );
}

