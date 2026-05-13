import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit, Truck, AlertTriangle, MapPin, Navigation, Building2, Download, Camera, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { compressImage } from '../lib/imageUtils';

interface Herramienta {
  id: string;
  code: string;
  qr_code: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  status: string;
  current_obra_id: string | null;
  notes: string | null;
  photo_url?: string | null;
  obras?: { name: string } | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_location_accuracy?: number | null;
  last_location_at?: string | null;
  google_maps_url?: string | null;
}

export default function HerramientaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [herramienta, setHerramienta] = useState<Herramienta | null>(null);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica' || profile?.role === 'compras';

  useEffect(() => {
    if (id) fetchHerramienta();
  }, [id]);

  const fetchHerramienta = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('herramientas')
      .select('*, obras(name)')
      .eq('id', id)
      .single();
      
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró la herramienta.' });
      navigate('/herramientas');
    } else {
      setHerramienta(data);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Disponible': return 'bg-green-100 text-green-800 border-green-200';
      case 'En uso': return 'bg-peie-light/20 text-peie-blue border-peie-light';
      case 'En traslado': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'En mantenimiento': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const updateGPSLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error', description: 'Tu navegador no soporta geolocalización.' });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        
        const { error } = await supabase.from('herramientas').update({
          last_latitude: lat,
          last_longitude: lng,
          last_location_accuracy: acc,
          last_location_at: new Date().toISOString(),
          google_maps_url: gmapsUrl
        }).eq('id', herramienta?.id);

        setGettingLocation(false);

        if (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la ubicación.' });
        } else {
          toast({ title: 'Éxito', description: 'Ubicación GPS actualizada.' });
          fetchHerramienta();
        }
      },
      (error) => {
        setGettingLocation(false);
        toast({ variant: 'destructive', title: 'Error GPS', description: error.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // URL del QR generado vía API pública (sin dependencias de React problemáticas)
  const qrUrl = herramienta
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/herramientas/${herramienta.id}`)}`
    : '';

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando ficha...</div>;
  if (!herramienta) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-safe">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate('/herramientas')} className="p-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" /> Editar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Card */}
        <Card className="md:col-span-2 shadow-sm border-t-4 overflow-hidden" style={{ borderTopColor: 'var(--peie-blue)' }}>
          {/* ZONA DE FOTO - con botón de cámara para admin */}
          <div className="relative h-64 w-full bg-slate-50 border-b border-slate-100">
            {herramienta.photo_url ? (
              <img 
                src={herramienta.photo_url} 
                alt={herramienta.name} 
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <Camera size={48} strokeWidth={1} />
                <p className="text-xs mt-2">Sin foto</p>
              </div>
            )}

            {/* Botón de cámara flotante - solo admin/logistica */}
            {isAdmin && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-3 right-3 bg-peie-blue text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:bg-peie-blue/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={20} />
                )}
              </button>
            )}

            {/* Input oculto para capturar foto desde cámara o galería */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !herramienta) return;
                setUploading(true);
                try {
                  const compressed = await compressImage(file);
                  const { error } = await supabase
                    .from('herramientas')
                    .update({ photo_url: compressed })
                    .eq('id', herramienta.id);
                  if (error) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                  } else {
                    toast({ title: 'Foto actualizada', description: 'La imagen de la herramienta fue guardada.' });
                    fetchHerramienta();
                  }
                } catch {
                  toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
                }
                setUploading(false);
                e.target.value = ''; // Reset para permitir subir la misma foto
              }}
            />
          </div>
          <CardHeader className="pb-4 pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl font-bold text-peie-blue">{herramienta.name}</CardTitle>
                <CardDescription className="text-sm font-mono mt-1 bg-gray-100 w-max px-2 py-1 rounded">
                  {herramienta.code}
                </CardDescription>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(herramienta.status)}`}>
                {herramienta.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Marca</p>
                <p className="font-medium">{herramienta.brand || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">{herramienta.model || '-'}</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Obra Actual</p>
                <div className="flex items-center text-peie-blue font-medium bg-white p-2 rounded border border-border shadow-sm">
                  <Building2 className="w-4 h-4 mr-2" /> {herramienta.obras?.name || 'Ubicación Desconocida'}
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-muted-foreground">Coordenadas GPS</p>
                  <Button variant="ghost" size="sm" onClick={updateGPSLocation} disabled={gettingLocation} className="text-peie-blue h-8">
                    <Navigation className={`w-4 h-4 mr-2 ${gettingLocation ? 'animate-spin' : ''}`} /> 
                    {gettingLocation ? 'Buscando...' : 'Capturar Actual'}
                  </Button>
                </div>
                {herramienta.last_location_at ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Última actualización: {new Date(herramienta.last_location_at).toLocaleString()}</p>
                    {herramienta.google_maps_url && (
                      <a href={herramienta.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline">
                        <MapPin className="w-4 h-4 mr-1" /> Ver en Google Maps
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No hay ubicación registrada.</p>
                )}
              </div>
            </div>

            {herramienta.description && (
              <div>
                <p className="text-sm text-muted-foreground">Descripción</p>
                <p className="text-sm mt-1">{herramienta.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR & Actions Card */}
        <div className="space-y-6">
          <Card className="shadow-sm flex flex-col items-center justify-center p-6 bg-white">
            <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-lg">
              <img 
                src={qrUrl} 
                alt={`QR ${herramienta.code}`} 
                width={160} 
                height={160}
                className="rounded"
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Escanea para abrir esta ficha
            </p>
            <a 
              href={qrUrl} 
              download={`QR-${herramienta.code}.png`}
              className="mt-4 w-full"
            >
              <Button variant="outline" className="w-full" size="sm">
                <Download className="mr-2 h-4 w-4" /> Descargar QR
              </Button>
            </a>
          </Card>

          <div className="grid grid-cols-1 gap-2">
            {herramienta.status === 'Disponible' && (
              <Button className="w-full bg-peie-blue hover:bg-peie-blue/90" onClick={() => navigate('/solicitudes/nueva', { state: { herramientaId: herramienta.id }})}>
                <Truck className="mr-2 h-4 w-4" /> Solicitar Traslado
              </Button>
            )}

            {/* LIBERAR HERRAMIENTA - solo admin/logistica */}
            {isAdmin && (herramienta.status === 'En uso' || herramienta.status === 'Reservada' || herramienta.status === 'En traslado' || herramienta.status === 'En mantenimiento' || herramienta.status === 'Fuera de servicio') && (
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl"
                onClick={async () => {
                  const { error } = await supabase
                    .from('herramientas')
                    .update({ status: 'Disponible' })
                    .eq('id', herramienta.id);
                  if (error) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                  } else {
                    await supabase.from('movimientos').insert([{
                      herramienta_id: herramienta.id,
                      user_id: profile?.id,
                      action: 'Herramienta liberada a Disponible',
                      notes: 'Liberada por ' + (profile?.full_name || 'Admin')
                    }]);
                    toast({ title: 'Herramienta Liberada', description: herramienta.name + ' ahora esta disponible.' });
                    fetchHerramienta();
                  }
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" /> Liberar Herramienta (Disponible)
              </Button>
            )}

            {/* Aviso cuando ya esta reportada */}
            {(herramienta.status === 'Fuera de servicio' || herramienta.status === 'En mantenimiento') && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-red-400 mb-1" />
                <p className="text-xs text-red-600 font-semibold">
                  {herramienta.status === 'Fuera de servicio' ? 'Herramienta reportada como ROTA' : 'Herramienta EN REPARACION'}
                </p>
              </div>
            )}

            {herramienta.status !== 'Disponible' && !isAdmin && herramienta.status !== 'Fuera de servicio' && herramienta.status !== 'En mantenimiento' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 font-semibold">Esta herramienta no esta disponible actualmente</p>
              </div>
            )}

            {/* ================================================ */}
            {/* REPORTAR ESTADO - VISIBLE PARA TODOS LOS ROLES   */}
            {/* ================================================ */}
            {herramienta.status !== 'Fuera de servicio' && herramienta.status !== 'En mantenimiento' && (
              <div className="pt-2 border-t border-slate-100 mt-2 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reportar problema</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-11 rounded-xl text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('herramientas')
                        .update({ status: 'Fuera de servicio' })
                        .eq('id', herramienta.id);
                      if (error) {
                        toast({ variant: 'destructive', title: 'Error', description: error.message });
                      } else {
                        await supabase.from('movimientos').insert([{
                          herramienta_id: herramienta.id,
                          user_id: profile?.id,
                          action: 'Reportada como Fuera de servicio (Rota)',
                          notes: 'Reportada por ' + (profile?.full_name || 'Usuario')
                        }]);
                        toast({ title: 'Reportada', description: 'Herramienta marcada como rota.' });
                        fetchHerramienta();
                      }
                    }}
                  >
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Rota
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-11 rounded-xl text-orange-600 border-orange-200 hover:bg-orange-50 text-xs font-semibold"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('herramientas')
                        .update({ status: 'En mantenimiento' })
                        .eq('id', herramienta.id);
                      if (error) {
                        toast({ variant: 'destructive', title: 'Error', description: error.message });
                      } else {
                        await supabase.from('movimientos').insert([{
                          herramienta_id: herramienta.id,
                          user_id: profile?.id,
                          action: 'Enviada a mantenimiento / reparacion',
                          notes: 'Reportada por ' + (profile?.full_name || 'Usuario')
                        }]);
                        toast({ title: 'Reportada', description: 'Herramienta marcada en reparacion.' });
                        fetchHerramienta();
                      }
                    }}
                  >
                    <Edit className="mr-1 h-3.5 w-3.5" /> En Reparacion
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
