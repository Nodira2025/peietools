import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Input } from './ui/input';
import { Button } from './ui/button';

export interface CoordinatorOption {
  id: string;
  full_name: string;
  username: string | null;
  role: string;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function CoordinatorPicker({ value, onChange }: {
  value: string;
  onChange: (name: string, id: string | null) => void;
}) {
  const [users, setUsers] = useState<CoordinatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let mounted = true;
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from('profiles')
          .select('id,full_name,username,role').eq('active', true)
          .in('role', ['admin', 'coordinador', 'encargado', 'solicitante'])
          .order('full_name').abortSignal(controller.signal);
        if (queryError) throw queryError;
        if (mounted) setUsers(data || []);
      } catch {
        if (mounted) setError(true);
      } finally {
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  const matches = users.filter(user => normalize(`${user.full_name || ''} ${user.username || ''}`).includes(normalize(value)));
  const choose = (user: CoordinatorOption) => {
    onChange(user.full_name || user.username || '', user.id);
    setOpen(false);
  };

  return <div className="space-y-2" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <Input id="manager" role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls="coordinator-options" aria-activedescendant={open && matches[highlight] ? `coordinator-${matches[highlight].id}` : undefined}
      autoComplete="off" placeholder="Buscar por nombre o usuario…" value={value}
      onFocus={() => { setOpen(true); setHighlight(0); }}
      onChange={event => { onChange(event.target.value, null); setOpen(true); setHighlight(0); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setHighlight(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) {
          event.preventDefault();
          if (!loading && !error && matches[highlight]) choose(matches[highlight]);
        }
      }} />
    {open && <div className="rounded-lg border bg-white p-1 max-h-48 overflow-y-auto">
      {loading ? <p role="status" className="p-3 text-sm">Cargando usuarios…</p> : error ? <div role="alert" className="p-2 text-sm">
        No se pudieron cargar los usuarios.
        <Button type="button" variant="outline" className="ml-2" onClick={() => { setLoading(true); setError(false); setAttempt(value => value + 1); }}>Reintentar</Button>
      </div> : <>
        <div id="coordinator-options" role="listbox" aria-label="Coordinadores y administradores">
          {matches.map((user, index) => <button key={user.id} id={`coordinator-${user.id}`} type="button" role="option"
            aria-selected={highlight === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(user)}
            className={`block w-full text-left rounded-md p-3 text-sm ${highlight === index ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
            <span className="block font-semibold">{user.full_name || user.username}</span>
            <span className="block text-xs text-slate-500">{user.username ? `@${user.username} · ` : ''}{user.role === 'admin' ? 'Administrador' : 'Coordinador'}</span>
          </button>)}
        </div>
        {!matches.length && <p role="status" className="p-3 text-sm">No hay usuarios activos que coincidan.</p>}
      </>}
    </div>}
    <p className="text-xs text-muted-foreground">Elegí un usuario de la lista. Borrá el campo para dejar la obra sin coordinador.</p>
  </div>;
}
