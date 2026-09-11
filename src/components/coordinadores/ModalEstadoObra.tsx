import React, { useEffect, useState } from 'react';
import type { ObraEstadoFinal, EstadoFinalObra } from '../../types/coordinadores';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

interface ModalEstadoObraProps {
  isOpen: boolean;
  onClose: () => void;
  obraId: string;
  obraNombre: string;
  estado: ObraEstadoFinal | null;
  onSave: (estado: ObraEstadoFinal) => Promise<void> | void;
  onDelete?: (obraId: string) => Promise<void> | void;
}

const ETAPAS: EstadoFinalObra[] = [
  'No iniciada',
  'En ejecución',
  'Pruebas y control',
  'Listo para entrega',
  'Finalizada'
];

function fechaPredeterminada(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 15);
  return fecha.toISOString().split('T')[0];
}

function autoEtapa(avance: number): EstadoFinalObra {
  if (avance >= 100) return 'Finalizada';
  if (avance >= 80) return 'Listo para entrega';
  if (avance >= 50) return 'Pruebas y control';
  if (avance > 0) return 'En ejecución';
  return 'No iniciada';
}

export default function ModalEstadoObra({
  isOpen,
  onClose,
  obraId,
  obraNombre,
  estado,
  onSave,
  onDelete
}: ModalEstadoObraProps) {
  const [etapaFinal, setEtapaFinal] = useState<EstadoFinalObra>('No iniciada');
  const [avanceFinal, setAvanceFinal] = useState<number>(0);
  const [etapasCompletadas, setEtapasCompletadas] = useState<number>(0);
  const [etapasTotales, setEtapasTotales] = useState<number>(8);
  const [fechaEstimadaCierre, setFechaEstimadaCierre] = useState<string>('');
  const [notas, setNotas] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (estado) {
      setEtapaFinal(estado.etapaFinal);
      setAvanceFinal(estado.avanceFinal);
      setEtapasCompletadas(estado.etapasCompletadas);
      setEtapasTotales(estado.etapasTotales);
      setFechaEstimadaCierre(estado.fechaEstimadaCierre || fechaPredeterminada());
      setNotas(estado.notas || '');
      return;
    }

    setEtapaFinal('No iniciada');
    setAvanceFinal(0);
    setEtapasCompletadas(0);
    setEtapasTotales(8);
    setFechaEstimadaCierre(fechaPredeterminada());
    setNotas(`Estado inicial manual para ${obraNombre}.`);
  }, [estado, obraNombre, isOpen]);

  const handleAvanceChange = (value: number) => {
    setAvanceFinal(value);
    setEtapaFinal(autoEtapa(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const etapaSafe = Math.max(0, etapasCompletadas);
    const totalSafe = Math.max(1, etapasTotales);
    const notasSafe = notas.trim() || null;
    const fechaSafe = fechaEstimadaCierre || null;

    const payload: ObraEstadoFinal = {
      obraId,
      obraName: obraNombre,
      etapaFinal,
      avanceFinal: Math.round(Math.max(0, Math.min(100, avanceFinal))),
      etapasCompletadas: Math.min(etapaSafe, totalSafe),
      etapasTotales: totalSafe,
      fechaEstimadaCierre: fechaSafe,
      notas: notasSafe,
      actualizadoEn: new Date().toISOString(),
      esMuestra: false
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const confirmMessage = `¿Querés eliminar el estado de obra registrado para "${obraNombre}"?`;
    if (!window.confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      await onDelete(obraId);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full rounded-2xl p-6 bg-white border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {estado ? 'Editar estado final de obra' : 'Nuevo estado final de obra'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Cargá los datos que alimentan el anillo de avance final para {obraNombre}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">Etapa final de obra</Label>
            <Select value={etapaFinal} onValueChange={(value) => setEtapaFinal(value as EstadoFinalObra)}>
              <SelectTrigger className="rounded-xl border-slate-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS.map((etapa) => (
                  <SelectItem key={etapa} value={etapa}>
                    {etapa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Avance final de obra (%)</span>
              <span className="text-blue-600 font-black text-sm">{avanceFinal}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={avanceFinal}
              onChange={(e) => handleAvanceChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Etapas completadas</Label>
              <Input
                type="number"
                min="0"
                max={etapasTotales}
                value={etapasCompletadas}
                onChange={(e) => setEtapasCompletadas(Number(e.target.value))}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Etapas totales</Label>
              <Input
                type="number"
                min="1"
                value={etapasTotales}
                onChange={(e) => setEtapasTotales(Math.max(1, Number(e.target.value)))}
                className="rounded-xl border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Fecha estimada de cierre</Label>
            <Input
              type="date"
              value={fechaEstimadaCierre}
              onChange={(e) => setFechaEstimadaCierre(e.target.value)}
              className="rounded-xl border-slate-200 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Notas para el seguimiento</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones o hito técnico de referencia..."
              rows={3}
              className="rounded-xl border-slate-200 text-xs resize-none"
            />
          </div>

          <DialogFooter className="flex flex-row items-center justify-between pt-3 border-t border-slate-100 gap-2">
            {estado && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs px-2.5"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {deleting ? 'Eliminando...' : 'Eliminar'}
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
                {saving ? 'Guardando...' : 'Guardar estado'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

