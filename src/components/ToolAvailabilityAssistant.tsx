import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CalendarClock, CheckCircle2, MapPin, Phone, RefreshCw, Sparkles, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';


interface DestinationObra {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface ToolAvailabilityAssistantProps {
  requestId: string;
  requestedToolName: string;
  neededDate?: string | null;
  targetObra: DestinationObra | null;
  currentToolId?: string | null;
  canAssign: boolean;
  onAssign: (toolId: string) => Promise<void> | void;
}

interface ToolRow {
  id: string;
  name: string;
  code: string;
  status: string;
  current_obra_id: string | null;
  last_latitude?: number | null;
  last_longitude?: number | null;
  obras?: {
    name: string;
    latitude?: number | null;
    longitude?: number | null;
    encargado_name?: string | null;
  } | null;
}

interface Candidate extends ToolRow {
  available: boolean;
  distanceKm: number | null;
  unavailableReason: string | null;
  nextAvailableAt: string | null;
  managerName: string | null;
  managerPhone: string | null;
  matchScore: number;
}

const ACTIVE_REQUEST_STATUSES = ['Pendiente', 'En atención', 'Asignada', 'En retiro', 'En traslado', 'Entregada'];
const AVAILABLE_TOOL_STATUSES = ['Disponible', 'En uso'];

const normalize = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radius = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDate = (value: string) => new Date(value).toLocaleString('es-AR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function ToolAvailabilityAssistant({
  requestId,
  requestedToolName,
  neededDate,
  targetObra,
  currentToolId,
  canAssign,
  onAssign,
}: ToolAvailabilityAssistantProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [assigningId, setAssigningId] = useState('');


  const requestedStart = useMemo(() => {
    const parsed = neededDate ? new Date(neededDate) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [neededDate]);

  const loadCandidates = async () => {
    setLoading(true);
    setLoadError('');

    const [toolsResult, requestsResult, reservationsResult, profilesResult] = await Promise.all([
      supabase
        .from('herramientas')
        .select('id, name, code, status, current_obra_id, last_latitude, last_longitude, obras!herramientas_current_obra_id_fkey(name, latitude, longitude, encargado_name)')
        .order('name'),
      supabase
        .from('solicitudes')
        .select('id, herramienta_id, status')
        .neq('id', requestId)
        .in('status', ACTIVE_REQUEST_STATUSES)
        .not('herramienta_id', 'is', null),
      supabase
        .from('reservas_herramientas')
        .select('herramienta_id, fecha_inicio, fecha_fin, estado')
        .in('estado', ['pendiente', 'confirmada', 'en_curso']),
      supabase
        .from('profiles')
        .select('full_name, whatsapp')
        .eq('active', true),
    ]);

    if (toolsResult.error || requestsResult.error) {
      console.error('No se pudo calcular la disponibilidad', toolsResult.error || requestsResult.error);
      setLoadError('No se pudo consultar el inventario en este momento.');
      setCandidates([]);
      setLoading(false);
      return;
    }

    if (reservationsResult.error) {
      console.warn('No se pudieron consultar las reservas', reservationsResult.error);
    }

    const query = normalize(requestedToolName);
    const queryTokens = query.split(/\s+/).filter(token => token.length >= 3);
    const activeToolIds = new Set((requestsResult.data || []).map(row => row.herramienta_id));
    const reservations = reservationsResult.data || [];
    const profiles = profilesResult.data || [];
    const requestedEnd = new Date(requestedStart.getTime() + 8 * 60 * 60 * 1000);

    const rows = ((toolsResult.data || []) as unknown as ToolRow[])
      .map(tool => {
        const normalizedTool = normalize(`${tool.name} ${tool.code}`);
        const matchScore = normalizedTool.includes(query)
          ? 100
          : queryTokens.reduce((score, token) => score + (normalizedTool.includes(token) ? 10 : 0), 0);
        return { tool, matchScore };
      })
      .filter(({ matchScore }) => matchScore > 0)
      .map(({ tool, matchScore }) => {
        const overlappingReservations = reservations.filter(reservation => {
          if (reservation.herramienta_id !== tool.id) return false;
          const start = new Date(reservation.fecha_inicio).getTime();
          const end = new Date(reservation.fecha_fin).getTime();
          return Math.max(requestedStart.getTime(), start) < Math.min(requestedEnd.getTime(), end);
        });

        const isCurrentTool = currentToolId === tool.id;
        const hasActiveRequest = activeToolIds.has(tool.id);
        const statusAllowsAssignment = AVAILABLE_TOOL_STATUSES.includes(tool.status);
        const available = isCurrentTool || (statusAllowsAssignment && !hasActiveRequest && overlappingReservations.length === 0);

        let unavailableReason: string | null = null;
        if (isCurrentTool) unavailableReason = null;
        else if (hasActiveRequest) unavailableReason = 'Tiene otro pedido activo';
        else if (overlappingReservations.length > 0) unavailableReason = 'Reservada para esa fecha';
        else if (!statusAllowsAssignment) unavailableReason = `Estado actual: ${tool.status}`;

        const nextAvailableAt = overlappingReservations.length > 0 && !hasActiveRequest
          ? overlappingReservations
              .map(reservation => reservation.fecha_fin)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
          : null;

        const originLat = tool.obras?.latitude ?? tool.last_latitude;
        const originLon = tool.obras?.longitude ?? tool.last_longitude;
        const destinationLat = targetObra?.latitude;
        const destinationLon = targetObra?.longitude;
        const hasCoordinates = [originLat, originLon, destinationLat, destinationLon]
          .every(value => typeof value === 'number' && Number.isFinite(value));
        const distanceKm = hasCoordinates
          ? distanceInKm(originLat as number, originLon as number, destinationLat as number, destinationLon as number)
          : null;

        const managerName = tool.obras?.encargado_name || null;
        const manager = managerName
          ? profiles.find(profile => normalize(profile.full_name || '') === normalize(managerName))
          : null;

        return {
          ...tool,
          available,
          distanceKm,
          unavailableReason,
          nextAvailableAt,
          managerName,
          managerPhone: manager?.whatsapp || null,
          matchScore,
        } satisfies Candidate;
      })
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
        if (a.distanceKm === null && b.distanceKm !== null) return 1;
        if (a.distanceKm !== null && b.distanceKm === null) return -1;
        return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
      });

    setCandidates(rows.slice(0, 10));
    setLoading(false);
  };

  useEffect(() => {
    loadCandidates();
  }, [requestId, requestedToolName, neededDate, targetObra?.id, currentToolId]);

  const assignCandidate = async (candidate: Candidate) => {
    setAssigningId(candidate.id);
    await onAssign(candidate.id);
    setAssigningId('');
    await loadCandidates();
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-indigo-950">Asistente de disponibilidad</h3>
            <p className="text-xs text-indigo-700 mt-0.5">
              Opciones para “{requestedToolName}”, priorizadas por disponibilidad y cercanía al destino.
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={loadCandidates} disabled={loading} className="h-8 w-8 p-0 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {!targetObra?.latitude || !targetObra?.longitude ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <MapPin className="w-4 h-4 shrink-0" />
          La obra destino no tiene coordenadas GPS. Se muestra disponibilidad, pero no distancia.
        </div>
      ) : null}

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-500">Buscando herramientas compatibles…</div>
      ) : loadError ? (
        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {loadError}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
          <Wrench className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No hay coincidencias en el catálogo</p>
          <p className="text-xs text-slate-500 mt-1">Revisá el nombre pedido o coordiná una compra/alquiler.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate, index) => {
            const isCurrent = currentToolId === candidate.id;
            return (
              <div key={candidate.id} className={`rounded-xl border bg-white p-3 ${isCurrent ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {index === 0 && candidate.available ? (
                        <span className="text-[9px] font-black uppercase tracking-wider rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5">Mejor opción</span>
                      ) : null}
                      {isCurrent ? (
                        <span className="text-[9px] font-black uppercase tracking-wider rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">Asignada</span>
                      ) : null}
                    </div>
                    <p className="font-black text-sm text-slate-800 mt-1">{candidate.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{candidate.code}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${candidate.available ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {candidate.available ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {candidate.available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3 text-[11px] text-slate-600">
                  <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {candidate.obras?.name || 'Depósito / ubicación sin asignar'}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {candidate.distanceKm === null ? 'Distancia sin GPS' : `${candidate.distanceKm.toFixed(1)} km del destino`}</p>
                  {candidate.managerName ? (
                    <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> {candidate.managerName}{candidate.managerPhone ? ` · ${candidate.managerPhone}` : ' · sin teléfono cargado'}</p>
                  ) : null}
                  {!candidate.available ? (
                    <p className="flex items-center gap-1.5 text-rose-700"><CalendarClock className="w-3.5 h-3.5" /> {candidate.nextAvailableAt ? `Próxima estimada: ${formatDate(candidate.nextAvailableAt)}` : candidate.unavailableReason}</p>
                  ) : null}
                </div>

                {canAssign && candidate.available && !isCurrent ? (
                  <Button
                    type="button"
                    onClick={() => assignCandidate(candidate)}
                    disabled={Boolean(assigningId)}
                    className="w-full mt-3 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black"
                  >
                    {assigningId === candidate.id ? 'Asignando…' : 'Asignar esta herramienta'}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

