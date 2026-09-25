import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useActiveObras() {
  const [obras, setObras] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await Promise.race([
          Promise.resolve(supabase.from('obras').select('id, name').eq('active', true)
            .order('name').abortSignal(controller.signal)),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('La carga de obras demoró demasiado. Revisá tu conexión y volvé a intentar.'));
              controller.abort();
            }, 15000);
          }),
        ]);
        if (result.error) throw new Error('No se pudieron cargar las obras. Revisá tu conexión o tu sesión y volvé a intentar.');
        if (current) setObras(result.data || []);
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las obras. Volvé a intentar.');
      } finally {
        clearTimeout(timer!);
        if (current) setLoading(false);
      }
    }
    void load();
    return () => { current = false; clearTimeout(timer!); controller.abort(); };
  }, [attempt]);

  return { obras, loading, error, retry: () => setAttempt(value => value + 1) };
}
