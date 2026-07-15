import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Truck, MessageCircle, AlertCircle, Search } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal';

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

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  
  // Si viene desde la vista de detalle de herramienta, tomamos el ID pre-cargado
  const preselectedToolId = location.state?.herramientaId || '';

  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [personalLogistica, setPersonalLogistica] = useState<PersonalLogistica[]>([]);
  
  const [selectedToolId, setSelectedToolId] = useState(preselectedToolId);
  const [targetObraId, setTargetObraId] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');
  const [selectedLogisticaId, setSelectedLogisticaId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  // WhatsApp Preview state
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waPreviewPhone, setWaPreviewPhone] = useState('');
  const [waPreviewMessage, setWaPreviewMessage] = useState('');
  const [waPreviewRecipientName, setWaPreviewRecipientName] = useState('');

  // Autocomplete state
  const [toolSearch, setToolSearch] = useState('');
  const [isToolDropdownOpen, setIsToolDropdownOpen] = useState(false);
  const [logisticaSearch, setLogisticaSearch] = useState('');
  const [isLogisticaDropdownOpen, setIsLogisticaDropdownOpen] = useState(false);

  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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

  useEffect(() => {
    async function fetchData() {
      // 1. Cargar todas las herramientas
      const { data: toolsData } = await supabase
        .from('herramientas')
        .select('id, name, code, current_obra_id, status, obras(name)')
        .order('name');
      if (toolsData) {
        setHerramientas(toolsData as unknown as Herramienta[]);
        
        // Pre-llenar buscador si hay herramienta preseleccionada
        if (preselectedToolId) {
          const preTool = toolsData.find(h => h.id === preselectedToolId);
          if (preTool) {
            setToolSearch(`${preTool.name} [${preTool.code}]`);
          }
        }
      }

      // 2. Cargar Obras destino (solo activas y con encargado asignado)
      const { data: obrasData } = await supabase
        .from('obras')
        .select('id, name, encargado_name')
        .eq('active', true)
        .order('name');
      if (obrasData) {
        const validObras = obrasData.filter(o => o.encargado_name && o.encargado_name.trim() !== '');
        setObras(validObras);
      }

      // 3. Cargar Personal de Logística (rol logistica o admin)
      const { data: logisticaData } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp, role')
        .eq('active', true)
        .in('role', ['logistica', 'admin'])
        .order('full_name');
      if (logisticaData) setPersonalLogistica(logisticaData as PersonalLogistica[]);
    }

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedToolId || !targetObraId || !selectedLogisticaId) {
      toast({ 
        variant: 'destructive', 
        title: 'Faltan datos', 
        description: 'Debes seleccionar la herramienta, la obra de destino y el responsable de logística.' 
      });
      return;
    }

    const tool = herramientas.find(h => h.id === selectedToolId);
    const logisticaUser = personalLogistica.find(p => p.id === selectedLogisticaId);
    const targetObra = obras.find(o => o.id === targetObraId);

    if (!tool || !logisticaUser || !targetObra) return;

    if (!logisticaUser.whatsapp) {
      toast({ 
        variant: 'destructive', 
        title: 'Contacto Incompleto', 
        description: `El agente ${logisticaUser.full_name} no tiene un número de WhatsApp configurado en el sistema.` 
      });
      return;
    }

    setLoading(true);

    const securityCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 1. Guardar la solicitud en base de datos con el código de seguridad
    const { data: newSolicitud, error } = await supabase.from('solicitudes').insert([{
      requester_id: profile.id,
      herramienta_id: selectedToolId,
      source_obra_id: tool.current_obra_id,
      target_obra_id: targetObraId,
      assigned_to: selectedLogisticaId, // Asignamos directamente al de logística elegido
      priority,
      status: 'Pendiente',
      comments: comments.trim() || null,
      security_code: securityCode
    }]).select().single();

    if (newSolicitud) {
      // Registrar el movimiento inicial de trazabilidad
      await supabase.from('movimientos').insert([{
        herramienta_id: selectedToolId,
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
      toast({ title: '¡Solicitud Generada!', description: 'Notificando de inmediato al encargado de logística por WhatsApp...' });
      
      // 2. Construir el mensaje de WhatsApp y abrir en pestaña nueva
      const waMessage = [
        '*NUEVA SOLICITUD DE TRASLADO*',
        '',
        'Hola *' + logisticaUser.full_name.split(' ')[0] + '*, tenes un nuevo pedido de logistica:',
        '',
        '- *Solicita:* ' + profile.full_name + ' (' + profile.role + ')',
        '- *Herramienta:* ' + tool.name,
        '- *Codigo:* ' + tool.code,
        '- *Origen:* ' + (tool.obras?.name || 'Base Desconocida'),
        '- *Destino:* ' + targetObra.name,
        '- *Prioridad:* ' + priority,
        '',
        '*Notas:* ' + (comments.trim() || 'Sin especificaciones'),
        '',
        'Aprobar o gestionar el envio desde aca:',
        APP_URL + '/solicitudes/' + newSolicitud.id
      ].join('\n');

      setWaPreviewPhone(logisticaUser.whatsapp!);
      setWaPreviewMessage(waMessage);
      setWaPreviewRecipientName(logisticaUser.full_name);
      setWaPreviewOpen(true);
    }
  };

  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter((e): e is string => !!e))].sort();
  const filteredObras = obras.filter(o => !filterEncargado || o.encargado_name === filterEncargado);

  const handleEncargadoChange = (val: string) => {
    const actualVal = val === '_all_' ? '' : val;
    setFilterEncargado(actualVal);
    setTargetObraId('');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-safe">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver atrás
        </Button>
      </div>

      <Card className="shadow-xl border-0 ring-1 ring-peie-blue/5 overflow-hidden rounded-2xl">
        <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
        
        <CardHeader className="pb-4 pt-6 px-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-peie-light/10 text-peie-blue font-bold">
              <Truck size={20} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-peie-blue">Movimiento de Herramientas</CardTitle>
              <CardDescription className="text-xs">Coordina el traslado seguro seleccionando al personal de logística</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1.5 relative font-sans">
              <Label htmlFor="toolSearch" className="text-xs font-semibold text-slate-700">Herramienta *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="toolSearch"
                  placeholder="Escribí para buscar herramienta por nombre o código..."
                  value={toolSearch}
                  onChange={(e) => {
                    setToolSearch(e.target.value);
                    setSelectedToolId('');
                    setIsToolDropdownOpen(true);
                  }}
                  onFocus={() => setIsToolDropdownOpen(true)}
                  className="pl-9 h-11 rounded-xl text-slate-800 bg-white"
                  required
                />
                {selectedToolId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Seleccionado
                  </span>
                )}
              </div>

              {isToolDropdownOpen && toolSearch.trim().length > 0 && !selectedToolId && (
                <div className="absolute z-50 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 mt-1 shadow-lg">
                  {filteredHerramientas.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedToolId(t.id);
                        setToolSearch(`${t.name} [${t.code}]`);
                        setIsToolDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-slate-450 mr-2">[{t.code}]</span>
                        <span className="font-bold text-slate-800">{t.name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">• {t.obras?.name || 'Sin obra'}</span>
                      </div>
                      {t.status !== 'Disponible' ? (
                        <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                          {t.status}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                          Disponible
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredHerramientas.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400 bg-white">
                      No se encontraron herramientas
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filterEncargado" className="text-xs font-semibold text-slate-700">Encargado de Obra (Filtrar Destinos)</Label>
              <Select value={filterEncargado || '_all_'} onValueChange={handleEncargadoChange}>
                <SelectTrigger className="h-11 rounded-xl text-slate-800">
                  <SelectValue placeholder="Todos los encargados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">Todos los encargados</SelectItem>
                  {encargadosUnicos.map(e => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetObra" className="text-xs font-semibold text-slate-700">Destino *</Label>
              <Select value={targetObraId} onValueChange={setTargetObraId} required>
                <SelectTrigger className="h-11 rounded-xl text-slate-800">
                  <SelectValue placeholder="¿Hacia dónde debe enviarse?" />
                </SelectTrigger>
                <SelectContent>
                  {filteredObras.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} <span className="text-[10px] text-slate-400">({o.encargado_name})</span>
                    </SelectItem>
                  ))}
                  {filteredObras.length === 0 && (
                    <div className="p-2 text-center text-xs text-slate-400">No hay obras asignadas a este encargado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* SELECCIÓN ESPECÍFICA DE EMPLEADO DE LOGÍSTICA PARA EL WA.ME */}
            <div className="space-y-1.5 bg-peie-blue/5 p-3.5 rounded-xl border border-peie-blue/10 relative">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageCircle size={14} className="text-green-600" />
                <Label htmlFor="logisticaSearch" className="text-xs font-bold text-peie-blue uppercase tracking-wide">
                  Despachar mensaje a Logística *
                </Label>
              </div>
              <p className="text-[11px] text-slate-650 mb-2.5 leading-snug">
                Elige de la lista al empleado o administrador encargado para que reciba la orden instantánea en su WhatsApp.
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="logisticaSearch"
                  placeholder="Escribí para buscar responsable de logística..."
                  value={logisticaSearch}
                  onChange={(e) => {
                    setLogisticaSearch(e.target.value);
                    setSelectedLogisticaId('');
                    setIsLogisticaDropdownOpen(true);
                  }}
                  onFocus={() => setIsLogisticaDropdownOpen(true)}
                  className="pl-9 h-11 rounded-xl bg-white border-slate-200 text-slate-800 text-sm font-semibold"
                  required
                />
                {selectedLogisticaId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Seleccionado
                  </span>
                )}
              </div>

              {isLogisticaDropdownOpen && logisticaSearch.trim().length > 0 && !selectedLogisticaId && (
                <div className="absolute z-50 left-3.5 right-3.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 mt-1 shadow-lg">
                  {filteredLogistica.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedLogisticaId(p.id);
                        setLogisticaSearch(p.full_name);
                        setIsLogisticaDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{p.full_name}</span>
                        <span className="text-[10px] text-slate-450 ml-1.5 capitalize">({p.role})</span>
                      </div>
                      {p.whatsapp ? (
                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                          ✓ WA
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                          ⚠ Sin Tel
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredLogistica.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-450 font-medium bg-white">
                      No se encontraron responsables
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-semibold text-slate-700">Nivel de Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-11 rounded-xl text-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">🟢 Baja</SelectItem>
                    <SelectItem value="Normal">🔵 Normal</SelectItem>
                    <SelectItem value="Alta">🟠 Alta</SelectItem>
                    <SelectItem value="Urgente">🔴 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comments" className="text-xs font-semibold text-slate-700">Comentarios Adicionales</Label>
                <Input 
                  id="comments" 
                  placeholder="Ej: Se requiere para hormigonado de losa..." 
                  value={comments} 
                  onChange={e => setComments(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-4 rounded-xl bg-peie-blue hover:bg-peie-blue/90 text-white font-medium flex items-center justify-center gap-2"
              disabled={loading}
            >
              <MessageCircle size={18} className="text-peie-light animate-bounce" />
              <span>{loading ? 'Procesando...' : 'Confirmar y Notificar por WhatsApp'}</span>
            </Button>

          </form>
        </CardContent>
      </Card>

      {/* Reusable WhatsApp Preview Modal */}
      <WhatsAppPreviewModal
        isOpen={waPreviewOpen}
        onClose={() => {
          setWaPreviewOpen(false);
          navigate('/solicitudes');
        }}
        phone={waPreviewPhone}
        message={waPreviewMessage}
        recipientName={waPreviewRecipientName}
      />
    </div>
  );
}
