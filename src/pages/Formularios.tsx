import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Search, 
  Send, 
  CheckCircle2, 
  Clock, 
  Users, 
  HardHat, 
  Building2, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles,
  Phone,
  RefreshCw
} from 'lucide-react';
import { buildWhatsAppLink, APP_URL } from '../lib/whatsapp';

interface EmpleadoFormulario {
  id: string;
  full_name: string;
  role: string;
  specialty?: string | null;
  whatsapp: string | null;
  obra_id?: string | null;
  active: boolean;
  obras?: { name: string } | null;
}

export default function Formularios() {
  const { toast } = useToast();
  const [empleados, setEmpleados] = useState<EmpleadoFormulario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObra, setSelectedObra] = useState<string>('todas');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Registro de envíos recientes
  const [sentMap, setSentMap] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('peie_formularios_enviados');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('id, full_name, role, specialty, whatsapp, obra_id, active, obras(name)')
        .eq('active', true)
        .order('full_name');

      if (error) throw error;
      setEmpleados(data || []);
    } catch (err: any) {
      console.error('Error cargando empleados:', err);
      toast({
        variant: 'destructive',
        title: 'Error de carga',
        description: 'No se pudieron obtener los empleados de obra.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Lista de obras únicas para el filtro
  const obrasList = useMemo(() => {
    const names = new Set<string>();
    empleados.forEach(e => {
      if (e.obras?.name) names.add(e.obras.name);
    });
    return Array.from(names).sort();
  }, [empleados]);

  // Filtrado de empleados
  const filteredEmpleados = useMemo(() => {
    return empleados.filter(e => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        e.full_name.toLowerCase().includes(s) ||
        (e.specialty && e.specialty.toLowerCase().includes(s)) ||
        (e.whatsapp && e.whatsapp.includes(s)) ||
        (e.obras?.name && e.obras.name.toLowerCase().includes(s));

      const matchesObra = selectedObra === 'todas' || e.obras?.name === selectedObra;
      return matchesSearch && matchesObra;
    });
  }, [empleados, searchTerm, selectedObra]);

  const generateFormUrl = (emp: EmpleadoFormulario) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : APP_URL;
    return `${origin}/cargar-horas?nombre=${encodeURIComponent(emp.full_name)}`;
  };

  const handleSendWhatsApp = (emp: EmpleadoFormulario) => {
    if (!emp.whatsapp || emp.whatsapp.trim().length < 8) {
      toast({
        variant: 'destructive',
        title: 'Sin WhatsApp',
        description: `${emp.full_name} no tiene un número de WhatsApp registrado.`
      });
      return;
    }

    const formUrl = generateFormUrl(emp);
    const primerNombre = emp.full_name.split(' ')[0];
    const message = [
      `👋 Hola *${primerNombre}*, ¿cómo estás?`,
      '',
      `Te comparto el link para registrar las *horas trabajadas de esta semana* en PEIE:`,
      `👉 ${formUrl}`,
      '',
      `Es muy simple: ingresás con tu DNI y computás tus horas día por día. Nos ayuda a calcular tus haberes y los premios por desempeño. ¡Muchas gracias!`
    ].join('\n');

    const waLink = buildWhatsAppLink(emp.whatsapp, message);
    window.open(waLink, '_blank');

    // Registrar como enviado
    const updatedSent = { ...sentMap, [emp.id]: true };
    setSentMap(updatedSent);
    try {
      localStorage.setItem('peie_formularios_enviados', JSON.stringify(updatedSent));
    } catch (err) {
      console.error(err);
    }

    toast({
      title: 'WhatsApp Abierto',
      description: `Mensaje listo para enviar a ${primerNombre}.`
    });
  };

  const handleCopyLink = (emp: EmpleadoFormulario) => {
    const url = generateFormUrl(emp);
    navigator.clipboard.writeText(url);
    setCopiedId(emp.id);
    toast({
      title: 'Enlace copiado',
      description: `Link del formulario de ${emp.full_name} copiado al portapapeles.`
    });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#031530] to-[#042454] text-white p-5 md:p-6 rounded-3xl shadow-lg border border-slate-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-peie-light/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-blue-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Gestión de Horas
            </span>
            <span className="text-xs text-slate-300 font-medium">
              ({empleados.length} operarios registrados)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
            Envío de Formularios de Horas
          </h1>
          <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
            Enviá a cada electricista y operario su link de carga semanal por WhatsApp para registrar sus horas trabajadas y calcular sus bonos.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button
            onClick={fetchData}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs rounded-2xl px-4 py-2.5 shadow-sm transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, especialidad u obra..."
            className="pl-10 pr-4 py-2 text-xs rounded-xl border-slate-200 focus-visible:ring-[#031530] font-medium bg-slate-50/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedObra}
            onChange={(e) => setSelectedObra(e.target.value)}
            className="w-full sm:w-auto h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#031530]"
          >
            <option value="todas">Todas las obras</option>
            {obrasList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Listado de Operarios */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Cargando personal de obra...</p>
        </div>
      ) : filteredEmpleados.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs space-y-3">
          <Users className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No se encontraron trabajadores</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Verificá el filtro de búsqueda o asignación de obras.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredEmpleados.map((emp) => {
            const hasSent = sentMap[emp.id];
            const hasPhone = emp.whatsapp && emp.whatsapp.trim().length >= 8;
            const isCopied = copiedId === emp.id;

            return (
              <Card 
                key={emp.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  
                  {/* Info Superior */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-100 group-hover:bg-blue-50 border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:text-blue-600 shrink-0 font-black text-sm transition-colors">
                          {emp.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 leading-snug group-hover:text-[#031530] transition-colors">
                            {emp.full_name}
                          </h3>
                          <p className="text-[11px] font-semibold text-slate-400 capitalize">
                            {emp.specialty || emp.role || 'Personal de Obra'}
                          </p>
                        </div>
                      </div>

                      {hasSent && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Enviado
                        </span>
                      )}
                    </div>

                    {/* Obra asignada */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold truncate">
                        {emp.obras?.name ? `Obra: ${emp.obras.name}` : 'Sin obra asignada'}
                      </span>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex items-center justify-between text-xs px-1">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono font-bold text-slate-700">
                          {emp.whatsapp || 'Sin WhatsApp'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyLink(emp)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors flex items-center gap-1 text-[11px] font-bold"
                        title="Copiar link del formulario"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] text-emerald-600 font-bold">Link Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Copiar link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Botón de Envío */}
                  <div className="pt-2 border-t border-slate-100">
                    <Button
                      onClick={() => handleSendWhatsApp(emp)}
                      disabled={!hasPhone}
                      className={`w-full font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm ${
                        hasPhone
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-98'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.09-3.846c1.62.963 3.426 1.47 5.278 1.471 5.516 0 10.01-4.498 10.014-10.02.002-2.673-1.04-5.187-2.936-7.086-1.897-1.9-4.411-2.946-7.083-2.947-5.525 0-10.02 4.5-10.024 10.022-.002 1.737.452 3.427 1.316 4.939l-1.002 3.66 3.737-.98zm11.378-7.79c-.3-.15-1.77-.874-2.045-.975-.276-.1-.476-.15-.676.15-.2.3-.775.975-.95 1.174-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.79-1.487-1.77-1.663-2.07-.175-.3-.019-.461.13-.61.135-.133.3-.349.45-.523.15-.174.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.676-1.625-.925-2.225-.244-.595-.513-.51-.676-.51-.162-.008-.349-.01-.536-.01-.187 0-.49.07-.747.349-.257.276-.98.958-.98 2.337s1.003 2.707 1.143 2.894c.14.188 1.974 3.014 4.782 4.228.668.288 1.19.46 1.597.59.672.214 1.28.184 1.762.11.536-.08 1.77-.724 2.02-1.388.25-.664.25-1.233.175-1.353-.075-.12-.275-.22-.575-.37z"/>
                      </svg>
                      <span>Enviar Formulario por WhatsApp</span>
                    </Button>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
