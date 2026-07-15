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
  Upload, 
  Sparkles, 
  Check, 
  X, 
  Truck, 
  AlertTriangle, 
  FileText,
  Search,
  Wrench
} from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import { analyzeToolImage } from '../lib/openrouter';
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
  obras?: { name: string } | null;
}

export default function BusquedaVisual() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [allTools, setAllTools] = useState<Herramienta[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoName, setUploadedPhotoName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [matchedTool, setMatchedTool] = useState<Herramienta | null>(null);
  const [userConfirmed, setUserConfirmed] = useState<boolean | null>(null);

  // Manual fallback search states
  const [manualSearch, setManualSearch] = useState('');
  const [selectedManualTool, setSelectedManualTool] = useState<Herramienta | null>(null);

  // Cargar inventario completo para hacer el fuzzy matching local
  useEffect(() => {
    async function loadTools() {
      const { data, error } = await supabase
        .from('herramientas')
        .select('*, obras(name)');
      if (error) {
        console.error('Error al cargar inventario:', error);
      } else if (data) {
        const normalized = data.map((h: any) => ({
          ...h,
          obras: Array.isArray(h.obras) ? h.obras[0] : h.obras
        })) as Herramienta[];
        setAllTools(normalized);
      }
    }
    loadTools();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPhotoName(file.name);
      setAiResult(null);
      setMatchedTool(null);
      setUserConfirmed(null);
      setSelectedManualTool(null);
      setManualSearch('');
      
      try {
        setLoading(true);
        const compressed = await compressImage(file);
        setPhotoUrl(compressed);
        
        // 1. Analizar imagen con IA
        const parsed = await analyzeToolImage(compressed);
        setAiResult(parsed);
        console.log('[BusquedaVisual] Resultado de IA:', parsed);

        // 2. Realizar fuzzy matching en base de datos local
        findBestMatch(parsed);
      } catch (err: any) {
        console.error(err);
        if (err.message === 'CONFIG_REQUIRED') {
          const userKey = window.prompt("Por favor, ingresá tu API Key de OpenRouter para habilitar el reconocimiento visual en este dispositivo (se guardará de forma segura en tu navegador):");
          if (userKey) {
            localStorage.setItem('VITE_OPENROUTER_API_KEY', userKey.trim());
            toast({ title: "API Key guardada", description: "Intentá de nuevo cargar la foto ahora." });
          } else {
            toast({
              variant: 'destructive',
              title: 'Configuración Requerida',
              description: 'Para usar el buscador con foto necesitas ingresar tu API Key de OpenRouter.'
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Error de Análisis',
            description: err.message || 'No se pudo identificar la herramienta en la foto.'
          });
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const findBestMatch = (aiData: any) => {
    if (allTools.length === 0) return;

    const brandNorm = (aiData.marca || '').toLowerCase().trim();
    const modelNorm = (aiData.modelo || '').toLowerCase().trim();
    const nameNorm = (aiData.nombre_sugerido || '').toLowerCase().trim();

    // Calcular puntaje de coincidencia para cada herramienta
    const scoredTools = allTools.map(tool => {
      let score = 0;
      const tName = tool.name.toLowerCase();
      const tBrand = (tool.brand || '').toLowerCase();
      const tModel = (tool.model || '').toLowerCase();

      // Coincidencia de marca (ej: Bosch)
      if (brandNorm && tBrand && (tBrand.includes(brandNorm) || brandNorm.includes(tBrand))) {
        score += 15;
      }

      // Coincidencia de modelo (ej: GSB 18V)
      if (modelNorm && tModel) {
        if (tModel === modelNorm) {
          score += 30; // Coincidencia exacta
        } else if (tModel.includes(modelNorm) || modelNorm.includes(tModel)) {
          score += 20; // Coincidencia parcial
        }
      }

      // Coincidencia de nombre (ej: Taladro)
      if (nameNorm && tName) {
        const nameWords = nameNorm.split(/\s+/);
        const matchWords = nameWords.filter(word => word.length > 2 && tName.includes(word));
        score += matchWords.length * 5;
      }

      return { tool, score };
    });

    // Ordenar y tomar el mejor que supere un umbral mínimo de coincidencia (score > 10)
    const sorted = scoredTools.filter(x => x.score > 10).sort((a, b) => b.score - a.score);

    if (sorted.length > 0) {
      setMatchedTool(sorted[0].tool);
      console.log('[BusquedaVisual] Coincidencia encontrada:', sorted[0].tool, 'Score:', sorted[0].score);
    } else {
      setMatchedTool(null);
      console.log('[BusquedaVisual] No se encontraron coincidencias en la base de datos.');
      toast({
        title: 'Herramienta no registrada',
        description: 'La IA reconoció el producto pero no parece estar registrado en tu catálogo. Podés buscarlo manualmente a continuación.'
      });
      setUserConfirmed(false); // Forzar el flujo manual
    }
  };

  const handleManualSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualSearch.trim()) return;

    if (filteredTools.length === 1) {
      setSelectedManualTool(filteredTools[0]);
      setManualSearch(`${filteredTools[0].name} [${filteredTools[0].code}]`);
      toast({ title: 'Herramienta identificada', description: `Se seleccionó: ${filteredTools[0].name}` });
    } else if (filteredTools.length > 1) {
      // Seleccionar el primer resultado coincidente por defecto
      setSelectedManualTool(filteredTools[0]);
      setManualSearch(`${filteredTools[0].name} [${filteredTools[0].code}]`);
      toast({ 
        title: 'Coincidencia múltiple', 
        description: `Se seleccionó el primer resultado: ${filteredTools[0].name}. Podés elegir otro de la lista si no es correcto.` 
      });
    } else {
      toast({ 
        variant: 'destructive', 
        title: 'Sin resultados', 
        description: 'No se encontraron herramientas con esa descripción en el inventario.' 
      });
    }
  };

  // Filtrar herramientas para el buscador manual de fallback
  const filteredTools = allTools.filter(t => {
    if (!manualSearch.trim()) return false;
    const term = manualSearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.code.toLowerCase().includes(term) ||
      (t.brand || '').toLowerCase().includes(term) ||
      (t.model || '').toLowerCase().includes(term)
    );
  });

  const activeTool = selectedManualTool || (userConfirmed ? matchedTool : null);

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
              <CardTitle className="text-xl font-bold text-peie-blue">Buscador Visual de Herramientas</CardTitle>
              <CardDescription className="text-xs">Saca una foto o subí una imagen para identificar la herramienta al instante</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-6">
          {/* 1. Selector de Foto */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="file"
                id="search-photo-camera"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <input
                type="file"
                id="search-photo-gallery"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Label
                htmlFor="search-photo-camera"
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-slate-200 border-dashed bg-white text-sm text-slate-700 font-bold hover:bg-blue-50 hover:border-blue-300 cursor-pointer active:scale-95 transition-all text-center"
              >
                📷 Sacar Foto
              </Label>
              <Label
                htmlFor="search-photo-gallery"
                className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-slate-200 border-dashed bg-white text-sm text-slate-700 font-bold hover:bg-violet-50 hover:border-violet-300 cursor-pointer active:scale-95 transition-all text-center"
              >
                📁 Elegir de Galería
              </Label>
            </div>

            {uploadedPhotoName && (
              <p className="text-xs text-center text-slate-500 font-semibold">
                Archivo cargado: <span className="text-peie-blue">{uploadedPhotoName}</span>
              </p>
            )}
          </div>

          {/* Estado Cargando */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-9 h-9 border-4 border-peie-blue/20 border-t-peie-blue rounded-full animate-spin" />
              <div className="flex items-center gap-1.5 text-xs font-semibold text-peie-blue animate-pulse">
                <Sparkles size={14} /> Analizando imagen con IA y buscando coincidencias...
              </div>
            </div>
          )}

          {/* 2. Pregunta de Validación (Si se encontró coincidencia y no se ha confirmado ni rechazado) */}
          {matchedTool && aiResult && userConfirmed === null && !loading && (
            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  Coincidencia Detectada
                </span>
                <h3 className="text-lg font-black text-slate-800 mt-2">¿Es esta tu herramienta?</h3>
              </div>

              {/* Ficha Visual Coincidente */}
              <div className="flex gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm items-center">
                {matchedTool.photo_url ? (
                  <img src={matchedTool.photo_url} alt={matchedTool.name} className="w-20 h-20 object-cover rounded-lg border border-slate-100 shrink-0" />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <Wrench size={24} />
                  </div>
                )}
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-mono font-bold text-peie-blue uppercase">{matchedTool.code}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{matchedTool.name}</p>
                  <p className="text-xs text-slate-500">
                    Marca: {matchedTool.brand || 'Genérica'} {matchedTool.model ? `| Mod: ${matchedTool.model}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 font-semibold truncate mt-1">
                    📍 Ubicación: {matchedTool.obras?.name || 'Base Central'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setUserConfirmed(true)} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Check size={18} /> Sí, es esta
                </Button>
                <Button 
                  onClick={() => setUserConfirmed(false)} 
                  variant="outline" 
                  className="flex-1 border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-bold h-11 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <X size={18} /> No, no es esta
                </Button>
              </div>
            </div>
          )}

          {/* 3. Flujo Manual Fallback (Si dijo "No" o no se encontró coincidencia) */}
          {userConfirmed === false && !loading && (
            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-700">Ayudanos a identificarla</h3>
                <p className="text-xs text-slate-500">Buscá la herramienta por su nombre, código o marca. Podés usar el micrófono para dictar si te resulta más rápido.</p>
              </div>

              <form onSubmit={handleManualSearchSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Escribí o dictá el nombre de la herramienta..."
                      value={manualSearch}
                      onChange={e => {
                        setManualSearch(e.target.value);
                        setSelectedManualTool(null);
                      }}
                      className="pl-9 h-11 rounded-xl bg-white border-slate-200"
                    />
                  </div>
                  <VoiceInputButton 
                    onTranscript={(text) => {
                      setManualSearch(text);
                      setSelectedManualTool(null);
                    }} 
                    className="h-11 w-11 shrink-0" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={!manualSearch.trim()} 
                  className="w-full h-11 bg-peie-blue hover:bg-peie-blue/90 text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Check size={18} /> Confirmar Selección
                </Button>
              </form>

              {/* Lista de coincidencias manuales */}
              {filteredTools.length > 0 && !selectedManualTool && (
                <div className="max-h-48 overflow-y-auto border border-slate-200/60 rounded-xl bg-white divide-y divide-slate-100 shadow-sm">
                  {filteredTools.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedManualTool(t);
                        setManualSearch(`${t.name} [${t.code}]`);
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-slate-50 flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{t.name}</p>
                        <p className="text-slate-500 text-[10px]">Marca: {t.brand || 'Genérica'} | Código: {t.code}</p>
                      </div>
                      <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/30">
                        {t.obras?.name || 'Base'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Acciones Operativas Rápidas (Cuando hay herramienta activa confirmada o seleccionada) */}
          {activeTool && !loading && (
            <div className="space-y-4 border border-peie-blue/10 bg-peie-blue/5 rounded-2xl p-4">
              <div className="text-center">
                <span className="text-xs font-bold bg-peie-blue text-white px-3 py-1 rounded-full">
                  Herramienta Seleccionada
                </span>
                <h4 className="font-bold text-slate-800 mt-2">{activeTool.name} ({activeTool.code})</h4>
                <p className="text-[11px] text-slate-500">📍 Ubicación actual: {activeTool.obras?.name || 'Base Central'}</p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <Button
                  onClick={() => navigate('/solicitudes/nueva', { state: { herramientaId: activeTool.id } })}
                  className="bg-peie-blue hover:bg-peie-blue/90 text-white font-semibold h-11 rounded-xl flex items-center justify-center gap-2"
                >
                  <Truck size={18} /> Solicitar Traslado a otra Obra
                </Button>

                <Button
                  onClick={() => navigate('/ordenes/nueva', { state: { herramientaId: activeTool.id } })}
                  variant="outline"
                  className="border-slate-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-200 font-semibold h-11 rounded-xl flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={18} /> Reportar Rotura o Falla
                </Button>

                <Button
                  onClick={() => navigate(`/herramientas/${activeTool.id}`)}
                  variant="outline"
                  className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold h-11 rounded-xl flex items-center justify-center gap-2"
                >
                  <FileText size={18} /> Ver Ficha de Inventario Completa
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
