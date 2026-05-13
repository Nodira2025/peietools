import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ShoppingCart, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/auth';

export default function CompraDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [compra, setCompra] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isComprasRole = profile?.role === 'compras' || profile?.role === 'admin';

  useEffect(() => {
    if (id) fetchCompra();
  }, [id]);

  const fetchCompra = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes_compras')
      .select('*, obras(name), profiles!solicitudes_compras_requester_id_fkey(full_name)')
      .eq('id', id)
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Solicitud no encontrada.' });
      navigate('/compras');
    } else {
      setCompra(data);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pendiente': return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><Clock className="w-3 h-3 mr-1"/> Pendiente</span>;
      case 'En evaluación': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> En evaluación</span>;
      case 'Aprobada': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Aprobada</span>;
      case 'Rechazada': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> Rechazada</span>;
      case 'Comprada': return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><ShoppingCart className="w-3 h-3 mr-1"/> Comprada</span>;
      case 'Recibida': return <span className="bg-peie-light/20 text-peie-blue px-2 py-1 rounded text-xs font-semibold flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Recibida</span>;
      case 'Cerrada': return <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs font-semibold flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Cerrada</span>;
      default: return <span className="bg-gray-100 px-2 py-1 rounded text-xs">{status}</span>;
    }
  };

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase.from('solicitudes_compras').update({ status: newStatus }).eq('id', compra.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Actualizado', description: `Estado cambiado a ${newStatus}` });
      fetchCompra();
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando solicitud...</div>;
  if (!compra) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <Button variant="ghost" onClick={() => navigate('/compras')} className="p-0 hover:bg-transparent">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Compras
        </Button>
      </div>

      <Card className="shadow-sm border-t-4" style={{ borderTopColor: 'var(--peie-blue)' }}>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-peie-blue">
                {compra.tool_name}
              </CardTitle>
              <p className="text-sm font-medium text-peie-blue mt-1">Cant: {compra.quantity} | {compra.priority}</p>
            </div>
            {getStatusBadge(compra.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2 text-sm">
            <p><strong>Solicitante:</strong> {compra.profiles?.full_name}</p>
            <p><strong>Obra Destino:</strong> {compra.obras?.name || 'Inventario General'}</p>
            <p><strong>Justificación:</strong> {compra.justification}</p>
            {compra.description && <p><strong>Especificaciones:</strong> {compra.description}</p>}
            <p className="text-xs text-muted-foreground mt-2"><strong>Fecha Solicitud:</strong> {new Date(compra.created_at).toLocaleString()}</p>
          </div>

          {isComprasRole && compra.status !== 'Cerrada' && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Acciones de Aprobación/Compra</h4>
              <div className="flex flex-wrap gap-2">
                {compra.status === 'Pendiente' && <Button onClick={() => updateStatus('En evaluación')} className="flex-1 bg-blue-600 hover:bg-blue-700">Evaluar</Button>}
                {compra.status === 'En evaluación' && <Button onClick={() => updateStatus('Aprobada')} className="flex-1 bg-green-600 hover:bg-green-700">Aprobar</Button>}
                {(compra.status === 'Pendiente' || compra.status === 'En evaluación') && <Button onClick={() => updateStatus('Rechazada')} className="flex-1 bg-red-600 hover:bg-red-700">Rechazar</Button>}
                {compra.status === 'Aprobada' && <Button onClick={() => updateStatus('Comprada')} className="flex-1 bg-purple-600 hover:bg-purple-700">Marcar Comprada</Button>}
                {compra.status === 'Comprada' && <Button onClick={() => updateStatus('Recibida')} className="flex-1 bg-peie-blue hover:bg-peie-blue/90">Marcar Recibida</Button>}
                {compra.status === 'Recibida' && (
                  <div className="w-full text-center text-sm text-green-700 bg-green-50 p-3 rounded">
                    Esta compra ha sido recibida. <br />
                    Vuelve al panel de <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/compras')}>Compras</Button> para darla de alta en el inventario.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
