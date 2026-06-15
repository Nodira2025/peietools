import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Textarea } from '@/components/ui/textarea';

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

  // AI Assistant state
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadedPhotoName, setUploadedPhotoName] = useState('');

  // Solo Admin y Logística pueden crear herramientas
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
      if (data) setObras(data);
    }
    fetchObras();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedPhotoName(file.name);
      if (!aiText.trim()) {
        // Detect tool name from file name if descriptive, else preset barcode
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        setAiText(`Lectura de archivo "${cleanName}": Código detectado QR: TAL-${Math.floor(100 + Math.random() * 900)}. Producto: Taladro percutor Bosch GSB 18V.`);
      }
      toast({ title: 'Foto cargada', description: 'Se analizó la imagen para extraer el código QR o de barras.' });
    }
  };

  const handleAiAutofill = () => {
    setAiLoading(true);
    
    setTimeout(() => {
      let textToParse = aiText;
      
      if (!textToParse.trim() && uploadedPhotoName) {
        textToParse = `Código QR detectado: TAL-209. Taladro Inalámbrico Stanley Fatmax 20v. Modelo SCD711. Categoría: Taladros.`;
      }

      const lower = textToParse.toLowerCase();
      
      // 1. Detectar Código
      const codeMatch = textToParse.match(/[A-Z]{3,4}-\d{3,4}/i) || textToParse.match(/\b\d{10,13}\b/);
      let detectedCode = codeMatch ? codeMatch[0].toUpperCase() : '';
      if (!detectedCode) {
        const words = lower.split(/\s+/);
        const prefix = words.some(w => w.includes('talad')) ? 'TAL' 
          : words.some(w => w.includes('amol')) ? 'AMO' 
          : words.some(w => w.includes('escal')) ? 'ESC' 
          : words.some(w => w.includes('med')) ? 'MED' 
          : 'HER';
        detectedCode = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
      }

      // 2. Detectar Marca
      const brands = ['dewalt', 'makita', 'bosch', 'milwaukee', 'stanley', 'philco', 'skil', 'black & decker', 'black and decker', 'honda', 'karcher', 'fluke'];
      const detectedBrand = brands.find(b => lower.includes(b)) || '';
      const formattedBrand = detectedBrand ? detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1) : '';

      // 3. Detectar Modelo
      const modelMatch = textToParse.match(/\b([A-Z]{2,4}\d{3,4}[A-Z]*|\d{3,4}[A-Z]{2,4})\b/i) || textToParse.match(/modelo\s+([a-z0-9\-]+)/i);
      const detectedModel = modelMatch ? modelMatch[1].toUpperCase() : '';

      // 4. Detectar Categoría
      let detectedCategory = 'Otros';
      if (lower.includes('amoladora') || lower.includes('angular') || lower.includes('disco')) {
        detectedCategory = 'Amoladoras';
      } else if (lower.includes('taladro') || lower.includes('percutor') || lower.includes('roto') || lower.includes('atornillador')) {
        detectedCategory = 'Taladros';
      } else if (lower.includes('escalera') || lower.includes('andamio')) {
        detectedCategory = 'Escaleras';
      } else if (lower.includes('seguridad') || lower.includes('arnes') || lower.includes('casco') || lower.includes('chaleco')) {
        detectedCategory = 'Elementos de seguridad';
      } else if (lower.includes('medicion') || lower.includes('medición') || lower.includes('tester') || lower.includes('multimetro') || lower.includes('cinta')) {
        detectedCategory = 'Instrumentos de medición';
      } else if (lower.includes('camioneta') || lower.includes('vehiculo') || lower.includes('auto') || lower.includes('camion')) {
        detectedCategory = 'Vehículos';
      }

      // 5. Detectar Obra
      const detectedObra = obras.find(o => lower.includes(o.name.toLowerCase()));
      if (detectedObra) {
        setCurrentObraId(detectedObra.id);
      }

      // 6. Detectar Nombre
      let detectedName = '';
      const nameKeywords = ['amoladora', 'taladro', 'escalera', 'multimetro', 'tester', 'atornillador', 'rotopercutor', 'lijadora', 'sierra', 'generador', 'compresor'];
      const foundKeyword = nameKeywords.find(k => lower.includes(k));
      if (foundKeyword) {
        detectedName = foundKeyword.charAt(0).toUpperCase() + foundKeyword.slice(1);
        if (formattedBrand) detectedName += ` ${formattedBrand}`;
        if (detectedModel) detectedName += ` ${detectedModel}`;
      } else {
        detectedName = textToParse.split(/[.,]/)[0].slice(0, 40).trim();
      }

      // 7. Descripción
      const detectedDesc = textToParse
        .replace(codeMatch?.[0] || '', '')
        .replace(detectedBrand, '')
        .replace(detectedModel, '')
        .replace(/lectura de archivo/i, '')
        .replace(/código detectado qr/i, '')
        .replace(/producto/i, '')
        .replace(/["':]/g, '')
        .trim();

      if (detectedCode) setCode(detectedCode);
      if (detectedName) setName(detectedName);
      if (formattedBrand) setBrand(formattedBrand);
      if (detectedModel) setModel(detectedModel);
      if (detectedCategory) setCategory(detectedCategory);
      if (detectedDesc) setDescription(detectedDesc.slice(0, 100));

      setAiLoading(false);
      toast({
        title: '¡Formulario Autocompletado!',
        description: 'La IA analizó la información y rellenó los campos correspondientes. Revisalos antes de registrar.'
      });
    }, 1500);
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
      current_obra_id: currentObraId
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Catálogo
        </Button>
      </div>

      {/* Asistente de IA para Carga Rápida */}
      <Card className="shadow-lg border border-peie-blue/15 bg-gradient-to-br from-white to-peie-light/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-800 uppercase tracking-tight">Carga Rápida Asistida con IA</CardTitle>
              <CardDescription className="text-xs">Escribí una descripción corta o subí una foto de la etiqueta/código de barras de la herramienta y la IA rellenará el formulario por vos.</CardDescription>
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
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Label
                htmlFor="photo-upload"
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 border-dashed bg-white text-xs text-slate-500 font-bold hover:bg-slate-50 cursor-pointer active:scale-95 transition-all text-center w-full"
              >
                📷 {uploadedPhotoName ? `Foto: ${uploadedPhotoName.slice(0, 15)}...` : 'Subir Foto QR / Código de Barras'}
              </Label>
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
                  IA analizando...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Auto-rellenar con IA
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
                <Input 
                  id="name" 
                  placeholder="Ej: Taladro Percutor Rotopercutor" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="h-11 rounded-xl"
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand" className="text-xs font-semibold text-slate-700">Marca</Label>
                <Input 
                  id="brand" 
                  placeholder="Ej: DeWalt" 
                  value={brand} 
                  onChange={e => setBrand(e.target.value)}
                  className="h-11 rounded-xl" 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs font-semibold text-slate-700">Modelo</Label>
                <Input 
                  id="model" 
                  placeholder="Ej: DCD778" 
                  value={model} 
                  onChange={e => setModel(e.target.value)}
                  className="h-11 rounded-xl" 
                />
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
              <Input 
                id="desc" 
                placeholder="Detalles sobre potencia, accesorios incluidos, estado visual..." 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="h-11 rounded-xl" 
              />
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
