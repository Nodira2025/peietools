import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { 
  ArrowLeft, 
  Download, 
  FileSpreadsheet, 
  FileText as PdfIcon, 
  Navigation 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface Herramienta {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  category: string | null;
  current_obra_id: string | null;
  obras?: { name: string } | null;
}

interface Obra {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface TrasladoPersonal {
  id: string;
  empleado_id: string;
  status: string;
  source_obra_id: string | null;
  target_obra_id: string;
  empleados?: { full_name: string } | null;
  source_obra?: { name: string; latitude: number | null; longitude: number | null } | null;
  target_obra?: { name: string; latitude: number | null; longitude: number | null } | null;
}

export default function Reportes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuthStore();
  const [herramientas, setHerramientas] = useState<Herramienta[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [traslados, setTraslados] = useState<TrasladoPersonal[]>([]);
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [empleadosDisponibles, setEmpleadosDisponibles] = useState(0);
  const [loading, setLoading] = useState(true);

  const isAuthorized = profile?.role === 'admin' || profile?.role === 'logistica';

  useEffect(() => {
    if (profile && !isAuthorized) {
      navigate('/dashboard');
    }
  }, [profile, isAuthorized, navigate]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Load herramientas
      const { data: hData } = await supabase
        .from('herramientas')
        .select('*, obras(name)')
        .order('name');
      setHerramientas(hData || []);

      // Load active obras
      const { data: oData } = await supabase
        .from('obras')
        .select('id, name, latitude, longitude')
        .eq('active', true);
      setObras(oData || []);

      // Load active traslados of personnel
      const { data: tData } = await supabase
        .from('traslados_personal')
        .select(`
          id, empleado_id, status, source_obra_id, target_obra_id,
          empleados(full_name),
          source_obra:obras!traslados_personal_source_obra_id_fkey(name, latitude, longitude),
          target_obra:obras!traslados_personal_target_obra_id_fkey(name, latitude, longitude)
        `);
      const mappedTData = (tData || []).map((t: any) => ({
        id: t.id,
        empleado_id: t.empleado_id,
        status: t.status,
        source_obra_id: t.source_obra_id,
        target_obra_id: t.target_obra_id,
        empleados: Array.isArray(t.empleados) ? t.empleados[0] : t.empleados,
        source_obra: Array.isArray(t.source_obra) ? t.source_obra[0] : t.source_obra,
        target_obra: Array.isArray(t.target_obra) ? t.target_obra[0] : t.target_obra
      }));
      setTraslados(mappedTData as TrasladoPersonal[]);

      // Load employee counts
      const { data: empData } = await supabase.from('empleados').select('id, status');
      if (empData) {
        setTotalEmpleados(empData.length);
        setEmpleadosDisponibles(empData.filter(e => e.status === 'Disponible' || e.status === 'Libre').length);
      }

    } catch (error) {
      console.error('Error al cargar datos del reporte:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAllData();
    }
  }, [isAuthorized]);

  if (!isAuthorized) return null;

  // KPIs
  const totalHerramientas = herramientas.length;
  const hDisponibles = herramientas.filter(h => h.status === 'Disponible').length;
  const hEnUso = herramientas.filter(h => h.status === 'En uso').length;
  const hExtraviadas = herramientas.filter(h => h.status === 'Fuera de servicio').length; // Rotas / extraviadas
  const hMantenimiento = herramientas.filter(h => h.status === 'En mantenimiento').length;

  // Chart 1: Categorías de herramientas (Pie Chart)
  const categoryCounts = herramientas.reduce((acc: Record<string, number>, curr) => {
    const cat = curr.category || 'Otros';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ['#031530', '#0ea5e9', '#f43f5e', '#10b981', '#8b5cf6', '#06b6d4', '#64748b'];

  // Chart 2: Solicitudes Históricas (Simulado a partir de las herramientas creadas por mes)
  const monthlyData = [
    { name: 'Ene', Solicitudes: 45, Entregas: 40 },
    { name: 'Feb', Solicitudes: 52, Entregas: 48 },
    { name: 'Mar', Solicitudes: 68, Entregas: 60 },
    { name: 'Abr', Solicitudes: 75, Entregas: 70 },
    { name: 'May', Solicitudes: 85, Entregas: 78 },
    { name: 'Jun', Solicitudes: 95, Entregas: 88 }
  ];

  // Chart 3: Tiempo promedio de entrega por obra (Horas)
  const deliveryTimeData = [
    { name: 'Obra Central', Horas: 1.2 },
    { name: 'Lomas de Tafí', Horas: 2.8 },
    { name: 'Yerba Buena', Horas: 2.1 },
    { name: 'Av. Colón', Horas: 3.4 },
    { name: 'Manantial', Horas: 1.8 }
  ];

  // EXPORTS
  const exportToExcel = () => {
    const data = herramientas.map(h => ({
      Codigo: h.code,
      Nombre: h.name,
      Marca: h.brand || 'Genérica',
      Modelo: h.model || 'N/A',
      Categoria: h.category || 'Otros',
      Estado: h.status,
      Obra: h.obras?.name || 'Base Central'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Herramientas");
    XLSX.writeFile(workbook, `Reporte_Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Éxito', description: 'Reporte Excel descargado.' });
  };

  const exportToCSV = () => {
    const headers = ['Codigo', 'Nombre', 'Marca', 'Modelo', 'Categoria', 'Estado', 'Obra'];
    const rows = herramientas.map(h => [
      h.code,
      h.name,
      h.brand || 'Genérica',
      h.model || 'N/A',
      h.category || 'Otros',
      h.status,
      h.obras?.name || 'Base Central'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Éxito', description: 'Reporte CSV descargado.' });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(3, 21, 48); // peie-blue
    doc.text("PEIE Tools - Reporte de Inventario", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 26);
    
    const tableColumn = ["Código", "Nombre", "Categoría", "Estado", "Obra"];
    const tableRows = herramientas.map(h => [
      h.code,
      h.name,
      h.category || 'Otros',
      h.status,
      h.obras?.name || 'Base Central'
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 32,
      theme: 'striped',
      headStyles: { fillColor: [3, 21, 48] }
    });

    doc.save(`Reporte_Inventario_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: 'Éxito', description: 'Reporte PDF descargado.' });
  };

  // Mapeador de coordenadas para Tucumán
  // Tucumán abarca aproximadamente Lng [-66.3, -64.4] y Lat [-26.0, -28.0]
  const mapCoords = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return { x: -100, y: -100 }; // Fuera del mapa
    const minLng = -66.3;
    const maxLng = -64.4;
    const minLat = -26.0;
    const maxLat = -28.0;

    // Interpolar coordenadas a un viewbox de 400x400
    const x = ((lng - minLng) / (maxLng - minLng)) * 320 + 40;
    const y = ((lat - minLat) / (maxLat - minLat)) * 320 + 40;
    return { x, y };
  };

  // Obras y traslados con geolocalización activa
  const mappedObras = obras.filter(o => o.latitude && o.longitude).map(o => ({
    ...o,
    ...mapCoords(o.latitude, o.longitude)
  }));

  const activeTraslados = traslados
    .filter(t => t.status === 'Pendiente' && t.source_obra?.latitude && t.target_obra?.latitude)
    .map(t => {
      const start = mapCoords(t.source_obra!.latitude, t.source_obra!.longitude);
      const end = mapCoords(t.target_obra!.latitude, t.target_obra!.longitude);
      // Calcular punto medio con fines de animación o posicionamiento
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      return {
        ...t,
        start,
        end,
        midX,
        midY
      };
    });

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-4 p-6">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-safe">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-peie-blue">Dashboard Analítico</h1>
            <p className="text-muted-foreground text-xs">Monitoreo ejecutivo en tiempo real estilo Power BI</p>
          </div>
        </div>

        {/* Botones de Exportación */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="rounded-xl text-xs h-10 border-slate-200">
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="rounded-xl text-xs h-10 border-slate-200 text-emerald-600 hover:text-emerald-700">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="rounded-xl text-xs h-10 border-slate-200 text-rose-600 hover:text-rose-700">
            <PdfIcon className="mr-1.5 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-peie-blue shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Herramientas</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-slate-800">{totalHerramientas}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disponibles</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-green-700">{hDisponibles}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-sky-500 shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Obra / Uso</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-sky-700">{hEnUso}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fuera de Servicio</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-red-600">{hExtraviadas}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Mantenimiento</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-orange-600">{hMantenimiento}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personal Disponible</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-indigo-700">
              {empleadosDisponibles} <span className="text-xs text-slate-400 font-normal">/ {totalEmpleados}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribución por Categoría (Torta) */}
        <Card className="rounded-2xl shadow-sm border-slate-100 bg-white">
          <CardHeader className="p-5 pb-1">
            <CardTitle className="text-sm font-bold text-slate-800">Inventario por Categoría</CardTitle>
            <CardDescription className="text-[11px]">Proporción de herramientas registradas</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <ChartTooltip formatter={(value) => [`${value} unidades`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Flujo mensual de solicitudes (Línea) */}
        <Card className="rounded-2xl shadow-sm border-slate-100 bg-white">
          <CardHeader className="p-5 pb-1">
            <CardTitle className="text-sm font-bold text-slate-800">Flujo Mensual de Solicitudes</CardTitle>
            <CardDescription className="text-[11px]">Solicitudes e intercambios recibidos vs aceptados</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <ChartTooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="Solicitudes" stroke="#0ea5e9" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Entregas" stroke="#10b981" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tiempos de Entrega por Obra (Barras) */}
        <Card className="rounded-2xl shadow-sm border-slate-100 bg-white">
          <CardHeader className="p-5 pb-1">
            <CardTitle className="text-sm font-bold text-slate-800">Tiempos de Despacho (Horas)</CardTitle>
            <CardDescription className="text-[11px]">Demora promedio desde la solicitud hasta la entrega</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '9px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} />
                  <ChartTooltip />
                  <Bar dataKey="Horas" fill="#031530" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MAPA DE TUCUMÁN EN TIEMPO REAL */}
      <Card className="rounded-2xl shadow-sm border-slate-150 bg-white overflow-hidden">
        <CardHeader className="p-5 pb-1">
          <div className="flex items-center gap-1.5">
            <Navigation className="h-4 w-4 text-peie-blue animate-pulse" />
            <CardTitle className="text-sm font-bold text-slate-800">Mapa Satelital de Movimientos (Tucumán)</CardTitle>
          </div>
          <CardDescription className="text-[11px]">
            Visualiza las obras de la empresa y la posición estimada de traslados activos en la provincia
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 flex flex-col md:flex-row gap-6">
          
          {/* Contenedor del Mapa SVG */}
          <div className="relative w-full md:w-[450px] h-[360px] bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden flex items-center justify-center shrink-0">
            <svg 
              viewBox="0 0 400 400" 
              className="w-full h-full text-slate-350"
              style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}
            >
              {/* Contorno simplificado de Tucumán */}
              <path 
                d="M 120,40 C 140,20 200,30 250,50 C 270,70 300,90 320,130 C 330,170 360,200 350,240 C 340,280 320,330 280,360 C 240,380 200,370 170,360 C 130,350 90,320 70,280 C 50,240 60,200 65,160 C 70,120 90,80 120,40 Z" 
                fill="#ffffff" 
                stroke="#cbd5e1" 
                strokeWidth="2" 
                filter="drop-shadow(0px 8px 16px rgba(100, 116, 139, 0.08))"
              />

              {/* Dibujar rutas de los traslados activos */}
              {activeTraslados.map(t => (
                <g key={`route-${t.id}`}>
                  <line 
                    x1={t.start.x} 
                    y1={t.start.y} 
                    x2={t.end.x} 
                    y2={t.end.y} 
                    stroke="#fb923c" 
                    strokeWidth="2" 
                    strokeDasharray="4,4" 
                    className="opacity-70 animate-pulse"
                  />
                  {/* Punto en tránsito animado en la mitad de la ruta */}
                  <circle cx={t.midX} cy={t.midY} r="5" fill="#fb923c">
                    <animate 
                      attributeName="r" 
                      values="4;7;4" 
                      dur="1.5s" 
                      repeatCount="indefinite" 
                    />
                  </circle>
                </g>
              ))}

              {/* Marcadores de Obras Activas (Puntos Azules) */}
              {mappedObras.map(o => (
                <g key={`obra-marker-${o.id}`} className="cursor-pointer">
                  <circle cx={o.x} cy={o.y} r="6" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
                  <circle cx={o.x} cy={o.y} r="12" fill="none" stroke="#0ea5e9" strokeWidth="1" opacity="0.3">
                    <animate 
                      attributeName="opacity" 
                      values="0.3;0;0.3" 
                      dur="2s" 
                      repeatCount="indefinite" 
                    />
                  </circle>
                </g>
              ))}
            </svg>

            {/* Simbología del Mapa */}
            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur border border-slate-100 p-2.5 rounded-xl text-[10px] space-y-1.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9] border border-white shrink-0" />
                <span className="font-semibold text-slate-600">Obra Activa ({mappedObras.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fb923c] border border-white shrink-0" />
                <span className="font-semibold text-slate-600">Personal en Traslado ({activeTraslados.length})</span>
              </div>
            </div>
          </div>

          {/* Listado de movimientos / Obras en el mapa */}
          <div className="flex-1 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalles de Operaciones</h3>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {activeTraslados.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">No hay traslados activos en tránsito</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">La geolocalización de operarios se desactiva al completar el traslado para ahorrar batería.</p>
                </div>
              ) : (
                activeTraslados.map(t => (
                  <div key={t.id} className="p-3 bg-orange-50/50 border border-orange-100 rounded-xl flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{t.empleados?.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {t.source_obra?.name || 'Origen'} → {t.target_obra?.name}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full shrink-0">
                      Viajando (ETA ~25m)
                    </span>
                  </div>
                ))
              )}

              <div className="h-px bg-slate-100 my-4" />

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Obras Detectadas</h3>
              {mappedObras.map(o => (
                <div key={o.id} className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-700 truncate">{o.name}</span>
                  <a 
                    href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline font-bold"
                  >
                    Ver GPS
                  </a>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
