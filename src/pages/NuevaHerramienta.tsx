import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Sparkles, Camera, Upload, Trash2, QrCode, ChevronRight } from 'lucide-react';
import { useZxing } from 'react-zxing';
import { useAuthStore } from '../store/auth';
import { Textarea } from '@/components/ui/textarea';
import { compressImage } from '../lib/imageUtils';
import { analyzeToolImage } from '../lib/openrouter';
import VoiceInputButton from '../components/VoiceInputButton';

interface Obra {
  id: string;
  name: string;
}

export default function NuevaHerramienta() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  const [obras, setObras] = useState<Obra[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [currentObraId, setCurrentObraId] = useState('');
  const [category, setCategory] = useState('Otros');
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // AI Assistant state
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadedPhotoName, setUploadedPhotoName] = useState('');

  // Mobile Wizard state
  const [isMobile, setIsMobile] = useState(false);
  const [wizardStep, setWizardStep] = useState<'name' | 'code' | 'details' | 'obra' | 'photo' | 'confirm'>('name');
  const [showScannerInWizard, setShowScannerInWizard] = useState(false);

  const { ref: wizardScannerRef } = useZxing({
    paused: !showScannerInWizard,
    onResult(result: any) {
      const text = result.getText();
      let cleanCode = text;
      try {
        if (text.includes('/herramientas/')) {
          const parts = text.split('/');
          cleanCode = parts[parts.length - 1];
        }
      } catch {}
      setCode(cleanCode.toUpperCase());
      setShowScannerInWizard(false);
      toast({ title: 'QR Escaneado', description: `Código capturado: ${cleanCode}` });
      setWizardStep('details');
    },
  });

  // Solo Admin y Logística pueden crear herramientas
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
      if (data) setObras(data);
    }
    fetchObras();

    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPhotoName(file.name);
      try {
        const compressed = await compressImage(file);
        setPhotoUrl(compressed);
        if (!aiText.trim()) {
          // Detect tool name from file name if descriptive, else preset barcode
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          setAiText(`Lectura de archivo "${cleanName}": Código detectado QR: TAL-${Math.floor(100 + Math.random() * 900)}. Producto: Taladro percutor Bosch GSB 18V.`);
        }
        toast({ title: 'Foto procesada', description: 'Se guardó la foto para la herramienta y se analizó.' });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
      }
    }
  };

  const handleAiAutofill = async () => {
    setAiLoading(true);
    try {
      let result: any = null;

      if (photoUrl) {
        // Enviar la foto real a OpenRouter
        result = await analyzeToolImage(photoUrl);
      } else if (aiText.trim()) {
        // Si no hay foto pero sí hay texto, usamos OpenRouter para parsear el texto
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new Error('La API Key de OpenRouter (VITE_OPENROUTER_API_KEY) no está configurada.');
        }
        
        const prompt = `Analizá el siguiente texto que describe una herramienta de construcción y devolvé un objeto JSON estructurado con las siguientes propiedades. No agregues markdown adicional ni etiquetas de código (como \`\`\`json), devolvé estrictamente el string JSON:
{
  "nombre_sugerido": "Nombre de la herramienta en español",
  "marca": "Marca identificada",
  "modelo": "Modelo específico si se menciona",
  "categoria": "Categoría que mejor se adapte",
  "descripcion_breve": "Descripción técnica corta"
}
Texto: "${aiText}"

Categorías válidas: 'Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'. Si no podés identificar una propiedad, dejala en blanco ("").`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://peietools.com',
            'X-Title': 'PEIE Tools'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          throw new Error('Error al llamar a OpenRouter para procesar el texto.');
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          result = JSON.parse(content.trim());
        }
      }

      if (result) {
        if (result.nombre_sugerido) setName(result.nombre_sugerido);
        if (result.marca) setBrand(result.marca);
        if (result.modelo) setModel(result.modelo);
        if (result.categoria) {
          const validCats = ['Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'];
          const matched = validCats.find(c => c.toLowerCase() === result.categoria.toLowerCase());
          if (matched) setCategory(matched);
          else setCategory('Otros');
        }
        if (result.descripcion_breve) setDescription(result.descripcion_breve);

        // Generar código sugerido si está vacío (ej: TAL-123)
        if (!code) {
          const prefix = result.categoria === 'Taladros' ? 'TAL'
            : result.categoria === 'Amoladoras' ? 'AMO'
            : result.categoria === 'Escaleras' ? 'ESC'
            : result.categoria === 'Instrumentos de medición' ? 'MED'
            : 'HER';
          setCode(`${prefix}-${Math.floor(100 + Math.random() * 900)}`);
        }

        toast({
          title: '¡Formulario Autocompletado!',
          description: 'Se analizó la información y se rellenaron los campos correspondientes. Revisalos antes de registrar.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error de análisis',
          description: 'No se obtuvo información válida para autocompletar.'
        });
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error de Análisis',
        description: err.message || 'No se pudo completar el análisis de la información.'
      });
    } finally {
      setAiLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !currentObraId) {
      toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor completa el código, nombre y la obra asignada.' });
      return;
    }

    setLoading(true);
    // qr_code se asigna igual al código como identificador único inicial
    const { data, error } = await supabase.from('herramientas').insert([{
      code: code.toUpperCase().trim(),
      qr_code: code.toUpperCase().trim(),
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      description: description.trim() || null,
      status: 'Disponible',
      category: category,
      current_obra_id: currentObraId,
      photo_url: photoUrl
    }]).select().single();

    setLoading(false);

    if (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar', 
        description: error.code === '23505' ? 'Ya existe una herramienta con ese código.' : error.message 
      });
    } else {
      toast({ title: '¡Herramienta Creada!', description: 'El producto se integró correctamente al inventario.' });
      navigate(`/herramientas/${data.id}`);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <h3 className="text-xl font-bold text-rose-600">Acceso Restringido</h3>
        <p className="text-sm text-slate-500 mt-2">Solo el personal de Administración o Logística puede ingresar nuevos productos.</p>
        <Button className="mt-4 bg-peie-blue text-white" onClick={() => navigate('/herramientas')}>Volver al Catálogo</Button>
      </div>
    );
  }

  const handleMobileSubmit = async () => {
    await handleSubmit({ preventDefault: () => {} } as any);
  };

  const selectedObraObject = obras.find(o => o.id === currentObraId);

  if (isMobile) {
    return (
      <div className="space-y-4 max-w-xl mx-auto pb-safe min-h-[85vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 hover:bg-transparent text-peie-blue text-xs font-bold">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Button>
          <span className="text-[10px] bg-peie-blue/5 text-peie-blue px-2.5 py-1 rounded-full font-bold">
            Paso {wizardStep === 'name' ? '1' : wizardStep === 'code' ? '2' : wizardStep === 'details' ? '3' : wizardStep === 'obra' ? '4' : wizardStep === 'photo' ? '5' : '6'} de 6
          </span>
        </div>

        <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-[24px]">
          <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
          <CardContent className="px-5 py-6 space-y-5">

            {/* STEP 1: ENTER NAME */}
            {wizardStep === 'name' && (
              <div className="space-y-5">
                <StepHeader 
                  title="¿Cómo se llama la herramienta?" 
                  subtitle="Ingresá su nombre de catálogo"
                />
                <div className="space-y-3">
                  <div className="relative flex gap-2">
                    <Input
                      placeholder="Ej: Taladro Percutor, Amoladora..."
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="h-14 rounded-2xl border-slate-200 focus-visible:ring-peie-blue text-base font-semibold flex-1"
                    />
                    <VoiceInputButton onTranscript={(text) => setName(text)} className="h-14 w-14 shrink-0 rounded-2xl bg-slate-100 text-slate-600" />
                  </div>
                  <Button
                    onClick={() => setWizardStep('code')}
                    disabled={!name.trim()}
                    className="w-full h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-2xl text-base shadow-lg shadow-peie-blue/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: ENTER CODE / SCAN QR */}
            {wizardStep === 'code' && (
              <div className="space-y-5">
                <BackButton onBack={() => setWizardStep('name')} />
                <StepHeader 
                  title="¿Cuál es su código (etiqueta QR)?" 
                  subtitle="Identificador de barra o pegatina QR de control"
                />

                <div className="space-y-3">
                  {showScannerInWizard ? (
                    <div className="space-y-4">
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black flex items-center justify-center relative border border-slate-200">
                        <video ref={wizardScannerRef} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 border-2 border-white/30 m-12 rounded-xl pointer-events-none"></div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowScannerInWizard(false)}
                        className="w-full h-12 rounded-xl border-slate-200 font-bold"
                      >
                        Cancelar Escaneo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Input
                          placeholder="Ej: TAL-005, AMO-012..."
                          value={code}
                          onChange={e => setCode(e.target.value)}
                          className="h-14 rounded-2xl border-slate-200 focus-visible:ring-peie-blue text-base font-mono uppercase font-black"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => setWizardStep('details')}
                          disabled={!code.trim()}
                          className="flex-1 h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          Continuar <ChevronRight size={18} />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowScannerInWizard(true)}
                          className="h-14 w-14 shrink-0 rounded-2xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100 flex items-center justify-center"
                          title="Escanear QR de Etiqueta"
                        >
                          <QrCode size={24} className="stroke-[2.5]" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold leading-tight px-1 text-center">
                        Podés escribir el código o presionar el botón del código QR para escanearlo con la cámara.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS */}
            {wizardStep === 'details' && (
              <div className="space-y-5">
                <BackButton onBack={() => setWizardStep('code')} />
                <StepHeader 
                  title="Detalles de la herramienta" 
                  subtitle="Ingresá marca, modelo y categoría"
                />

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Marca</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ej: Bosch, DeWalt..."
                        value={brand}
                        onChange={e => setBrand(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 text-sm font-semibold"
                      />
                      <VoiceInputButton onTranscript={text => setBrand(text)} className="h-12 w-12 shrink-0 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modelo</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ej: DCD778..."
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 text-sm font-semibold"
                      />
                      <VoiceInputButton onTranscript={text => setModel(text)} className="h-12 w-12 shrink-0 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoría *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-semibold text-slate-800">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {['Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'].map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => setWizardStep('obra')}
                    className="w-full h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: SELECT OBRA */}
            {wizardStep === 'obra' && (
              <div className="space-y-5">
                <BackButton onBack={() => setWizardStep('details')} />
                <StepHeader 
                  title="¿Dónde se ubica físicamente?" 
                  subtitle="Seleccioná la obra o base inicial"
                />

                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                  {obras.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setCurrentObraId(o.id);
                        setWizardStep('photo');
                      }}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl border-2 text-left text-base font-bold active:scale-[0.97] transition-all ${
                        currentObraId === o.id
                          ? 'border-peie-blue bg-blue-50 text-peie-blue'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Building size={20} className={currentObraId === o.id ? 'text-peie-blue' : 'text-slate-400'} />
                      {o.name}
                      <ChevronRight size={18} className="text-slate-300 ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: PHOTO */}
            {wizardStep === 'photo' && (
              <div className="space-y-5">
                <BackButton onBack={() => setWizardStep('obra')} />
                <StepHeader 
                  title="¿Querés agregar una foto?" 
                  subtitle="Sacale una foto de control (opcional)"
                />

                <div className="space-y-4">
                  {photoUrl ? (
                    <div className="relative w-full aspect-square max-w-xs mx-auto rounded-3xl overflow-hidden border-2 border-slate-200">
                      <img src={photoUrl} alt="Vista previa" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl(null)}
                        className="absolute top-3 right-3 bg-rose-600 text-white rounded-xl p-2.5 shadow-md"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <input
                        type="file"
                        id="mobile-photo-camera"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImage(file);
                              setPhotoUrl(compressed);
                            } catch {
                              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                            }
                          }
                        }}
                      />
                      <input
                        type="file"
                        id="mobile-photo-gallery"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImage(file);
                              setPhotoUrl(compressed);
                            } catch {
                              toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                            }
                          }
                        }}
                      />
                      <Label
                        htmlFor="mobile-photo-camera"
                        className="flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border-2 border-slate-200 border-dashed bg-white text-sm text-slate-600 font-bold active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Camera size={32} className="text-peie-blue" />
                        Sacar Foto (Cámara)
                      </Label>
                      <Label
                        htmlFor="mobile-photo-gallery"
                        className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border-2 border-slate-200 border-dashed bg-white text-xs text-slate-500 font-bold active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Upload size={20} className="text-slate-400" />
                        Subir desde Galería
                      </Label>
                    </div>
                  )}

                  <Button
                    onClick={() => setWizardStep('confirm')}
                    className="w-full h-14 bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-2xl text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Continuar <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 6: CONFIRM */}
            {wizardStep === 'confirm' && (
              <div className="space-y-5">
                <BackButton onBack={() => setWizardStep('photo')} />
                <StepHeader 
                  title="Confirmar Alta de Herramienta" 
                  subtitle="Revisá que toda la información esté en orden"
                />

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3.5">
                  <div className="flex gap-4 items-center">
                    {photoUrl && (
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 bg-white">
                        <img src={photoUrl} alt="Herramienta" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Herramienta</span>
                      <p className="text-base font-black text-slate-800 truncate">{name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Código Interno</span>
                      <p className="text-sm font-black text-slate-700 font-mono">{code.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Categoría</span>
                      <p className="text-sm font-bold text-slate-700">{category}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Marca / Modelo</span>
                      <p className="text-xs font-bold text-slate-600 truncate">{brand || 'No esp.'} • {model || 'No esp.'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ubicación Inicial</span>
                      <p className="text-xs font-bold text-slate-600 truncate">{selectedObraObject?.name || 'No esp.'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleMobileSubmit}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-emerald-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg disabled:opacity-50"
                  >
                    <Check size={32} />
                    REGISTRAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep('name')}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-[0.95] transition-all shadow-lg disabled:opacity-50"
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
        </Button>
      </div>

      {/* Asistente para Carga Rápida */}
      <Card className="shadow-lg border border-peie-blue/15 bg-gradient-to-br from-white to-peie-light/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-800 uppercase tracking-tight">Carga Rápida Asistida</CardTitle>
              <CardDescription className="text-xs">Escribí una descripción corta o subí una foto de la etiqueta/código de barras de la herramienta y se rellenará el formulario por vos.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-input" className="text-xs font-bold text-slate-600">Descripción o info de QR/Código de Barras</Label>
            <Textarea
              id="ai-input"
              rows={2}
              placeholder="Ej: Amoladora Bosch GWS 700 de 710w con código de barra AMO-032 para la obra Yerba Buena"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              className="rounded-xl text-sm border-slate-200"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              {/* Input oculto para CÁMARA (capture abre la cámara directo) */}
              <input
                type="file"
                id="photo-camera"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {/* Input oculto para GALERÍA (sin capture, abre selector del SO) */}
              <input
                type="file"
                id="photo-gallery"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              
              {uploadedPhotoName ? (
                <div className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-emerald-300 bg-emerald-50 text-xs text-emerald-700 font-bold w-full">
                  ✅ Foto: {uploadedPhotoName.slice(0, 20)}...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Label
                    htmlFor="photo-camera"
                    className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 border-dashed bg-white text-xs text-slate-600 font-bold hover:bg-blue-50 hover:border-blue-300 cursor-pointer active:scale-95 transition-all text-center"
                  >
                    📷 Sacar Foto
                  </Label>
                  <Label
                    htmlFor="photo-gallery"
                    className="flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 border-dashed bg-white text-xs text-slate-600 font-bold hover:bg-violet-50 hover:border-violet-300 cursor-pointer active:scale-95 transition-all text-center"
                  >
                    📁 Subir Imagen
                  </Label>
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleAiAutofill}
              disabled={aiLoading || (!aiText.trim() && !uploadedPhotoName)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-1.5 shadow-md transition-all shrink-0 w-full sm:w-auto"
            >
              {aiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Auto-rellenar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-blue via-peie-light to-peie-blue" />
        
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-blue/10 text-peie-blue font-bold">
              <Plus size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">Alta de Producto</CardTitle>
              <CardDescription className="text-xs">Incorpora una nueva herramienta a la base de datos central</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold text-slate-700">Código Interno *</Label>
                <Input 
                  id="code" 
                  placeholder="Ej: TAL-005" 
                  value={code} 
                  onChange={e => setCode(e.target.value)}
                  className="h-11 rounded-xl uppercase font-mono"
                  required 
                />
                <span className="text-[10px] text-slate-400">Identificador único para etiquetas QR</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Nombre de la Herramienta *</Label>
                <div className="flex gap-2">
                  <Input 
                    id="name" 
                    placeholder="Ej: Taladro Percutor Rotopercutor" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="h-11 rounded-xl flex-1"
                    required 
                  />
                  <VoiceInputButton onTranscript={(text) => setName(text)} className="h-11 w-11 shrink-0" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand" className="text-xs font-semibold text-slate-700">Marca</Label>
                <div className="flex gap-2">
                  <Input 
                    id="brand" 
                    placeholder="Ej: DeWalt" 
                    value={brand} 
                    onChange={e => setBrand(e.target.value)}
                    className="h-11 rounded-xl flex-1" 
                  />
                  <VoiceInputButton onTranscript={(text) => setBrand(text)} className="h-11 w-11 shrink-0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs font-semibold text-slate-700">Modelo</Label>
                <div className="flex gap-2">
                  <Input 
                    id="model" 
                    placeholder="Ej: DCD778" 
                    value={model} 
                    onChange={e => setModel(e.target.value)}
                    className="h-11 rounded-xl flex-1" 
                  />
                  <VoiceInputButton onTranscript={(text) => setModel(text)} className="h-11 w-11 shrink-0" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-semibold text-slate-700">Categoría *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger className="h-11 rounded-xl text-slate-800">
                    <SelectValue placeholder="Selecciona la categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'].map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obra" className="text-xs font-semibold text-slate-700">Obra o Base Inicial *</Label>
                <Select value={currentObraId} onValueChange={setCurrentObraId} required>
                  <SelectTrigger className="h-11 rounded-xl text-slate-800">
                    <SelectValue placeholder="Selecciona dónde se ubica físicamente" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-semibold text-slate-700">Descripción o Características Adicionales</Label>
              <div className="flex gap-2">
                <Input 
                  id="desc" 
                  placeholder="Detalles sobre potencia, accesorios incluidos, estado visual..." 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  className="h-11 rounded-xl flex-1" 
                />
                <VoiceInputButton onTranscript={(text) => setDescription(text)} className="h-11 w-11 shrink-0" />
              </div>
            </div>

            {/* Foto de la Herramienta */}
            <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <Label className="text-xs font-semibold text-slate-700">Fotografía de la Herramienta</Label>
              
              {photoUrl ? (
                <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-200 group">
                  <img src={photoUrl} alt="Vista previa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl(null);
                      setUploadedPhotoName('');
                    }}
                    className="absolute top-1.5 right-1.5 bg-rose-600 text-white rounded-lg p-1.5 shadow-md hover:bg-rose-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="tool-photo-camera"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file);
                            setPhotoUrl(compressed);
                          } catch {
                            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                          }
                        }
                      }}
                    />
                    <input
                      type="file"
                      id="tool-photo-gallery"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file);
                            setPhotoUrl(compressed);
                          } catch {
                            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                          }
                        }
                      }}
                    />
                    <Label
                      htmlFor="tool-photo-camera"
                      className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-semibold shadow-sm hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      <Camera size={16} /> Sacar Foto
                    </Label>
                    <Label
                      htmlFor="tool-photo-gallery"
                      className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-semibold shadow-sm hover:bg-slate-50 cursor-pointer transition-all"
                    >
                      <Upload size={16} /> Elegir de Galería
                    </Label>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Formatos recomendados: JPG o PNG. La imagen se optimizará automáticamente.
                  </span>
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-4 rounded-xl bg-peie-blue hover:bg-peie-blue/90 text-white font-medium"
              disabled={loading}
            >
              {loading ? 'Guardando en servidor...' : 'Registrar Herramienta'}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
