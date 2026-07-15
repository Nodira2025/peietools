import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Mic,
  Building
} from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import { analyzeToolImage, interpretUserInput } from '../lib/openrouter';
import VoiceInputButton from '../components/VoiceInputButton';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  category: string | null;
  photo_url?: string | null;
  obra_id?: string | null;
  obras?: { name: string } | null;
}

interface Obra {
  id: string;
  name: string;
}

type FlowStep = 'idle' | 'loading' | 'show_matches' | 'filter_by_obra' | 'voice_assist' | 'confirmed';

export default function BusquedaVisual() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [allTools, setAllTools] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoName, setUploadedPhotoName] = useState('');
  
  const [flowStep, setFlowStep] = useState<FlowStep>('idle');
  const [aiResult, setAiResult] = useState<any>(null);
  
  // Top matches from fuzzy search
  const [topMatches, setTopMatches] = useState<{ tool: Herramienta; score: number }[]>([]);
  
  // Selected tool (final)
  const [activeTool, setActiveTool] = useState<Herramienta | null>(null);
  
  // Obra filter step
  const [selectedObra, setSelectedObra] = useState<string | null>(null);
  const [toolsInObra, setToolsInObra] = useState<Herramienta[]>([]);
  
  // Voice assist step
  const [voiceText, setVoiceText] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResults, setVoiceResults] = useState<Herramienta[]>([]);

  // Load full inventory + obras list
  useEffect(() => {
    async function loadData() {
      const [toolsRes, obrasRes] = await Promise.all([
        supabase.from('herramientas').select('*, obras(name)'),
        supabase.from('obras').select('id, name').eq('active', true).order('name')
      ]);
      
      if (toolsRes.data) {
        const normalized = toolsRes.data.map((h: any) => ({
          ...h,
          obras: Array.isArray(h.obras) ? h.obras[0] : h.obras
        })) as Herramienta[];
        setAllTools(normalized);
      }
      if (obrasRes.data) {
        setObras(obrasRes.data);
      }
    }
    loadData();
  }, []);

  // Reset everything for a new search
  const resetSearch = () => {
    setFlowStep('idle');
    setAiResult(null);
    setTopMatches([]);
    setActiveTool(null);
    setSelectedObra(null);
    setToolsInObra([]);
    setVoiceText('');
    setVoiceResults([]);
    setPhotoUrl(null);
    setUploadedPhotoName('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPhotoName(file.name);
      setAiResult(null);
      setTopMatches([]);
      setActiveTool(null);
      setSelectedObra(null);
      setVoiceText('');
      setVoiceResults([]);
      
      try {
        setFlowStep('loading');
        const compressed = await compressImage(file);
        setPhotoUrl(compressed);
        
        const parsed = await analyzeToolImage(compressed);
        setAiResult(parsed);
        console.log('[BusquedaVisual] AI result:', parsed);

        findTopMatches(parsed);
      } catch (err: any) {
        console.error(err);
        if (err.message === 'CONFIG_REQUIRED') {
          const userKey = window.prompt("Ingresá tu API Key de OpenRouter para habilitar el reconocimiento visual (se guarda en tu navegador):");
          if (userKey) {
            localStorage.setItem('VITE_OPENROUTER_API_KEY', userKey.trim());
            toast({ title: "API Key guardada", description: "Intentá de nuevo cargar la foto." });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Error de Análisis',
            description: err.message || 'No se pudo identificar la herramienta.'
          });
        }
        setFlowStep('idle');
      }
    }
  };

  const findTopMatches = (aiData: any) => {
    if (allTools.length === 0) {
      setFlowStep('filter_by_obra');
      return;
    }

    const brandNorm = (aiData.marca || '').toLowerCase().trim();
    const modelNorm = (aiData.modelo || '').toLowerCase().trim();
    const nameNorm = (aiData.nombre_sugerido || '').toLowerCase().trim();
    const catNorm = (aiData.categoria || '').toLowerCase().trim();

    const scoredTools = allTools.map(tool => {
      let score = 0;
      const tName = tool.name.toLowerCase();
      const tBrand = (tool.brand || '').toLowerCase();
      const tModel = (tool.model || '').toLowerCase();
      const tCat = (tool.category || '').toLowerCase();

      // Brand match
      if (brandNorm && tBrand && (tBrand.includes(brandNorm) || brandNorm.includes(tBrand))) {
        score += 15;
      }

      // Model match
      if (modelNorm && tModel) {
        if (tModel === modelNorm) score += 30;
        else if (tModel.includes(modelNorm) || modelNorm.includes(tModel)) score += 20;
      }

      // Name match (word-level)
      if (nameNorm && tName) {
        const nameWords = nameNorm.split(/\s+/);
        const matchWords = nameWords.filter(w => w.length > 2 && tName.includes(w));
        score += matchWords.length * 5;
        
        // Bonus for exact substring
        if (tName.includes(nameNorm) || nameNorm.includes(tName)) {
          score += 10;
        }
      }

      // Category match
      if (catNorm && tCat && (tCat.includes(catNorm) || catNorm.includes(tCat))) {
        score += 5;
      }

      return { tool, score };
    });

    // Take top 3 with minimum score
    const sorted = scoredTools.filter(x => x.score > 5).sort((a, b) => b.score - a.score).slice(0, 3);

    if (sorted.length > 0) {
      setTopMatches(sorted);
      setFlowStep('show_matches');
    } else {
      setTopMatches([]);
      toast({
        title: 'No se encontró en el inventario',
        description: 'Podés buscar por obra o describir la herramienta con tu voz.'
      });
      setFlowStep('filter_by_obra');
    }
  };

  // When user selects a tool from top matches
  const handleSelectMatch = (tool: Herramienta) => {
    setActiveTool(tool);
    setFlowStep('confirmed');
  };

  // When user rejects all matches
  const handleRejectAll = () => {
    setTopMatches([]);
    setFlowStep('filter_by_obra');
  };

  // Filter tools by selected obra
  const handleSelectObra = (obraId: string) => {
    setSelectedObra(obraId);
    const filtered = allTools.filter(t => t.obra_id === obraId);
    setToolsInObra(filtered);
  };

  // AI-assisted voice search
  const handleVoiceSearch = async () => {
    if (!voiceText.trim()) return;

    try {
      setVoiceLoading(true);
      const interpreted = await interpretUserInput(voiceText);
      console.log('[BusquedaVisual] AI interpreted:', interpreted);

      toast({
        title: `Entendido: "${interpreted.tipo_herramienta}"`,
        description: interpreted.descripcion
      });

      // Search allTools using interpreted terms
      const terms = [
        interpreted.tipo_herramienta.toLowerCase(), 
        ...interpreted.terminos.map(t => t.toLowerCase())
      ];
      
      const scored = allTools.map(tool => {
        let score = 0;
        const tName = tool.name.toLowerCase();
        const tBrand = (tool.brand || '').toLowerCase();
        const tModel = (tool.model || '').toLowerCase();
        const tCat = (tool.category || '').toLowerCase();
        const allText = `${tName} ${tBrand} ${tModel} ${tCat}`;

        for (const term of terms) {
          if (term.length < 2) continue;
          const termWords = term.split(/\s+/);
          for (const w of termWords) {
            if (w.length > 2 && allText.includes(w)) score += 5;
          }
        }
        return { tool, score };
      });

      // Filter by obra if selected
      let results = scored.filter(x => x.score > 0);
      if (selectedObra) {
        results = results.filter(x => x.tool.obra_id === selectedObra);
      }
      
      const sorted = results.sort((a, b) => b.score - a.score).slice(0, 5);
      setVoiceResults(sorted.map(x => x.tool));

      if (sorted.length === 0) {
        toast({ 
          variant: 'destructive', 
          title: 'Sin resultados', 
          description: 'No se encontraron herramientas con esa descripción. Intentá con otras palabras.' 
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al interpretar',
        description: err.message || 'No se pudo interpretar la descripción.'
      });
    } finally {
      setVoiceLoading(false);
    }
  };

  // Render a tool card (reused in multiple steps)
  const ToolCard = ({ tool, onSelect, highlight = false }: { tool: Herramienta; onSelect: () => void; highlight?: boolean }) => (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
        highlight 
          ? 'border-peie-blue bg-peie-blue/5 shadow-md' 
          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30 shadow-sm'
      }`}
    >
      {tool.photo_url ? (
        <img src={tool.photo_url} alt={tool.name} className="w-16 h-16 object-cover rounded-lg border border-slate-100 shrink-0" />
      ) : (
        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
          <Wrench size={22} />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[10px] font-mono font-bold text-peie-blue uppercase">{tool.code}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{tool.name}</p>
        <p className="text-[11px] text-slate-500 truncate">
          {tool.brand || 'Sin marca'} {tool.model ? `· ${tool.model}` : ''}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={10} className="text-slate-400 shrink-0" />
          <span className="text-[10px] font-semibold text-slate-600 truncate">{tool.obras?.name || 'Base Central'}</span>
        </div>
      </div>
      <Check size={18} className="text-slate-300 shrink-0" />
    </button>
  );

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inventario
        </Button>
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-blue/10 text-peie-blue font-bold">
              <Camera size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">Buscador de Herramientas</CardTitle>
              <CardDescription className="text-xs">Sacá una foto, elegí por obra o describila con tu voz</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-6">
          {/* 1. Photo Upload (Always visible when not confirmed) */}
          {flowStep !== 'confirmed' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="file" id="search-photo-camera" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                <input type="file" id="search-photo-gallery" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <Label
                  htmlFor="search-photo-camera"
                  className="flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-peie-blue/30 border-dashed bg-peie-blue/5 text-sm text-peie-blue font-bold hover:bg-peie-blue/10 cursor-pointer active:scale-95 transition-all text-center"
                >
                  📷 Sacar Foto
                </Label>
                <Label
                  htmlFor="search-photo-gallery"
                  className="flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border-2 border-slate-200 border-dashed bg-white text-sm text-slate-700 font-bold hover:bg-violet-50 hover:border-violet-300 cursor-pointer active:scale-95 transition-all text-center"
                >
                  📁 Elegir de Galería
                </Label>
              </div>

              {uploadedPhotoName && (
                <p className="text-xs text-center text-slate-500 font-semibold">
                  Foto cargada: <span className="text-peie-blue">{uploadedPhotoName}</span>
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {flowStep === 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-9 h-9 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
              <div className="flex items-center gap-1.5 text-xs font-semibold text-peie-blue animate-pulse">
                <Sparkles size={14} /> Analizando imagen y buscando coincidencias...
              </div>
            </div>
          )}

          {/* 2. TOP MATCHES - Show up to 3 candidates */}
          {flowStep === 'show_matches' && topMatches.length > 0 && (
            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  {topMatches.length === 1 ? '1 Coincidencia' : `${topMatches.length} Coincidencias`}
                </span>
                <h3 className="text-base font-black text-slate-800 mt-2">¿Cuál es tu herramienta?</h3>
                <p className="text-xs text-slate-500">Tocá la herramienta correcta</p>
              </div>

              <div className="space-y-2.5">
                {topMatches.map(({ tool, score }, i) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onSelect={() => handleSelectMatch(tool)}
                    highlight={i === 0}
                  />
                ))}
              </div>

              <Button
                onClick={handleRejectAll}
                variant="outline"
                className="w-full border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-bold h-11 rounded-xl flex items-center justify-center gap-1.5"
              >
                <X size={18} /> Ninguna de estas
              </Button>
            </div>
          )}

          {/* 3. FILTER BY OBRA - When no match or user rejected all */}
          {flowStep === 'filter_by_obra' && (
            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Building size={16} className="text-peie-blue" /> ¿En qué obra estaba la herramienta?
                </h3>
                <p className="text-xs text-slate-500">Seleccioná la obra donde usaste o viste la herramienta para mostrar todas las disponibles ahí.</p>
              </div>

              {/* Obra selector */}
              <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
                {obras.map(obra => (
                  <button
                    key={obra.id}
                    type="button"
                    onClick={() => handleSelectObra(obra.id)}
                    className={`w-full px-4 py-3 rounded-xl border text-left text-sm font-bold transition-all active:scale-[0.98] flex items-center gap-2 ${
                      selectedObra === obra.id 
                        ? 'border-peie-blue bg-peie-blue/10 text-peie-blue' 
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                    }`}
                  >
                    <MapPin size={14} className={selectedObra === obra.id ? 'text-peie-blue' : 'text-slate-400'} />
                    {obra.name}
                  </button>
                ))}
              </div>

              {/* Tools in selected obra */}
              {selectedObra && toolsInObra.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Herramientas en esta obra ({toolsInObra.length})
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {toolsInObra.map(tool => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onSelect={() => handleSelectMatch(tool)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedObra && toolsInObra.length === 0 && (
                <p className="text-xs text-center text-slate-500 py-4">No hay herramientas registradas en esta obra.</p>
              )}

              {/* Voice assist toggle */}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-2 text-center">¿No la encontrás? Describila con tus palabras</p>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Ej: la amoladora azul grande..."
                        value={voiceText}
                        onChange={e => {
                          setVoiceText(e.target.value);
                          setVoiceResults([]);
                        }}
                        className="pl-9 h-11 rounded-xl bg-white border-slate-200"
                      />
                    </div>
                    <VoiceInputButton 
                      onTranscript={(text) => {
                        setVoiceText(text);
                        setVoiceResults([]);
                      }} 
                      className="h-11 w-11 shrink-0" 
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleVoiceSearch}
                    disabled={!voiceText.trim() || voiceLoading}
                    className="w-full h-11 bg-peie-blue hover:bg-peie-blue/90 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    {voiceLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Interpretando...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Buscar herramienta
                      </>
                    )}
                  </Button>

                  {/* Voice search results */}
                  {voiceResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-600">Resultados encontrados:</p>
                      {voiceResults.map(tool => (
                        <ToolCard
                          key={tool.id}
                          tool={tool}
                          onSelect={() => handleSelectMatch(tool)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. CONFIRMED - Tool selected, show actions */}
          {flowStep === 'confirmed' && activeTool && (
            <div className="space-y-4">
              {/* Selected tool summary */}
              <div className="border border-peie-blue/20 bg-peie-blue/5 rounded-2xl p-4 space-y-3">
                <div className="text-center">
                  <span className="text-xs font-bold bg-peie-blue text-white px-3 py-1 rounded-full">
                    Herramienta Seleccionada
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  {activeTool.photo_url ? (
                    <img src={activeTool.photo_url} alt={activeTool.name} className="w-20 h-20 object-cover rounded-lg border border-slate-100 shrink-0" />
                  ) : (
                    <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                      <Wrench size={24} />
                    </div>
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-mono font-bold text-peie-blue uppercase">{activeTool.code}</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{activeTool.name}</p>
                    <p className="text-xs text-slate-500">
                      {activeTool.brand || 'Sin marca'} {activeTool.model ? `· ${activeTool.model}` : ''}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-600">{activeTool.obras?.name || 'Base Central'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 gap-2.5">
                <Button
                  onClick={() => navigate('/solicitudes/nueva', { state: { herramientaId: activeTool.id } })}
                  className="bg-peie-blue hover:bg-peie-blue/90 text-white font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                >
                  <Truck size={18} /> Solicitar Traslado a otra Obra
                </Button>

                <Button
                  onClick={() => navigate('/ordenes/nueva', { state: { herramientaId: activeTool.id } })}
                  variant="outline"
                  className="border-slate-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-200 font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={18} /> Reportar Rotura o Falla
                </Button>

                <Button
                  onClick={() => navigate(`/herramientas/${activeTool.id}`)}
                  variant="outline"
                  className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                >
                  <FileText size={18} /> Ver Ficha de Inventario Completa
                </Button>
              </div>

              {/* New search */}
              <Button
                onClick={resetSearch}
                variant="ghost"
                className="w-full text-xs text-slate-500 hover:text-peie-blue font-semibold"
              >
                Buscar otra herramienta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
