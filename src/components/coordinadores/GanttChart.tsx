import React, { useMemo } from 'react';
import type { ObraFase } from '../../types/coordinadores';
import { coordinadoresService } from '../../services/coordinadores/coordinadoresService';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Edit2, 
  TrendingUp,
  User,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GanttChartProps {
  obraName: string;
  fases: ObraFase[];
  onEditFase: (fase: ObraFase) => void;
  onAddFase: () => void;
}

export default function GanttChart({
  obraName,
  fases,
  onEditFase,
  onAddFase,
}: GanttChartProps) {
  const metrics = useMemo(() => coordinadoresService.calculateMetrics(fases), [fases]);

  // Determine global timeline span (min date to max date + padding)
  const timelineConfig = useMemo(() => {
    if (fases.length === 0) {
      const now = new Date();
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 2, 0),
        totalDays: 60,
      };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    fases.forEach(f => {
      const s = new Date(f.start_date).getTime();
      const e = new Date(f.end_date).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(e) && e > maxTime) maxTime = e;
    });

    // Add 5 days buffer on each side
    const startDate = new Date(minTime - 5 * 24 * 60 * 60 * 1000);
    const endDate = new Date(maxTime + 10 * 24 * 60 * 60 * 1000);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    return { startDate, endDate, totalDays };
  }, [fases]);

  // Today position percentage
  const todayPercent = useMemo(() => {
    const today = new Date().getTime();
    const start = timelineConfig.startDate.getTime();
    const total = timelineConfig.endDate.getTime() - start;
    if (total <= 0) return 0;
    const diff = today - start;
    return Math.max(0, Math.min(100, (diff / total) * 100));
  }, [timelineConfig]);

  // Generate monthly marks along the timeline
  const monthMarks = useMemo(() => {
    const marks: { name: string; percent: number }[] = [];
    const cur = new Date(timelineConfig.startDate);
    cur.setDate(1);

    const end = timelineConfig.endDate;
    const totalSpan = end.getTime() - timelineConfig.startDate.getTime();

    while (cur <= end) {
      const time = cur.getTime();
      if (time >= timelineConfig.startDate.getTime()) {
        const percent = ((time - timelineConfig.startDate.getTime()) / totalSpan) * 100;
        const monthName = cur.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
        marks.push({ name: monthName.toUpperCase(), percent });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return marks;
  }, [timelineConfig]);

  const getStatusBadge = (status: ObraFase['status']) => {
    switch (status) {
      case 'Completada':
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">Completada</Badge>;
      case 'En Curso':
        return <Badge className="bg-blue-500/15 text-blue-700 border-blue-300">En Curso</Badge>;
      case 'Retrasada':
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300">Retrasada</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600 border-slate-300">Pendiente</Badge>;
    }
  };

  const getStatusColor = (status: ObraFase['status'], progress: number) => {
    if (status === 'Completada' || progress === 100) return 'bg-emerald-500';
    if (status === 'Retrasada') return 'bg-amber-500';
    if (status === 'En Curso') return 'bg-blue-600';
    return 'bg-slate-400';
  };

  const formatDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Avance Global */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Avance Total</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{metrics.overallProgress}%</span>
            <span className="text-xs text-slate-500 font-medium">ponderado</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
              style={{ width: `${metrics.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Fases */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Fases de Obra</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{metrics.completedCount}</span>
            <span className="text-slate-400 text-sm">/ {fases.length} concluidas</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.inProgressCount} en curso, {fases.length - metrics.completedCount - metrics.inProgressCount} pendientes
          </p>
        </div>

        {/* Días Restantes */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Plazo Estimado</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{metrics.daysRemaining}</span>
            <span className="text-xs text-slate-500">días restantes</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 truncate">
            Fin: {metrics.endDate ? formatDate(metrics.endDate) : 'Sin fecha'}
          </p>
        </div>

        {/* Alertas / Estado */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Estado Cronograma</span>
            {metrics.delayedCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div>
            {metrics.delayedCount > 0 ? (
              <div className="text-amber-700 font-bold text-lg flex items-center gap-1.5">
                <span>{metrics.delayedCount} en desvío</span>
              </div>
            ) : (
              <div className="text-emerald-700 font-bold text-lg flex items-center gap-1.5">
                <span>En cronograma</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.delayedCount > 0 ? 'Fases con retraso sobre fecha' : 'Sin desvíos críticos'}
          </p>
        </div>
      </div>

      {/* Gantt Canvas Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Cronograma de Fases: {obraName}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualización temporal en línea de tiempo (Gantt) con control de avance.
            </p>
          </div>

          <Button 
            onClick={onAddFase}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Nueva Fase
          </Button>
        </div>

        {/* Gantt Table & Timeline Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Timeline Header (Months & Today Marker) */}
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100/70 text-xs font-bold text-slate-600">
              <div className="col-span-5 p-3 border-r border-slate-200 flex items-center justify-between">
                <span>FASE / PLAN TÉCNICO</span>
                <span className="text-[11px] font-normal text-slate-400">INICIO - FIN</span>
              </div>
              <div className="col-span-7 relative h-10 flex items-center">
                {/* Month labels */}
                {monthMarks.map((m, idx) => (
                  <div
                    key={idx}
                    className="absolute text-[10px] font-black text-slate-500 uppercase border-l border-slate-300 pl-1.5 h-full flex items-center"
                    style={{ left: `${m.percent}%` }}
                  >
                    {m.name}
                  </div>
                ))}
                {/* Today Indicator Pill */}
                <div
                  className="absolute top-0 bottom-0 z-10 flex flex-col items-center pointer-events-none"
                  style={{ left: `${todayPercent}%` }}
                >
                  <span className="bg-red-500 text-white text-[9px] font-black px-1 py-0.5 rounded shadow-sm -mt-1">
                    HOY
                  </span>
                  <div className="w-0.5 flex-1 bg-red-500/70" />
                </div>
              </div>
            </div>

            {/* Rows for each phase */}
            {fases.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-600">No hay fases cargadas para esta obra.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Hacé clic en &quot;Nueva Fase&quot; para definir las etapas del plan eléctrico.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {fases.map((fase) => {
                  const sTime = new Date(fase.start_date).getTime();
                  const eTime = new Date(fase.end_date).getTime();
                  const startTimeline = timelineConfig.startDate.getTime();
                  const endTimeline = timelineConfig.endDate.getTime();
                  const totalSpan = endTimeline - startTimeline;

                  const barLeft = Math.max(0, Math.min(100, ((sTime - startTimeline) / totalSpan) * 100));
                  const barRight = Math.max(0, Math.min(100, ((eTime - startTimeline) / totalSpan) * 100));
                  const barWidth = Math.max(3, barRight - barLeft);

                  return (
                    <div 
                      key={fase.id} 
                      className="grid grid-cols-12 hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onEditFase(fase)}
                    >
                      {/* Left Pane: Phase Details */}
                      <div className="col-span-5 p-3 sm:p-4 border-r border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                              {fase.order_index}
                            </span>
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                              {fase.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditFase(fase);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                          <span>{formatDate(fase.start_date)} - {formatDate(fase.end_date)}</span>
                          {getStatusBadge(fase.status)}
                          {fase.responsable_name && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 truncate">
                              <User className="w-3 h-3" />
                              {fase.responsable_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Pane: Gantt Bar */}
                      <div className="col-span-7 relative flex items-center px-2 py-3">
                        {/* Background timeline grid lines */}
                        {monthMarks.map((m, idx) => (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0 border-l border-slate-100 pointer-events-none"
                            style={{ left: `${m.percent}%` }}
                          />
                        ))}

                        {/* Today vertical line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-400/30 z-0 pointer-events-none"
                          style={{ left: `${todayPercent}%` }}
                        />

                        {/* Interactive Gantt Bar */}
                        <div
                          className="relative h-7 rounded-xl bg-slate-100 border border-slate-200/80 shadow-sm overflow-hidden flex items-center transition-all duration-200 group-hover:shadow group-hover:scale-[1.01]"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                          }}
                        >
                          {/* Progress fill bar */}
                          <div
                            className={`h-full ${getStatusColor(fase.status, fase.progress)} opacity-90 transition-all duration-300 rounded-l-xl`}
                            style={{ width: `${fase.progress}%` }}
                          />

                          {/* Progress Label inside Bar */}
                          <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] sm:text-xs font-bold pointer-events-none">
                            <span className="text-slate-800 drop-shadow-sm truncate">
                              {fase.progress > 0 ? `${fase.progress}%` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Legend Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200/70 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700">Referencias:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Completada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600" />
              <span>En Curso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Retrasada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-400" />
              <span>Pendiente</span>
            </div>
          </div>

          <span className="text-[11px] text-slate-400">
            Hacé clic en cualquier fase para ajustar fechas y porcentaje de avance.
          </span>
        </div>
      </div>
    </div>
  );
}
