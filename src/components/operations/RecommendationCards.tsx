import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, HardHat, Wrench, AlertTriangle, ChevronDown, ChevronUp, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OperationalSuggestion } from '../../services/operations/recommendationEngine';
import type { OperationalWorksite } from '../../types/operations';


interface RecommendationCardsProps {
  suggestions: OperationalSuggestion[];
  worksites: OperationalWorksite[];
  onFlyToWorksite: (worksite: OperationalWorksite) => void;
}

export default function RecommendationCards({
  suggestions,
  worksites,
  onFlyToWorksite,
}: RecommendationCardsProps) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400 font-medium">
        <Check className="h-6 w-6 mx-auto text-emerald-500 mb-1" />
        La distribución de personal y herramientas en obras se encuentra equilibrada.
      </div>
    );
  }

  return (
    <div className="space-y-2.5 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Sugerencias Operativas ({suggestions.length})
        </h4>
        <span className="text-[10px] text-slate-400 font-semibold">Reglas determinísticas</span>
      </div>

      <div className="space-y-2">
        {suggestions.map((sug) => {
          const isExpanded = expandedId === sug.id;
          const targetObra = worksites.find((w) => w.id === sug.targetWorksiteId);

          const badgeColor =
            sug.type === 'personal'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : sug.type === 'herramienta'
              ? 'bg-sky-50 text-sky-800 border-sky-200'
              : 'bg-rose-50 text-rose-800 border-rose-200';

          const icon =
            sug.type === 'personal' ? (
              <HardHat className="h-4 w-4 text-amber-600" />
            ) : sug.type === 'herramienta' ? (
              <Wrench className="h-4 w-4 text-sky-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            );

          return (
            <div
              key={sug.id}
              className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white shadow-sm space-y-2"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-slate-100 shrink-0 mt-0.5">{icon}</div>
                  <div className="min-w-0">
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                      {sug.type} • Prioridad {sug.priority}
                    </span>
                    <p className="font-extrabold text-xs text-slate-900 mt-1 leading-tight">{sug.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sug.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : sug.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg shrink-0"
                  title="Ver motivos técnicos"
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Motivos expandibles */}
              {isExpanded && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150 space-y-1 animate-in fade-in duration-200">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Criterios y Justificación:
                  </p>
                  {sug.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                      <span className="text-emerald-600 font-black">✓</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                {targetObra && (
                  <button
                    onClick={() => onFlyToWorksite(targetObra)}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Ver en mapa <ArrowRight size={12} />
                  </button>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {sug.actionType === 'asignar_personal' && (
                    <Button
                      size="sm"
                      onClick={() => navigate('/personal')}
                      className="h-7 px-2.5 text-[10px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                    >
                      Asignar Operario
                    </Button>
                  )}
                  {sug.actionType === 'trasladar_herramienta' && (
                    <Button
                      size="sm"
                      onClick={() => navigate('/solicitudes/nueva')}
                      className="h-7 px-2.5 text-[10px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                    >
                      Pedir Herramienta
                    </Button>
                  )}
                  {sug.actionType === 'revisar_obra' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/mis-obras', { state: { selectedObraId: sug.targetWorksiteId } })}
                      className="h-7 px-2.5 text-[10px] font-extrabold border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                      Inspeccionar Obra
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
