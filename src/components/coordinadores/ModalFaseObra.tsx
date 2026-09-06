import React, { useState, useEffect } from 'react';
import type { ObraFase, FaseStatus } from '../../types/coordinadores';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Trash2, CheckCircle2, Clock } from 'lucide-react';

interface ModalFaseObraProps {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
  fase: ObraFase | null;
  onSave: (fase: ObraFase) => Promise<void>;
  onDelete?: (faseId: string) => Promise<void>;
  defaultOrderIndex?: number;
}

const COMMON_ELECTRICAL_PHASES = [
  'Replanteo, Puntos de Iluminación y Canalizaciones',
  'Tendido de Cañerías, Cajas y Bandejas Portacables',
  'Cableado de Potencia, Tomas y Comandos',
  'Montaje de Tableros Principales y Seccionales',
  'Conexión de Artefactos, Iluminación y Pruebas',
  'Pruebas de Aislación, Jabalinas y Certificación',
  'Puesta en Marcha y Entrega Final'
];

export default function ModalFaseObra({
  isOpen,
  onClose,
  obraId,
  fase,
  onSave,
  onDelete,
  defaultOrderIndex = 1
}: ModalFaseObraProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<FaseStatus>('Pendiente');
  const [responsableName, setResponsableName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (fase) {
      setName(fase.name);
      setStartDate(fase.start_date);
      setEndDate(fase.end_date);
      setProgress(fase.progress);
      setStatus(fase.status);
      setResponsableName(fase.responsable_name || '');
      setNotes(fase.notes || '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setName('');
      setStartDate(today);
      setEndDate(future);
      setProgress(0);
      setStatus('Pendiente');
      setResponsableName('');
      setNotes('');
    }
  }, [fase, isOpen]);

  // Handle auto status adjustment when progress changes
  const handleProgressChange = (val: number) => {
    setProgress(val);
    if (val === 100) {
      setStatus('Completada');
    } else if (val > 0 && status === 'Pendiente') {
      setStatus('En Curso');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    setSaving(true);
    try {
      const payload: ObraFase = {
        id: fase?.id || `${obraId}-${Date.now()}`,
        obra_id: obraId,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        progress: Number(progress),
        status,
        responsable_name: responsableName.trim() || null,
        order_index: fase?.order_index ?? defaultOrderIndex,
        notes: notes.trim() || null
      };

      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!fase || !onDelete) return;
    if (!confirm('¿Estás seguro de que querés eliminar esta fase del cronograma?')) return;
    setDeleting(true);
    try {
      await onDelete(fase.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full rounded-2xl p-6 bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {fase ? 'Editar Fase de Obra' : 'Nueva Fase del Cronograma'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Definí las etapas técnicas, fechas de ejecución y porcentaje de avance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nombre de la Fase */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Nombre de la Fase / Etapa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cableado de tableros seccionales"
              required
              className="rounded-xl border-slate-200"
            />
            {/* Quick Suggestions Chips */}
            {!fase && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_ELECTRICAL_PHASES.slice(0, 3).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setName(item)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full transition-colors truncate max-w-[200px]"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fechas de Inicio y Fin */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Fecha Inicio</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Fecha Fin Prevista</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Porcentaje de Avance */}
          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
              <span>Porcentaje de Avance Real</span>
              <span className="text-blue-600 font-black text-sm">{progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0% (Sin inicio)</span>
              <span>50% (A mitad)</span>
              <span>100% (Finalizada)</span>
            </div>
          </div>

          {/* Estado de la Fase */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Estado</Label>
              <Select value={status} onValueChange={(val: FaseStatus) => setStatus(val)}>
                <SelectTrigger className="rounded-xl border-slate-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="En Curso">En Curso</SelectItem>
                  <SelectItem value="Completada">Completada</SelectItem>
                  <SelectItem value="Retrasada">Retrasada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Responsable / Encargado</Label>
              <Input
                value={responsableName}
                onChange={(e) => setResponsableName(e.target.value)}
                placeholder="Ej: Martin Grande"
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Observaciones Técnicas (Opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre materiales, inspecciones o avances..."
              rows={2}
              className="rounded-xl border-slate-200 text-xs resize-none"
            />
          </div>

          <DialogFooter className="flex flex-row items-center justify-between pt-3 border-t border-slate-100 gap-2">
            {fase && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs px-2.5"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                {saving ? 'Guardando...' : 'Guardar Fase'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
