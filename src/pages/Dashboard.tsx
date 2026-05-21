import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '../store/auth';
import { Wrench, MapPin, QrCode, Home, Users, ClipboardList, BarChart3, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const isEncargado = profile?.role === 'encargado' || profile?.role === 'solicitante';
  const isAdmin = profile?.role === 'admin';
  const isLogistica = profile?.role === 'logistica';

  // =========================================================================
  // BOTONERA PRINCIPAL DE ACCESOS RÁPIDOS (PARA TODOS LOS USUARIOS)
  // =========================================================================
  const MainMenu = () => (
    <div className="space-y-6">
      {/* Etiqueta Menú Principal */}
      <div className="flex items-center justify-center gap-2 text-[10px] font-black text-blue-600/80 uppercase tracking-widest my-3">
        <span className="w-1 h-1 rounded-full bg-blue-500" />
        Menú Principal
        <span className="w-1 h-1 rounded-full bg-blue-500" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Pedidos */}
        <Card 
          onClick={() => navigate('/solicitudes')} 
          className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
        >
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-[20px] transition-transform group-hover:scale-105">
            <Home size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
            Pedidos
          </span>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
            <ChevronRight size={16} className="stroke-[3]" />
          </div>
        </Card>

        {/* Herramientas */}
        <Card 
          onClick={() => navigate('/herramientas')} 
          className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
        >
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-[20px] transition-transform group-hover:scale-105">
            <Wrench size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
            Herramientas
          </span>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
            <ChevronRight size={16} className="stroke-[3]" />
          </div>
        </Card>

        {/* Mis Obras */}
        <Card 
          onClick={() => navigate('/mis-obras')} 
          className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
        >
          <div className="p-3.5 bg-sky-50 text-sky-600 rounded-[20px] transition-transform group-hover:scale-105">
            <MapPin size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
            Mis Obras
          </span>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
            <ChevronRight size={16} className="stroke-[3]" />
          </div>
        </Card>

        {/* Personal */}
        <Card 
          onClick={() => navigate('/personal')} 
          className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
        >
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-[20px] transition-transform group-hover:scale-105">
            <Users size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
            Personal
          </span>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
            <ChevronRight size={16} className="stroke-[3]" />
          </div>
        </Card>

        {/* Órdenes */}
        <Card 
          onClick={() => navigate('/ordenes')} 
          className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
        >
          <div className="p-3.5 bg-purple-50 text-purple-600 rounded-[20px] transition-transform group-hover:scale-105">
            <ClipboardList size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
            Órdenes
          </span>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
            <ChevronRight size={16} className="stroke-[3]" />
          </div>
        </Card>

        {/* Reportes (Solo Admin/Logistica) */}
        {(isAdmin || isLogistica) && (
          <Card 
            onClick={() => navigate('/reportes')} 
            className="border-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:ring-1 hover:ring-peie-blue/5 transition-all cursor-pointer bg-white active:scale-95 rounded-[24px] p-5 flex flex-col items-center justify-between h-40 group relative overflow-hidden"
          >
            <div className="p-3.5 bg-violet-50 text-violet-600 rounded-[20px] transition-transform group-hover:scale-105">
              <BarChart3 size={22} className="stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider text-center mt-2">
              Reportes
            </span>
            <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform mt-1">
              <ChevronRight size={16} className="stroke-[3]" />
            </div>
          </Card>
        )}

        {/* Escanear QR (Ancho completo) */}
        <Card 
          onClick={() => navigate('/herramientas/scanner')} 
          className="col-span-2 sm:col-span-3 border-2 border-dashed border-blue-200 bg-blue-50/10 hover:border-blue-300 hover:bg-blue-50/20 shadow-none transition-all cursor-pointer active:scale-98 rounded-[24px] p-5 flex items-center justify-between group h-20"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-500 rounded-[18px]">
              <QrCode size={22} className="stroke-[2.5]" />
            </div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Escanear QR
            </span>
          </div>
          <div className="text-blue-500 group-hover:translate-x-0.5 transition-transform">
            <ChevronRight size={18} className="stroke-[3]" />
          </div>
        </Card>
      </div>
    </div>
  );

  // =========================================================================
  // VISTA CLÁSICA DE ESTADÍSTICAS PARA ADMINISTRADORES Y LOGÍSTICA
  // =========================================================================
  return (
    <div className="space-y-6 pb-safe max-w-md mx-auto">
      <div className="flex flex-col items-center justify-center text-center py-4">
        <h1 className="text-2xl font-black text-[#031530] tracking-tight relative flex items-center justify-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse" />
          Dashboard General
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse" />
        </h1>
        <p className="text-slate-400 text-xs font-bold mt-1.5">
          Accesos rápidos y gestión operativa
        </p>
      </div>

      <MainMenu />

      {isEncargado && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
          <p className="text-xs text-slate-500">¿Necesitas ayuda con un equipo?</p>
          <button 
            onClick={() => navigate('/herramientas')}
            className="mt-2 text-xs font-bold text-peie-blue underline decoration-peie-light underline-offset-2"
          >
            Consultar inventario general
          </button>
        </div>
      )}
    </div>
  );
}
