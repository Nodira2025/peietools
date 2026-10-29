import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, HardHat, Search, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Entry = { id: string; name: string; code?: string; specialty?: string; obra: string };
type Movement = { id: string; date: string; status: string; source: string; target: string };
const obraName = (value: any): string => (Array.isArray(value) ? value[0]?.name : value?.name) || 'Sin obra registrada';

export default function DadosDeBaja() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('tipo') === 'herramientas' ? 'herramientas' : 'personal';
  const { profile } = useAuthStore();
  const canReadLegajo = profile?.role === 'admin' || profile?.role === 'logistica';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(''); setEntries([]);
      try {
        const rows: Entry[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = kind === 'personal'
            ? await supabase.from('empleados').select('id, full_name, specialty, obras:obra_id(name)').eq('active', false).order('full_name').order('id').range(offset, offset + 499)
            : await supabase.from('herramientas').select('id, name, code, obras:current_obra_id(name)').eq('status', 'Fuera de servicio').order('name').order('id').range(offset, offset + 499);
          if (result.error) throw result.error;
          if (cancelled) return;
          const data = result.data || [];
          rows.push(...data.map((row: any) => ({ id: row.id, name: row.full_name || row.name, code: row.code, specialty: row.specialty, obra: obraName(row.obras) })));
          if (data.length < 500) break;
        }
        if (!cancelled) setEntries(rows);
      } catch { if (!cancelled) setError('No se pudieron cargar los dados de baja. Intentá nuevamente.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [kind, retry]);

  useEffect(() => {
    let cancelled = false;
    if (!selected) return;
    async function loadHistory() {
      setHistoryLoading(true); setHistoryError(''); setMovements([]);
      try {
        const rows: Movement[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('traslados_personal')
            .select('id, created_at, status, source:obras!traslados_personal_source_obra_id_fkey(name), target:obras!traslados_personal_target_obra_id_fkey(name)')
            .eq('empleado_id', selected!.id).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
          if (error) throw error;
          if (cancelled) return;
          rows.push(...(data || []).map(row => ({ id: row.id, date: row.created_at, status: row.status, source: obraName(row.source), target: obraName(row.target) })));
          if ((data?.length || 0) < 500) break;
        }
        if (!cancelled) setMovements(rows);
      } catch { if (!cancelled) setHistoryError('No se pudo cargar el historial de traslados.'); }
      finally { if (!cancelled) setHistoryLoading(false); }
    }
    void loadHistory();
    return () => { cancelled = true; };
  }, [selected]);

  const filtered = entries.filter(row => `${row.name} ${row.code || ''} ${row.specialty || ''} ${row.obra}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  return <div className="max-w-5xl mx-auto space-y-5 pb-safe">
    <header>
      <h1 className="text-2xl font-bold text-peie-blue flex items-center gap-2"><Archive className="h-6 w-6" />Dados de baja</h1>
      <p className="text-sm text-slate-500 mt-2">Personal inactivo y herramientas fuera de servicio. Sus fichas e historiales se conservan.</p>
    </header>
    <div className="flex flex-wrap gap-2">
      <Button variant={kind === 'personal' ? 'default' : 'outline'} onClick={() => { setParams({ tipo: 'personal' }); setSearch(''); }}><HardHat className="h-4 w-4 mr-2" />Personal</Button>
      <Button variant={kind === 'herramientas' ? 'default' : 'outline'} onClick={() => { setParams({ tipo: 'herramientas' }); setSearch(''); }}><Wrench className="h-4 w-4 mr-2" />Herramientas</Button>
      <Button asChild variant="ghost"><Link to={kind === 'personal' ? '/personal' : '/herramientas'}>Volver a activos</Link></Button>
    </div>
    <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" aria-label="Buscar dados de baja" placeholder="Buscar por nombre, código u obra…" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {loading ? <p role="status">Cargando dados de baja…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}<Button variant="outline" className="ml-2" onClick={() => setRetry(value => value + 1)}>Reintentar</Button></div> : <>
      <p className="text-sm text-slate-500">{filtered.length} registros</p>
      {!filtered.length && <p className="p-6 bg-white rounded-xl border text-slate-500">No se encontraron registros dados de baja.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{filtered.map(row => <article key={row.id} className="rounded-xl border bg-white p-4 min-w-0">
        <span className="text-xs font-semibold text-rose-700 bg-rose-50 rounded-full px-2 py-1">{kind === 'personal' ? 'Dado de baja' : 'Fuera de servicio'}</span>
        <h2 className="font-bold text-slate-800 mt-3 break-words">{row.name}</h2>
        <p className="text-sm text-slate-500">{row.code || row.specialty || 'Operario'}</p>
        <p className="text-xs text-slate-500 mt-1 break-words">Última obra registrada: {row.obra}</p>
        {kind === 'herramientas' ? <Button asChild variant="outline" className="mt-3"><Link to={`/herramientas/${row.id}`}>Ver ficha e historial</Link></Button> : <Button variant="outline" className="mt-3" onClick={() => setSelected(row)}>Ver ficha e historial</Button>}
      </article>)}</div>
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>Operario dado de baja. Se conservan sus datos y antecedentes.</DialogDescription></DialogHeader>
      <p className="text-sm">{selected?.specialty || 'Operario'} · {selected?.obra}</p>
      {canReadLegajo && selected && <Button asChild variant="outline"><Link to={`/personal-datos?empleado=${selected.id}`}>Consultar legajo</Link></Button>}
      <h3 className="font-semibold">Historial de traslados</h3>
      {historyLoading ? <p>Cargando historial…</p> : historyError ? <p role="alert" className="text-red-600">{historyError}</p> : movements.length ? <ul className="space-y-3">{movements.map(move => <li key={move.id} className="border rounded-lg p-3 text-sm"><p>{move.source} → {move.target}</p><p className="text-xs text-slate-500 mt-1">{move.date ? new Date(move.date).toLocaleDateString('es-AR') : 'Fecha no registrada'} · {move.status}</p></li>)}</ul> : <p className="text-sm text-slate-500">Sin traslados registrados.</p>}
    </DialogContent></Dialog>
  </div>;
}
