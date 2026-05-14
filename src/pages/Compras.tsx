import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Plus, CheckCircle, Clock, AlertCircle, RefreshCw, MessageCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '../store/auth';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';
import FilterBar from '../components/FilterBar';

interface Compra {
  id: string;
  tool_name: string;
  description: string | null;
  quantity: number;
  priority: string;
  justification: string | null;
  obra_id: string | null;
  requester_id: string;
  status: string;
  created_at: string;
  obras?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

interface Obra {
  id: string;
  name: string;
}

export default function Compras() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [selectedCompra, setSelectedCompra] = useState<Compra | null>(null);
  
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const isComprasRole = profile?.role === 'compras' || profile?.role === 'admin';

  // Form State para nueva solicitud
  const [toolName, setToolName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState('Normal');
  const [justification, setJustification] = useState('');
  const [obraId, setObraId] = useState('');

  // Form State para convertir a herramienta
  const [newToolCode, setNewToolCode] = useState('');
  const [newToolBrand, setNewToolBrand] = useState('');
  const [newToolModel, setNewToolModel] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: cData, error: cError } = await supabase
      .from('solicitudes_compras')
      .select('*, obras(name), profiles!solicitudes_compras_requester_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (!cError) setCompras(cData || []);

    const { data: oData } = await supabase.from('obras').select('id, name').eq('active', true).order('name');
    if (oData) setObras(oData);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCompras = compras.filter(c => {
    const matchSearch = !searchTerm || c.tool_name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.obras?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || c.status === filterStatus;
    const matchPriority = !filterPriority || c.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const resetForm = () => {
    setToolName(''); setDescription(''); setQuantity(1); setPriority('Normal'); setJustification(''); setObraId('');
  };

  const getWhatsAppRecipient = async () => {
    // 1. Compras, 2. Admin, 3. Logistica
    const { data } = await supabase.from('profiles').select('full_name, whatsapp, role').eq('active', true);
    if (!data || data.length === 0) return null;

    const comprasUser = data.find(p => p.role === 'compras' && p.whatsapp);
    if (comprasUser) return comprasUser;

    const adminUser = data.find(p => p.role === 'admin' && p.whatsapp);
    if (adminUser) return adminUser;

    const logisticaUser = data.find(p => p.role === 'logistica' && p.whatsapp);
    if (logisticaUser) return logisticaUser;

    return null;
  };

  const generateWhatsAppMessage = (compra: any, recipientName: string) => {
    const obraName = obras.find(o => o.id === compra.obra_id)?.name || 'Sin obra específica';
    const message = `Hola ${recipientName}.

Se ha generado una nueva solicitud de compra:

🔧 Herramienta: ${compra.tool_name}
📦 Cantidad: ${compra.quantity}
🏗 Obra: ${obraName}
⚠ Prioridad: ${compra.priority}
📝 Justificación: ${compra.justification}

Revisar solicitud:
${APP_URL}/compras/${compra.id}`;
    return message;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const payload = {
      tool_name: toolName,
      description,
      quantity,
      priority,
      justification,
      obra_id: obraId || null,
      requester_id: profile.id
    };

    const { data, error } = await supabase.from('solicitudes_compras').insert([payload]).select().single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Éxito', description: 'Solicitud de compra creada.' });
      setIsDialogOpen(false);
      
      const recipient = await getWhatsAppRecipient();
      if (recipient && recipient.whatsapp) {
        const msg = generateWhatsAppMessage(data, recipient.full_name);
        window.open(buildWhatsAppLink(recipient.whatsapp, msg), '_blank');
      }

      resetForm();
      fetchData();
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('solicitudes_compras').update({ status: newStatus }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Actualizado', description: `Estado cambiado a ${newStatus}` });
      fetchData();
    }
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompra) return;

    const newTool = {
      code: newToolCode,
      name: selectedCompra.tool_name,
      description: selectedCompra.description,
      brand: newToolBrand,
      model: newToolModel,
      status: 'Disponible',
      current_obra_id: selectedCompra.obra_id
    };

    const { error: tError } = await supabase.from('herramientas').insert([newTool]);

    if (tError) {
      toast({ variant: 'destructive', title: 'Error', description: tError.message });
    } else {
      await supabase.from('solicitudes_compras').update({ status: 'Cerrada' }).eq('id', selectedCompra.id);
      toast({ title: 'Éxito', description: 'Herramienta creada en el inventario.' });
      setIsToolDialogOpen(false);
      setNewToolCode(''); setNewToolBrand(''); setNewToolModel('');
      fetchData();
    }
  };

  const openToolDialog = (compra: Compra) => {
    setSelectedCompra(compra);
    setIsToolDialogOpen(true);
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

  const handleResendWhatsApp = async (compra: any) => {
    const recipient = await getWhatsAppRecipient();
    if (recipient && recipient.whatsapp) {
      const msg = generateWhatsAppMessage(compra, recipient.full_name);
      window.open(buildWhatsAppLink(recipient.whatsapp, msg), '_blank');
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'No se encontró destinatario con WhatsApp.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Solicitudes de Compra</h1>
          <p className="text-sm text-muted-foreground">{filteredCompras.length} de {compras.length} solicitudes</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="bg-peie-blue hover:bg-peie-blue/90 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Nueva Solicitud
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Solicitar Compra de Herramienta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="toolName">Herramienta o Insumo *</Label>
                <Input id="toolName" value={toolName} onChange={e => setToolName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad *</Label>
                  <Input id="quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baja">Baja</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Obra Destino</Label>
                <Select value={obraId} onValueChange={setObraId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione una obra..." /></SelectTrigger>
                  <SelectContent>
                    {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="justification">Justificación *</Label>
                <Input id="justification" value={justification} onChange={e => setJustification(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Especificaciones (Opcional)</Label>
                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-peie-blue hover:bg-peie-blue/90">
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar solicitud por WhatsApp
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para convertir en herramienta */}
        <Dialog open={isToolDialogOpen} onOpenChange={setIsToolDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alta de Herramienta en Inventario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTool} className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">Estás por crear: <strong>{selectedCompra?.tool_name}</strong> para la obra <strong>{selectedCompra?.obras?.name || 'Inventario General'}</strong>.</p>
              <div className="space-y-2">
                <Label htmlFor="newCode">Código Interno *</Label>
                <Input id="newCode" value={newToolCode} onChange={e => setNewToolCode(e.target.value)} required placeholder="Ej: TAL-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newBrand">Marca</Label>
                  <Input id="newBrand" value={newToolBrand} onChange={e => setNewToolBrand(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newModel">Modelo</Label>
                  <Input id="newModel" value={newToolModel} onChange={e => setNewToolModel(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Crear y Cerrar Solicitud</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buscador y filtros */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar herramienta, solicitante, obra..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 rounded-xl" />
      </div>
      <FilterBar
        filters={[
          { key: 'status', label: 'Estado', value: filterStatus, options: ['Pendiente','En evaluacion','Aprobada','Rechazada','Comprada','Recibida','Cerrada'].map(s => ({ value: s, label: s })) },
          { key: 'priority', label: 'Prioridad', value: filterPriority, options: ['Baja','Normal','Alta','Urgente'].map(p => ({ value: p, label: p })) },
        ]}
        onFilterChange={(key, val) => { if (key === 'status') setFilterStatus(val); else setFilterPriority(val); }}
      />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando solicitudes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCompras.map(compra => (
            <Card key={compra.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{new Date(compra.created_at).toLocaleDateString()}</span>
                  {getStatusBadge(compra.status)}
                </div>
                <CardTitle className="text-lg line-clamp-1">{compra.tool_name}</CardTitle>
                <p className="text-sm font-medium text-peie-blue">Cant: {compra.quantity} | {compra.priority}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2 mt-2 text-muted-foreground">
                <p><strong>Solicita:</strong> {compra.profiles?.full_name}</p>
                <p><strong>Obra:</strong> {compra.obras?.name || 'N/A'}</p>
                <p className="line-clamp-2" title={compra.justification || ''}><strong>Motivo:</strong> {compra.justification}</p>
                
                <div className="pt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="flex-1 w-full" onClick={() => handleResendWhatsApp(compra)}>
                    <MessageCircle className="w-3 h-3 mr-2" /> Reenviar
                  </Button>
                  
                  {isComprasRole && compra.status !== 'Cerrada' && (
                    <>
                      {compra.status === 'Pendiente' && <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(compra.id, 'En evaluación')}>Evaluar</Button>}
                      {compra.status === 'En evaluación' && <Button size="sm" variant="outline" className="flex-1 text-green-600" onClick={() => updateStatus(compra.id, 'Aprobada')}>Aprobar</Button>}
                      {(compra.status === 'Pendiente' || compra.status === 'En evaluación') && <Button size="sm" variant="outline" className="flex-1 text-red-600" onClick={() => updateStatus(compra.id, 'Rechazada')}>Rechazar</Button>}
                      {compra.status === 'Aprobada' && <Button size="sm" variant="outline" className="flex-1 text-purple-600" onClick={() => updateStatus(compra.id, 'Comprada')}>Marcar Comprada</Button>}
                      {compra.status === 'Comprada' && <Button size="sm" variant="outline" className="flex-1 text-peie-blue" onClick={() => updateStatus(compra.id, 'Recibida')}>Marcar Recibida</Button>}
                      {compra.status === 'Recibida' && (
                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white mt-2" onClick={() => openToolDialog(compra)}>
                          <RefreshCw className="w-4 h-4 mr-2" /> Crear en Inventario
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {compras.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No hay solicitudes</h3>
              <p className="mt-1 text-gray-500">No hay requerimientos de compra pendientes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
