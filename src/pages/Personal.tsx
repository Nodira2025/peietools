import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { HardHat, Search, Clock, Camera, Plus, Trash2, Edit2, Check, Download } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { compressImage } from '../lib/imageUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';

interface Empleado {
  id: string;
  full_name: string;
  obra_id: string | null;
  status: 'Trabajando' | 'Libre';
  specialty: string | null;
  photo_url: string | null;
  whatsapp: string | null;
  obras: { name: string; encargado_name: string | null } | null;
}

interface TrasladoPendiente {
  id: string;
  empleados: { full_name: string };
  source_obra: { name: string } | null;
  status: string;
}

export default function Personal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [trasladosPendientes, setTrasladosPendientes] = useState<TrasladoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'staff' | 'history'>(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'history') return 'history';
    return 'staff';
  });
  const [historial, setHistorial] = useState<any[]>([]);
  const [filterObra, setFilterObra] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  
  // Filtros de fecha para el historial
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [specificDate, setSpecificDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  // Opciones para filtros
  const [obrasOpciones, setObrasOpciones] = useState<{id: string, name: string}[]>([]);
  const [specialtiesOpciones, setSpecialtiesOpciones] = useState<{value: string, label: string}[]>([]);

  // Camera file upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'logistica';

  // Profile modal state
  const [selectedEmpForProfile, setSelectedEmpForProfile] = useState<Empleado | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    full_name: string;
    specialty: string;
    whatsapp: string;
    status: 'Trabajando' | 'Libre';
    photo_url: string | null;
  }>({
    full_name: '',
    specialty: '',
    whatsapp: '',
    status: 'Libre',
    photo_url: null
  });
  const [profileUpdating, setProfileUpdating] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  const handleOpenProfile = (emp: Empleado) => {
    setSelectedEmpForProfile(emp);
    setProfileForm({
      full_name: emp.full_name,
      specialty: emp.specialty || '',
      whatsapp: emp.whatsapp || '',
      status: emp.status === 'Disponible' || emp.status === 'Libre' ? 'Libre' : 'Trabajando',
      photo_url: emp.photo_url
    });
    setIsProfileOpen(true);
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setProfileForm(prev => ({ ...prev, photo_url: compressed }));
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedEmpForProfile) return;
    setProfileUpdating(true);
    try {
      const { error } = await supabase
        .from('empleados')
        .update({
          full_name: profileForm.full_name,
          specialty: profileForm.specialty,
          whatsapp: profileForm.whatsapp || null,
          status: profileForm.status,
          photo_url: profileForm.photo_url
        })
        .eq('id', selectedEmpForProfile.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      } else {
        toast({ title: 'Perfil actualizado', description: 'Los datos del empleado fueron guardados.' });
        setIsProfileOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el perfil.' });
    } finally {
      setProfileUpdating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Fetch Empleados
    const { data: empData, error: empError } = await supabase
      .from('empleados')
      .select('id, full_name, obra_id, status, specialty, photo_url, whatsapp, obras:obra_id(name, encargado_name)')
      .order('full_name');
      
    if (empError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el personal' });
    } else {
      const dataWithDefaults = (empData || []).map((e: any) => ({
        id: e.id,
        full_name: e.full_name,
        obra_id: e.obra_id,
        status: e.status ? (e.status === 'Disponible' || e.status === 'Libre' ? 'Libre' : 'Trabajando') : (e.obra_id ? 'Trabajando' : 'Libre'),
        specialty: e.specialty || 'Electricista',
        photo_url: e.photo_url,
        whatsapp: e.whatsapp || null,
        obras: Array.isArray(e.obras) ? e.obras[0] : e.obras
      }));
      setEmpleados(dataWithDefaults as Empleado[]);
      
      const uniqueSpecs = [...new Set(dataWithDefaults.map(e => e.specialty))].sort();
      setSpecialtiesOpciones(uniqueSpecs.map(s => ({ value: s, label: s })));
    }

    // Fetch Traslados Pendientes donde la obra destino es la del usuario
    if (profile.obra_id) {
      const { data: trasData } = await supabase
        .from('traslados_personal')
        .select('id, status, empleados(full_name), source_obra:obras!traslados_personal_source_obra_id_fkey(name)')
        .eq('target_obra_id', profile.obra_id)
        .eq('status', 'Pendiente');
      
      const mappedTrasData = (trasData || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        empleados: Array.isArray(t.empleados) ? t.empleados[0] : t.empleados,
        source_obra: Array.isArray(t.source_obra) ? t.source_obra[0] : t.source_obra
      }));
      setTrasladosPendientes(mappedTrasData as TrasladoPendiente[]);
    }

    // Fetch Historial de movimientos
    let query = supabase
      .from('traslados_personal')
      .select(`
        id, status, created_at,
        empleados(full_name),
        source_obra:obras!traslados_personal_source_obra_id_fkey(name),
        target_obra:obras!traslados_personal_target_obra_id_fkey(name)
      `)
      .order('created_at', { ascending: false });
      
    if (!isAdmin && profile.obra_id) {
      query = query.or(`source_obra_id.eq.${profile.obra_id},target_obra_id.eq.${profile.obra_id}`);
    }
    const { data: histData } = await query;
    if (histData) {
      const mappedHistData = histData.map((h: any) => ({
        id: h.id,
        status: h.status,
        created_at: h.created_at,
        empleados: Array.isArray(h.empleados) ? h.empleados[0] : h.empleados,
        source_obra: Array.isArray(h.source_obra) ? h.source_obra[0] : h.source_obra,
        target_obra: Array.isArray(h.target_obra) ? h.target_obra[0] : h.target_obra
      }));
      setHistorial(mappedHistData);
    }

    // Fetch Filter Options
    const { data: obrasData } = await supabase.from('obras').select('id, name, encargado_name').eq('active', true);
    if (obrasData) {
      setObrasOpciones(obrasData.map(o => ({ id: o.id, name: o.name })));
    }

    setLoading(false);
  };

  // const handleRelease = async (id: string) => {
  //   if (!window.confirm('¿Liberar a este empleado? Quedará sin obra asignada.')) return;
  //   const { error } = await supabase
  //     .from('empleados')
  //     .update({ 
  //       obra_id: null,
  //       status: 'Disponible'
  //     })
  //     .eq('id', id);
  // 
  //   if (error) {
  //     toast({ variant: 'destructive', title: 'Error', description: error.message });
  //   } else {
  //     toast({ title: 'Empleado Liberado', description: 'Ahora se encuentra en estado Disponible.' });
  //     fetchData();
  //   }
  // };

  const filteredEmpleados = empleados.filter(e => {
    const matchesSearch = !search || 
      e.full_name.toLowerCase().includes(search.toLowerCase()) || 
      (e.obras?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.specialty || '').toLowerCase().includes(search.toLowerCase());
    
    const matchesObra = !filterObra || e.obra_id === filterObra;
    const matchesSpecialty = !filterSpecialty || e.specialty === filterSpecialty;
    
    let matchesStatus = true;
    if (filterType === 'free') {
      matchesStatus = e.status === 'Libre' || !e.obra_id;
    } else if (filterType === 'busy') {
      matchesStatus = e.status === 'Trabajando' || !!e.obra_id;
    }
    
    return matchesSearch && matchesObra && matchesSpecialty && matchesStatus;
  });

  // Tema de colores para las distintas obras (basado en la planilla del cliente)
  const getObraTheme = (name: string) => {
    const cleanName = name.toLowerCase();
    if (cleanName.includes('libre') || cleanName.includes('disponible') || cleanName.includes('sin asignar')) {
      return {
        border: 'border-l-green-500 border-l-4',
        bg: 'bg-green-50/50 border-green-100',
        badge: 'bg-green-100 text-green-800 border-green-200'
      };
    }
    if (cleanName.includes('#300') || cleanName.includes('link')) {
      return {
        border: 'border-l-amber-500 border-l-4',
        bg: 'bg-amber-50/30 border-amber-100',
        badge: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }
    if (cleanName.includes('aeropuerto')) {
      return {
        border: 'border-l-fuchsia-500 border-l-4',
        bg: 'bg-fuchsia-50/30 border-fuchsia-100',
        badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
      };
    }
    if (cleanName.includes('bamboo') || cleanName.includes('anzorena')) {
      return {
        border: 'border-l-emerald-500 border-l-4',
        bg: 'bg-emerald-50/30 border-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    }
    if (cleanName.includes('ausente') || cleanName.includes('lic. medica') || cleanName.includes('médica')) {
      return {
        border: 'border-l-orange-500 border-l-4',
        bg: 'bg-orange-50/30 border-orange-100',
        badge: 'bg-orange-100 text-orange-800 border-orange-200'
      };
    }
    if (cleanName.includes('cantares')) {
      return {
        border: 'border-l-pink-500 border-l-4',
        bg: 'bg-pink-50/30 border-pink-100',
        badge: 'bg-pink-100 text-pink-800 border-pink-200'
      };
    }
    if (cleanName.includes('clínica') || cleanName.includes('clinica') || cleanName.includes('mayo')) {
      return {
        border: 'border-l-yellow-500 border-l-4',
        bg: 'bg-yellow-50/30 border-yellow-100',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      };
    }
    if (cleanName.includes('domus')) {
      return {
        border: 'border-l-sky-500 border-l-4',
        bg: 'bg-sky-50/30 border-sky-100',
        badge: 'bg-sky-100 text-sky-800 border-sky-200'
      };
    }
    if (cleanName.includes('duo') || cleanName.includes('dúo')) {
      return {
        border: 'border-l-indigo-500 border-l-4',
        bg: 'bg-indigo-50/30 border-indigo-100',
        badge: 'bg-indigo-100 text-indigo-800 border-indigo-200'
      };
    }
    if (cleanName.includes('losa')) {
      return {
        border: 'border-l-rose-500 border-l-4',
        bg: 'bg-rose-50/30 border-rose-100',
        badge: 'bg-rose-100 text-rose-800 border-rose-200'
      };
    }
    if (cleanName.includes('oasis')) {
      return {
        border: 'border-l-teal-500 border-l-4',
        bg: 'bg-teal-50/30 border-teal-100',
        badge: 'bg-teal-100 text-teal-800 border-teal-200'
      };
    }
    // Default fallback
    return {
      border: 'border-l-slate-400 border-l-4',
      bg: 'bg-slate-50/30 border-slate-100',
      badge: 'bg-slate-100 text-slate-800 border-slate-200'
    };
  };

  // Agrupamiento por Obra
  const groupedByObra: Record<string, { name: string; encargado_name?: string | null; id?: string; list: Empleado[] }> = {};

  filteredEmpleados.forEach((emp) => {
    const isLibre = emp.status === 'Libre' || !emp.obra_id;
    const obraKey = isLibre ? 'Sin Asignar' : (emp.obra_id || 'Sin Asignar');

    if (!groupedByObra[obraKey]) {
      groupedByObra[obraKey] = {
        id: isLibre ? undefined : emp.obra_id || undefined,
        name: isLibre ? 'Operarios Libres' : (emp.obras?.name || 'Obra Desconocida'),
        encargado_name: isLibre ? null : (emp.obras?.encargado_name || null),
        list: []
      };
    }
    groupedByObra[obraKey].list.push(emp);
  });

  const sortedObraKeys = Object.keys(groupedByObra).sort((a, b) => {
    if (a === 'Sin Asignar') return -1;
    if (b === 'Sin Asignar') return 1;
    return groupedByObra[a].name.localeCompare(groupedByObra[b].name);
  });

  // Dividir obras con y sin personal
  const { obrasConPersonal, obrasSinPersonal } = useMemo(() => {
    const con = obrasOpciones.filter(o => empleados.some(e => e.obra_id === o.id));
    const sin = obrasOpciones.filter(o => !empleados.some(e => e.obra_id === o.id));
    return { obrasConPersonal: con, obrasSinPersonal: sin };
  }, [obrasOpciones, empleados]);

  // Filtrado de historial por rangos de fecha
  const filteredHistorial = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Inicio de la semana (Lunes)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    
    // Inicio del mes
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return historial.filter(h => {
      const createdDate = new Date(h.created_at);
      
      switch (dateFilter) {
        case 'today':
          return createdDate >= startOfToday;
        case 'week':
          return createdDate >= startOfWeek;
        case 'month':
          return createdDate >= startOfMonth;
        case 'custom':
          if (!specificDate) return true;
          const targetDate = new Date(specificDate + 'T00:00:00'); // Evita desfases de huso horario
          return (
            createdDate.getFullYear() === targetDate.getFullYear() &&
            createdDate.getMonth() === targetDate.getMonth() &&
            createdDate.getDate() === targetDate.getDate()
          );
        case 'all':
        default:
          return true;
      }
    });
  }, [historial, dateFilter, specificDate]);

  const exportToExcel = () => {
    if (filteredEmpleados.length === 0) {
      toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay personal filtrado para exportar.' });
      return;
    }

    const data = filteredEmpleados.map(e => ({
      'Nombre Completo': e.full_name,
      'Especialidad': e.specialty || 'Electricista',
      'WhatsApp': e.whatsapp || 'No registrado',
      'Estado': e.status,
      'Obra Asignada': e.obras?.name || 'Sin Asignar',
      'Coordinador de Obra': e.obras?.encargado_name || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Personal");
    XLSX.writeFile(workbook, `Reporte_Personal_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Éxito', description: 'Listado de personal exportado a Excel correctamente.' });
  };

  return (
    <div className="space-y-5 pb-safe">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Personal</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión y traslado de electricistas</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <Button 
            variant={activeTab === 'staff' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('staff')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'staff' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Equipo
          </Button>
          <Button 
            variant={activeTab === 'history' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('history')}
            className={`rounded-lg text-xs h-8 ${activeTab === 'history' ? 'bg-white shadow-sm text-peie-blue' : 'text-slate-500'}`}
          >
            Movimientos
          </Button>
        </div>
      </div>

      {/* Alerta de traslados pendientes */}
      {trasladosPendientes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-orange-700 font-bold">
            <Clock className="h-5 w-5" />
            <h3>Traslados Entrantes Pendientes ({trasladosPendientes.length})</h3>
          </div>
          <div className="space-y-2">
            {trasladosPendientes.map(t => (
              <div key={t.id} className="bg-white rounded-lg p-3 flex justify-between items-center shadow-sm border border-orange-100">
                <div>
                  <p className="text-sm font-bold text-slate-800">{t.empleados?.full_name}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    Desde: {t.source_obra?.name || 'Desconocida'}
                  </p>
                </div>
                <Button 
                  onClick={() => navigate(`/personal/traslados/${t.id}`, { state: { from: '/personal' } })}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Confirmar Recepción
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-peie-blue" />
          <Input
            placeholder="Buscar empleado o por obra..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl border-slate-200 shadow-sm"
          />
        </div>

        {/* Control de Segmentos */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
          {[
            { value: 'all', label: `Todos ${empleados.length}` },
            { value: 'free', label: `Libres ${empleados.filter(e => e.status === 'Libre' || !e.obra_id).length}` },
            { value: 'busy', label: `En Obra ${empleados.filter(e => e.status === 'Trabajando' || e.obra_id).length}` }
          ].map(opt => (
            <Button 
              key={opt.value}
              variant={filterType === opt.value ? 'default' : 'ghost'} 
              onClick={() => setFilterType(opt.value)}
              className={`flex-1 min-w-[70px] rounded-lg text-xs h-9 ${
                filterType === opt.value 
                  ? 'bg-blue-600 shadow-sm text-white hover:bg-blue-700' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={filterObra}
              onChange={e => setFilterObra(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
            >
              <option value="">Obra: Todas</option>
              {obrasConPersonal.length > 0 && (
                <optgroup label="Con Personal">
                  {obrasConPersonal.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
              {obrasSinPersonal.length > 0 && (
                <optgroup label="Sin Personal (Futuras)">
                  {obrasSinPersonal.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              )}
            </select>

            <select 
              value={filterSpecialty}
              onChange={e => setFilterSpecialty(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none"
            >
              <option value="">Especialidad: Todas</option>
              {specialtiesOpciones.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {(filterObra || filterSpecialty || search || filterType !== 'all') && (
              <button 
                onClick={() => { setFilterObra(''); setFilterSpecialty(''); setSearch(''); setFilterType('all'); }}
                className="text-xs text-rose-500 font-black hover:underline px-2"
              >
                × Limpiar
              </button>
            )}
          </div>

          {activeTab === 'staff' && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="h-9 rounded-xl border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-semibold shadow-sm flex items-center gap-1.5 ml-auto sm:ml-0"
            >
              <Download className="h-4 w-4" />
              <span>Exportar Excel</span>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando personal...</div>
      ) : activeTab === 'staff' ? (
        <div className="space-y-6">
          {sortedObraKeys.map(obraKey => {
            const group = groupedByObra[obraKey];
            const theme = getObraTheme(group.name);
            
            return (
              <div 
                key={obraKey} 
                className={`p-4 rounded-2xl border shadow-sm space-y-3 ${theme.border} ${theme.bg}`}
              >
                {/* Cabecera del Grupo (Obra) */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200/50">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-peie-blue text-sm md:text-base tracking-tight">{group.name}</h3>
                      {group.id && (
                        <button
                          onClick={() => navigate('/mis-obras', { state: { selectedObraId: group.id } })}
                          className="text-[10px] font-bold text-blue-600 hover:underline shrink-0"
                        >
                          (Ver Obra)
                        </button>
                      )}
                    </div>
                    {group.encargado_name && (
                      <p className="text-[10px] md:text-xs text-slate-500 font-semibold mt-0.5">
                        Coordinador: <span className="text-peie-blue font-bold">{group.encargado_name}</span>
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${theme.badge}`}>
                    {group.list.length} {group.list.length === 1 ? 'operario' : 'operarios'}
                  </span>
                </div>

                {/* Grilla de Operarios en la Obra */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.list.map(emp => {
                    const isLibre = emp.status === 'Libre' || !emp.obra_id;
                    const badgeStyle = isLibre 
                      ? 'bg-green-50 text-green-600 border-green-150' 
                      : 'bg-blue-50 text-blue-600 border-blue-150';

                    return (
                      <Card key={emp.id} className="overflow-hidden rounded-xl border-slate-100 hover:shadow-md transition-all duration-200 bg-white">
                        <CardContent className="p-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-blue-50 border border-slate-100 flex items-center justify-center">
                                {emp.photo_url ? (
                                  <img src={emp.photo_url} alt={emp.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <HardHat className="h-5 w-5 text-blue-300" />
                                )}
                              </div>
                              {isAdmin && (
                                <button 
                                  onClick={() => { setSelectedEmpId(emp.id); fileInputRef.current?.click(); }}
                                  className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1 shadow hover:bg-blue-700 border border-white"
                                >
                                  <Camera className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>

                            {/* Detalles */}
                            <div className="min-w-0 space-y-0.5">
                              <p 
                                className="font-extrabold text-xs text-[#031530] truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                                onClick={() => handleOpenProfile(emp)}
                                title="Ver y editar perfil"
                              >
                                {emp.full_name}
                              </p>
                              <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wide">
                                {emp.specialty || 'Electricista'}
                              </p>
                              
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${badgeStyle}`}>
                                  {isLibre ? 'Libre' : 'En Obra'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Botón de acción */}
                          <div className="shrink-0">
                            {isLibre ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50/50 h-8 px-3 text-[11px] font-black rounded-lg"
                                onClick={() => navigate(`/personal/trasladar/${emp.id}`)}
                              >
                                Asignar
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-100 h-8 px-3 text-[11px] font-bold rounded-lg"
                                onClick={() => handleOpenProfile(emp)}
                              >
                                Ver
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {filteredEmpleados.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
              <HardHat className="mx-auto h-12 w-12 text-slate-350 mb-2" />
              <p className="text-sm font-bold text-slate-500">No hay operarios en esta categoría</p>
              <p className="text-xs text-slate-400 mt-1">Intente remover o cambiar los filtros de búsqueda.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selector de Rango de Fecha */}
          <div className="flex flex-col gap-2.5 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrar Historial por Fecha</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'custom', label: 'Fecha específica' },
                { value: 'all', label: 'Todos' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDateFilter(opt.value as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === opt.value
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-150'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            
            {/* Input de Fecha Especifica */}
            {dateFilter === 'custom' && (
              <div className="pt-1.5 flex items-center gap-2">
                <input
                  type="date"
                  value={specificDate}
                  onChange={e => setSpecificDate(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-slate-700 font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          {/* Listado de Movimientos Filtrados */}
          <div className="space-y-3">
            {filteredHistorial.map(h => (
              <Card key={h.id} className="rounded-xl border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200" onClick={() => navigate(`/personal/traslados/${h.id}`, { state: { from: '/personal?tab=history' } })}>
                <CardContent className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-800">{h.empleados?.full_name}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      {h.source_obra?.name || 'Origen'} → {h.target_obra?.name || 'Destino'}
                    </p>
                    <p className="text-[9px] text-slate-300 font-medium">Solicitado: {new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                    h.status === 'Pendiente' ? 'bg-orange-50 text-orange-600 border-orange-150' : 
                    h.status === 'Confirmado' ? 'bg-green-50 text-green-600 border-green-150' : 
                    'bg-slate-50 text-slate-600 border-slate-150'
                  }`}>
                    {h.status}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredHistorial.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Clock className="mx-auto h-12 w-12 text-slate-350 mb-2 animate-pulse" />
                <p className="text-sm font-bold text-slate-500">No hay movimientos registrados</p>
                <p className="text-xs text-slate-400 mt-1">
                  {dateFilter === 'today' ? 'No se registraron traslados hoy.' :
                   dateFilter === 'week' ? 'No hay traslados esta semana.' :
                   dateFilter === 'month' ? 'No hay traslados este mes.' :
                   dateFilter === 'custom' ? `No hay traslados para la fecha ${new Date(specificDate + 'T00:00:00').toLocaleDateString()}.` :
                   'No hay movimientos en el sistema.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input for Avatar Uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        className="hidden" 
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !selectedEmpId) return;
          try {
            const compressed = await compressImage(file);
            const { error } = await supabase
              .from('empleados')
              .update({ photo_url: compressed })
              .eq('id', selectedEmpId);
            if (error) {
              toast({ variant: 'destructive', title: 'Error', description: error.message });
            } else {
              toast({ title: '¡Foto Actualizada!', description: 'La imagen del empleado fue guardada correctamente.' });
              fetchData();
            }
          } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
          }
          e.target.value = '';
        }}
      />

      {/* Modal de Perfil de Empleado (Ver y Editar) */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="rounded-3xl w-[95%] max-w-md bg-white border-slate-100 shadow-xl overflow-hidden p-0">
          <div className="bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 pb-6 relative">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight">Ficha del Operario</DialogTitle>
              <p className="text-slate-350 text-xs font-semibold">Visualización y edición de datos básicos</p>
            </DialogHeader>

            {/* Avatar en cabecera */}
            <div className="absolute -bottom-10 right-6">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border-4 border-white shadow-md flex items-center justify-center">
                  {profileForm.photo_url ? (
                    <img src={profileForm.photo_url} alt={profileForm.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <HardHat className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-lg p-1.5 shadow-md hover:bg-blue-700 border-2 border-white transition-all duration-200"
                  title="Cambiar Foto"
                >
                  <Camera className="h-3 w-3" />
                </button>
                <input
                  type="file"
                  ref={profilePhotoInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePhotoChange}
                />
              </div>
            </div>
          </div>

          <div className="p-6 pt-12 space-y-4">
            {/* Campo Nombre */}
            <div className="space-y-1">
              <Label htmlFor="profile-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</Label>
              <Input
                id="profile-name"
                value={profileForm.full_name}
                onChange={e => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                className="rounded-xl border-slate-200 focus-visible:ring-blue-600 font-semibold text-slate-800"
                placeholder="Ej: Pérez, Juan Carlos"
              />
            </div>

            {/* Campo Especialidad */}
            <div className="space-y-1">
              <Label htmlFor="profile-specialty" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Especialidad</Label>
              <Input
                id="profile-specialty"
                value={profileForm.specialty}
                onChange={e => setProfileForm(prev => ({ ...prev, specialty: e.target.value }))}
                className="rounded-xl border-slate-200 focus-visible:ring-blue-600 font-semibold text-slate-800"
                placeholder="Ej: Electricista, Ayudante, Oficial"
              />
            </div>

            {/* Campo WhatsApp / Teléfono */}
            <div className="space-y-1">
              <Label htmlFor="profile-whatsapp" className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp / Teléfono</Label>
              <Input
                id="profile-whatsapp"
                value={profileForm.whatsapp || ''}
                onChange={e => setProfileForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                className="rounded-xl border-slate-200 focus-visible:ring-blue-600 font-semibold text-slate-800"
                placeholder="Ej: +54 9 381..."
              />
            </div>

            {/* Campo Estado */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado de Disponibilidad</Label>
              <Select
                value={profileForm.status}
                onValueChange={(val: any) => setProfileForm(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="rounded-xl border-slate-200 focus:ring-blue-600 font-semibold text-slate-800 bg-white">
                  <SelectValue placeholder="Seleccione un estado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 bg-white shadow-md">
                  <SelectItem value="Libre" className="font-semibold text-slate-700">Libre</SelectItem>
                  <SelectItem value="Trabajando" className="font-semibold text-slate-700">Trabajando</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Obra Actual (Lectura) */}
            {selectedEmpForProfile?.obras && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Obra Asignada Actualmente</p>
                <p className="text-xs font-extrabold text-peie-blue">{selectedEmpForProfile.obras.name}</p>
                {selectedEmpForProfile.obras.encargado_name && (
                  <p className="text-[9px] text-slate-500 font-medium">Coordinador: {selectedEmpForProfile.obras.encargado_name}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 gap-2 sm:gap-0 rounded-b-3xl">
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                className="rounded-xl hover:bg-slate-200 text-slate-600 font-bold text-xs"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveProfile}
              disabled={profileUpdating || !profileForm.full_name.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-extrabold text-xs px-5 shadow-md shadow-blue-600/10 flex items-center gap-1.5"
            >
              {profileUpdating ? 'Guardando...' : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
