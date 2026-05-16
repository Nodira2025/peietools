import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, HardHat, MapPin, Building2, Send } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';

export default function NuevoTrasladoPersonal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [empleado, setEmpleado] = useState<any>(null);
  const [obras, setObras] = useState<any[]>([]);
  const [targetObraId, setTargetObraId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEncargado, setFilterEncargado] = useState('');

  useEffect(() => {
    if (id) fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    setLoading(true);
    // Traer datos del empleado
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obra_id, obras(name)')
      .eq('id', id)
      .single();

    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'Empleado no encontrado.' });
      navigate('/personal');
      return;
    }
    setEmpleado(empData);

    // Traer lista de obras (menos la actual)
    const { data: obrasData } = await supabase
      .from('obras')
      .select('id, name')
      .neq('id', empData.obra_id || '00000000-0000-0000-0000-000000000000')
      .order('name');
    
    setObras(obrasData || []);
    setObras(obrasData || []);
    setLoading(false);
  };

  const filteredObras = obras.filter(o => {
    const matchSearch = !searchTerm || o.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEncargado = !filterEncargado || (o.encargado_name === filterEncargado);
    return matchSearch && matchEncargado;
  });

  const encargadosUnicos = [...new Set(obras.map(o => o.encargado_name).filter(Boolean))].sort();

  const handleTransfer = async () => {
    if (!targetObraId || !profile || !empleado) return;
    setSubmitting(true);

    try {
      // 1. Crear el registro en traslados_personal
      const { data: trasladoData, error: trasladoError } = await supabase
        .from('traslados_personal')
        .insert([{
          empleado_id: empleado.id,
          source_obra_id: empleado.obra_id,
          target_obra_id: targetObraId,
          requester_id: profile.id,
          status: 'Pendiente'
        }])
        .select()
        .single();

      if (trasladoError) throw trasladoError;

      // 2. Buscar al encargado de la obra destino para mandarle un WhatsApp
      const { data: targetProfileData } = await supabase
        .from('profiles')
        .select('full_name, whatsapp')
        .eq('obra_id', targetObraId)
        .not('whatsapp', 'is', null)
        .limit(1)
        .single();

      const targetObra = obras.find(o => o.id === targetObraId);

      toast({ 
        title: 'Traslado Iniciado', 
        description: 'Se registró el traslado. Abriendo WhatsApp...',
        className: 'bg-emerald-50 border-emerald-200'
      });

      if (targetProfileData?.whatsapp) {
        const msg = [
          '*TRASLADO DE PERSONAL*',
          '',
          `Hola *${targetProfileData.full_name.split(' ')[0]}*!`,
          `*${profile.full_name}* te está enviando personal a tu obra (*${targetObra?.name}*):`,
          '',
          `- *Empleado:* ${empleado.full_name}`,
          `- *Origen:* ${empleado.obras?.name || 'Sin obra anterior'}`,
          '',
          'Por favor, cuando el empleado llegue a la obra, confirmá su recepción entrando a este link:',
          `${APP_URL}/personal/traslados/${trasladoData.id}`
        ].join('\n');
        
        setTimeout(() => { 
          window.open(buildWhatsAppLink(targetProfileData.whatsapp, msg), '_blank'); 
          navigate('/personal');
        }, 800);
      } else {
        toast({ 
          variant: 'default', 
          title: 'Aviso', 
          description: 'El encargado de destino no tiene WhatsApp registrado. El traslado queda pendiente en el sistema.' 
        });
        setTimeout(() => navigate('/personal'), 1500);
      }

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!empleado) return null;

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-safe">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/personal')} className="p-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      <Card className="shadow-sm border-0 ring-1 ring-slate-100 rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-peie-light via-peie-blue to-peie-light" />
        <CardHeader className="pb-4 pt-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-peie-blue/10 flex items-center justify-center mb-3">
            <HardHat className="h-8 w-8 text-peie-blue" />
          </div>
          <CardTitle className="text-2xl font-bold text-peie-blue">Trasladar Personal</CardTitle>
          <p className="text-sm text-slate-500 mt-1">Seleccioná la obra de destino</p>
        </CardHeader>
        
        <CardContent className="space-y-5">
          {/* Info del Empleado */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Empleado a trasladar</p>
            <p className="font-bold text-slate-800 text-lg">{empleado.full_name}</p>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" /> Origen actual: <strong>{empleado.obras?.name || 'Sin asignar'}</strong>
            </p>
          </div>

          {/* Selección de Destino */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="h-4 w-4" /> Obra de Destino
            </label>
            <div className="flex flex-col gap-2">
              <Input 
                placeholder="Buscar obra por nombre..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl"
              />
              <select
                value={filterEncargado}
                onChange={e => setFilterEncargado(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option value="">Todos los encargados</option>
                {encargadosUnicos.map(e => (
                  <option key={e!} value={e!}>{e}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
              {filteredObras.map(obra => (
                <button
                  key={obra.id}
                  onClick={() => setTargetObraId(obra.id)}
                  className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    targetObraId === obra.id 
                      ? 'border-peie-blue bg-peie-blue/5 text-peie-blue shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{obra.name}</span>
                    {obra.encargado_name && <span className="text-[10px] text-slate-400 font-normal">Enc: {obra.encargado_name}</span>}
                  </div>
                </button>
              ))}
              {filteredObras.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400">No se encontraron obras con esos filtros.</p>
              )}
            </div>
          </div>

          {/* Botón Submit */}
          <div className="pt-4 border-t border-slate-100">
            <Button 
              onClick={handleTransfer} 
              disabled={!targetObraId || submitting}
              className="w-full h-14 rounded-xl font-bold text-white bg-peie-blue hover:bg-peie-blue/90 shadow-md text-base transition-all disabled:opacity-50"
            >
              <Send className="mr-2 h-5 w-5" />
              {submitting ? 'Registrando...' : 'Confirmar Traslado y Avisar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
