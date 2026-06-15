import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Truck, 
  AlertTriangle, 
  User, 
  Wrench, 
  CheckCircle2, 
  MessageSquare,
  AlertCircle
} from 'lucide-react';

export default function SeguimientoTraslado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();

  const [solicitud, setSolicitud] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Logistics controls
  const [etaInput, setEtaInput] = useState('');
  const [selectedDelay, setSelectedDelay] = useState('');
  const [updating, setUpdating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Animation progress (for the SVG truck icon)
  const [progress, setProgress] = useState(15); // Start at 15% along the path

  useEffect(() => {
    if (id) {
      fetchDetails();
    }
  }, [id]);

  // Simulate progress animation
  useEffect(() => {
    if (solicitud?.status === 'En traslado' && !solicitud.delay_reason) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) return 85; // Stay near destination until delivered
          return prev + 1;
        });
      }, 4000);
      return () => clearInterval(interval);
    } else if (solicitud?.status === 'Entregada' || solicitud?.status === 'Confirmada') {
      setProgress(100);
    }
  }, [solicitud]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('solicitudes')
        .select(`
          *,
          profiles!solicitudes_requester_id_fkey(id, full_name, whatsapp),
          herramientas!solicitudes_herramienta_id_fkey(name, code, brand, model, photo_url),
          target_obra:obras!solicitudes_target_obra_id_fkey(name, address, photo_url, latitude, longitude),
          assigned:profiles!solicitudes_assigned_to_fkey(full_name, whatsapp, photo_url)
        `)
        .eq('id', id)
        .single();

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el seguimiento.' });
        navigate('/pedidos-herramientas');
        return;
      }
      setSolicitud(data);
      if (data.eta) setEtaInput(data.eta);

      // Fetch tracking history
      const { data: histData } = await supabase
        .from('tracking_history')
        .select('*')
        .eq('solicitud_id', id)
        .order('recorded_at', { ascending: false });
      
      if (histData) setHistory(histData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLogistics = async (type: 'eta' | 'delay') => {
    if (!solicitud) return;
    setUpdating(true);

    try {
      let payload: any = {};
      let waMsg = '';

      if (type === 'eta') {
        payload.eta = etaInput;
        waMsg = [
          '*ACTUALIZACIÓN DE ENTREGA: ETA ACTUALIZADO*',
          '',
          `Hola *${solicitud.profiles?.full_name?.split(' ')[0]}*!`,
          `Se actualizó el tiempo estimado de llegada de tu herramienta *${solicitud.herramientas?.name}*:`,
          '',
          `- *Nuevo ETA:* ${etaInput}`,
          '',
          'Seguí el traslado en vivo desde aquí:',
          `${APP_URL}/solicitudes/${solicitud.id}/seguimiento`
        ].join('\n');
      } else if (type === 'delay') {
        if (!selectedDelay) {
          toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un motivo de demora.' });
          setUpdating(false);
          return;
        }
        payload.delay_reason = selectedDelay;
        waMsg = [
          '*ALERTA DE DEMORA EN TRASLADO*',
          '',
          `Hola *${solicitud.profiles?.full_name?.split(' ')[0]}*!`,
          `El traslado de tu herramienta *${solicitud.herramientas?.name}* presenta un retraso:`,
          '',
          `- *Motivo:* ${selectedDelay}`,
          solicitud.eta ? `- *ETA estimado:* ${solicitud.eta}` : '',
          '',
          'Hacé el seguimiento y mirá los detalles en el mapa:',
          `${APP_URL}/solicitudes/${solicitud.id}/seguimiento`
        ].join('\n');
      }

      const { error } = await supabase.from('solicitudes').update(payload).eq('id', solicitud.id);
      if (error) throw error;

      toast({ title: 'Actualizado con éxito', description: 'Se guardó la información del traslado.' });
      
      // Enviar WhatsApp al solicitante
      if (solicitud.profiles?.whatsapp) {
        window.open(buildWhatsAppLink(solicitud.profiles.whatsapp, waMsg), '_blank');
      }

      fetchDetails();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al actualizar', description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleClearDelay = async () => {
    if (!solicitud) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('solicitudes')
        .update({ delay_reason: null })
        .eq('id', solicitud.id);
      if (error) throw error;
      toast({ title: 'Demora Resuelta', description: 'Se quitó el aviso de demora del mapa.' });
      fetchDetails();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleRegisterGPS = async () => {
    if (!solicitud) return;
    setUpdating(true);

    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'No compatible',
        description: 'Tu navegador o dispositivo no soporta geolocalización GPS.'
      });
      setUpdating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // 1. Update current position in solicitudes
          const { error } = await supabase
            .from('solicitudes')
            .update({
              tracking_latitude: lat,
              tracking_longitude: lng
            })
            .eq('id', solicitud.id);

          if (error) throw error;

          // 2. Insert into tracking_history table for the audit trail
          await supabase
            .from('tracking_history')
            .insert([{
              solicitud_id: solicitud.id,
              latitude: lat,
              longitude: lng
            }]);

          toast({
            title: 'Ubicación GPS Guardada',
            description: `Se registró tu ubicación actual (${lat.toFixed(5)}, ${lng.toFixed(5)}).`
          });
          
          fetchDetails();
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Error al guardar ubicación',
            description: err.message
          });
        } finally {
          setUpdating(false);
        }
      },
      (error) => {
        let msg = 'Error desconocido al obtener ubicación.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permiso denegado para acceder a la ubicación. Activá los permisos en tu celular.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'La ubicación no está disponible actualmente.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tiempo de espera agotado al obtener ubicación.';
        }
        toast({
          variant: 'destructive',
          title: 'Error de GPS',
          description: msg
        });
        setUpdating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando trazabilidad en tiempo real...</div>;
  if (!solicitud) return null;

  const isAssignedLogistics = profile?.id === solicitud.assigned_to || profile?.role?.toLowerCase() === 'admin';
  const delayOptions = [
    'Tránsito intenso en la ruta',
    'Inconveniente con el vehículo',
    'Desvío o corte de calle',
    'Control policial o de tránsito',
    'Demora en retiro de la base'
  ];

  // SVG Coordinates calculation for truck position along a bezier-like curve path
  // Start: (50, 250) -> Yerba Buena
  // End: (350, 100) -> San Miguel de Tucumán
  const getTruckCoordinates = (percent: number) => {
    const t = percent / 100;
    // Simple quadratic bezier curve logic
    // P0: (60, 240) Yerba Buena
    // P1: (200, 280) Control
    // P2: (340, 120) Obra Destino
    const x = (1 - t) * (1 - t) * 60 + 2 * (1 - t) * t * 200 + t * t * 340;
    const y = (1 - t) * (1 - t) * 240 + 2 * (1 - t) * t * 280 + t * t * 120;
    return { x, y };
  };

  const truckPos = getTruckCoordinates(progress);

  return (
    <div className="space-y-6 pb-safe max-w-4xl mx-auto">
      {/* Botón Volver */}
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 hover:bg-transparent text-peie-blue">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Pedido
        </Button>
      </div>

      {/* Cabecera de Seguimiento */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-peie-blue opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-peie-blue"></span>
            </span>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Seguimiento en Vivo</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Transporte de: <span className="text-peie-blue font-bold">{solicitud.herramientas?.name}</span> ({solicitud.herramientas?.code})
          </p>
        </div>

        <div className="flex flex-col text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Tiempo estimado (ETA)</span>
          <span className="text-2xl font-black text-peie-blue flex items-center justify-end gap-1.5 leading-none mt-1">
            <Clock size={20} /> {solicitud.eta || 'Calculando...'}
          </span>
        </div>
      </div>

      {/* Alerta de Demora */}
      {solicitud.delay_reason && (
        <div className="p-4 bg-red-50 border border-red-200/80 rounded-2xl flex items-start gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-red-700">Demora Reportada</h4>
            <p className="text-xs text-red-600 font-medium mt-0.5">{solicitud.delay_reason}</p>
          </div>
        </div>
      )}

      {/* MAPA DE TUCUMÁN (Simulado visual premium con SVG) */}
      <Card className="rounded-3xl border-0 ring-1 ring-slate-100 shadow-lg overflow-hidden bg-slate-950 text-white min-h-[350px] relative">
        <CardHeader className="absolute top-4 left-4 z-10 p-0 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl px-3 py-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Mapa en Tiempo Real</p>
            <p className="text-xs font-semibold text-white mt-1">Provincia de Tucumán</p>
          </div>
        </CardHeader>

        {/* SVG Map Container */}
        <div className="w-full h-[380px] select-none relative">
          <svg className="w-full h-full" viewBox="0 0 400 350" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Grid Lines decorativas */}
            <path d="M 0,50 L 400,50 M 0,100 L 400,100 M 0,150 L 400,150 M 0,200 L 400,200 M 0,250 L 400,250 M 0,300 L 400,300" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" />
            <path d="M 50,0 L 50,350 M 100,0 L 100,350 M 150,0 L 150,350 M 200,0 L 200,350 M 250,0 L 250,350 M 300,0 L 300,350 M 350,0 L 350,350" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3,3" />
            
            {/* Curva de ruta principal de Tucumán */}
            {/* Yerba Buena (60, 240) -> S.M. de Tucumán (340, 120) */}
            <path 
              d="M 60,240 Q 200,280 340,120" 
              stroke="#0f172a" 
              strokeWidth="8" 
              strokeLinecap="round" 
            />
            <path 
              d="M 60,240 Q 200,280 340,120" 
              stroke={solicitud.delay_reason ? '#dc2626' : '#0284c7'} 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeDasharray="8,6"
            />
            
            {/* Marcador Yerba Buena (Origen) */}
            <circle cx="60" cy="240" r="10" fill="#dc2626" fillOpacity="0.2" />
            <circle cx="60" cy="240" r="4" fill="#dc2626" />
            <text x="60" y="222" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">Yerba Buena (Base)</text>
            
            {/* Marcador Destino */}
            <circle cx="340" cy="120" r="14" fill="#22c55e" fillOpacity="0.2" className="animate-pulse" />
            <circle cx="340" cy="120" r="6" fill="#22c55e" />
            <text x="340" y="100" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">{solicitud.target_obra?.name || 'Obra Destino'}</text>

            {/* Truck Icon animado */}
            <g transform={`translate(${truckPos.x - 14}, ${truckPos.y - 14})`}>
              <circle cx="14" cy="14" r="14" fill={solicitud.delay_reason ? '#dc2626' : '#0ea5e9'} fillOpacity="0.3" className="animate-ping" />
              <rect x="5" y="5" width="18" height="18" rx="9" fill={solicitud.delay_reason ? '#dc2626' : '#0ea5e9'} />
              <Truck x="8" y="8" width="12" height="12" className="text-white" />
            </g>
          </svg>

          {/* Información flotante de estado */}
          <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-3 flex items-center gap-2 max-w-[200px]">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Truck size={16} />
            </div>
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Estado</p>
              <p className="text-xs font-bold text-white mt-0.5">
                {solicitud.status === 'En traslado' ? 'En ruta...' : solicitud.status}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tarjeta de Ubicación GPS Satelital Real */}
      {(solicitud.tracking_latitude || isAssignedLogistics) && (
        <Card className="rounded-3xl border border-emerald-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-3 pt-6">
            <CardTitle className="text-sm font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={18} className="animate-bounce" /> Ubicación Satelital GPS (Real)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                {solicitud.tracking_latitude ? (
                  <>
                    <p className="text-xs text-slate-600 font-medium">
                      El transportista ha reportado su ubicación GPS satelital.
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Coordenadas: {solicitud.tracking_latitude.toFixed(6)}, {solicitud.tracking_longitude.toFixed(6)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic font-medium">
                    Esperando que el transportista comparta su ubicación satelital GPS...
                  </p>
                )}
              </div>

              {solicitud.tracking_latitude && (
                <Button
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${solicitud.tracking_latitude},${solicitud.tracking_longitude}&destination=${solicitud.target_obra?.latitude || ''},${solicitud.target_obra?.longitude || ''}`;
                    window.open(url, '_blank');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10 px-4 flex items-center gap-1.5 w-full sm:w-auto shrink-0"
                >
                  🗺️ Navegar en Google Maps
                </Button>
              )}
            </div>

            {isAssignedLogistics && (
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3 justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">Controles de Conductor</p>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">
                    Recordá presionar el botón cada 5-10 minutos para mantener tu ubicación actualizada en el mapa del solicitante.
                  </p>
                </div>
                <Button
                  onClick={handleRegisterGPS}
                  disabled={updating}
                  className="bg-peie-blue hover:bg-peie-blue/90 text-white font-black rounded-xl text-xs h-11 px-4 flex items-center gap-1.5 shrink-0 w-full sm:w-auto shadow-md"
                >
                  📍 Registrar GPS Actual
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historial de Movimientos GPS (timeline) */}
      {history.length > 0 && (
        <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-3 pt-6">
            <CardTitle className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={18} className="text-peie-blue" /> Historial de Movimientos GPS
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Trayecto registrado por el transportista en su recorrido.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="relative pl-6 border-l-2 border-slate-100 ml-3 space-y-4">
              {history.map((point, index) => (
                <div key={point.id} className="relative">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${index === 0 ? 'bg-peie-blue scale-110 shadow-sm shadow-peie-blue/50' : 'bg-slate-300'}`} />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {index === 0 ? 'Última ubicación registrada' : `Punto de control ${history.length - index}`}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 border px-2 py-0.5 rounded-lg">
                        {new Date(point.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
                          window.open(url, '_blank');
                        }}
                        className="text-peie-blue hover:text-peie-blue/80 hover:bg-peie-blue/5 p-1 h-auto text-[10px] font-bold"
                      >
                        📍 Ver Mapa
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalles del Traslado (Logística y Obra) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Encargado de Logística */}
        <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Transportista de Logística</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border shrink-0">
              {solicitud.assigned?.photo_url ? (
                <img src={solicitud.assigned.photo_url} alt="Logística" className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 truncate">{solicitud.assigned?.full_name || 'Personal Logística'}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Responsable asignado</p>
              {solicitud.assigned?.whatsapp && (
                <Button 
                  size="sm" 
                  variant="link" 
                  onClick={() => window.open(buildWhatsAppLink(solicitud.assigned.whatsapp, 'Hola, te escribo por el traslado de la herramienta en camino...'), '_blank')}
                  className="p-0 h-auto text-xs font-bold text-emerald-600 gap-1 mt-1 hover:underline"
                >
                  <MessageSquare size={12} /> Contactar por WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Obra de Destino */}
        <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Obra de Destino</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border shrink-0">
              {solicitud.target_obra?.photo_url ? (
                <img src={solicitud.target_obra.photo_url} alt="Obra" className="w-full h-full object-cover" />
              ) : (
                <MapPin size={24} className="text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 truncate">{solicitud.target_obra?.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{solicitud.target_obra?.address || 'Tucumán, Argentina'}</p>
              <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase border">
                Destino Final
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PANEL DE CONTROL DE LOGÍSTICA / ADMIN */}
      {isAssignedLogistics && (
        <Card className="rounded-3xl border border-peie-blue/10 bg-peie-blue/5 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-peie-blue/10 border-b border-peie-blue/5">
            <CardTitle className="text-sm font-black text-peie-blue flex items-center gap-1.5">
              <Truck size={16} /> PANEL LOGÍSTICO (Controles de Envío)
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Actualizá el tiempo estimado de llegada y reportá demoras para notificar al encargado en tiempo real.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Actualizar ETA */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Establecer ETA (Hora Estimada)</label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ej: 14:30 o 25 mins" 
                    value={etaInput} 
                    onChange={e => setEtaInput(e.target.value)} 
                    className="h-10 rounded-xl bg-white"
                  />
                  <Button 
                    onClick={() => handleUpdateLogistics('eta')} 
                    disabled={updating || !etaInput.trim()}
                    className="bg-peie-blue hover:bg-peie-blue/90 rounded-xl h-10 px-4 font-bold"
                  >
                    Guardar
                  </Button>
                </div>
              </div>

              {/* Informar Demora */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Informar Demora o Incidente</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={selectedDelay}
                    onChange={e => setSelectedDelay(e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    <option value="">Selecciona el motivo de demora...</option>
                    {delayOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  
                  <div className="flex gap-2 justify-end mt-1">
                    {solicitud.delay_reason && (
                      <Button 
                        variant="outline" 
                        onClick={handleClearDelay} 
                        disabled={updating}
                        className="rounded-xl h-10 text-red-600 border-red-200 hover:bg-red-50 font-bold"
                      >
                        Quitar Demora
                      </Button>
                    )}
                    <Button 
                      onClick={() => handleUpdateLogistics('delay')} 
                      disabled={updating || !selectedDelay}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-10 px-4 font-bold flex items-center gap-1.5"
                    >
                      <AlertCircle size={16} /> Notificar Demora
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalle de Elementos Transportados */}
      <Card className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Elementos Transportados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-10 h-10 bg-peie-blue/10 text-peie-blue rounded-lg flex items-center justify-center shrink-0">
              <Wrench size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">{solicitud.herramientas?.name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Cód: {solicitud.herramientas?.code}</p>
            </div>
            <div className="ml-auto text-right">
              <span className="inline-block bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                1 unidad
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
