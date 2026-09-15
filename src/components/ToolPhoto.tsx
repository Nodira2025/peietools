import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Las fotos históricas están guardadas como base64. Pedirlas sólo cuando
// la tarjeta se acerca a la pantalla evita descargarlas con todo el inventario.
export default function ToolPhoto({ id, name, className, fallback, candidateIds }: {
  id: string;
  candidateIds?: string[];
  name: string;
  className?: string;
  fallback: ReactNode;
}) {
  const candidateKey = candidateIds?.join(',');
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '100px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setPhoto(null);
    async function loadPhoto() {
      try {
        let query = supabase.from('herramientas').select('photo_url');
        query = candidateKey
          ? query.in('id', candidateKey.split(',')).not('photo_url', 'is', null).neq('photo_url', '').order('id').limit(1)
          : query.eq('id', id);
        const { data, error } = await query.abortSignal(controller.signal).maybeSingle();
        if (!controller.signal.aborted && !error) setPhoto(data?.photo_url || null);
      } catch {
        // El listado sigue disponible aunque una foto no pueda descargarse.
      }
    }
    void loadPhoto();
    return () => controller.abort();
  }, [id, visible, candidateKey]);

  return <div ref={container} className="w-full h-full flex items-center justify-center text-slate-300">
    {photo
      ? <img src={photo} alt={name} className={className} loading="lazy" decoding="async" onError={() => setPhoto(null)} />
      : fallback}
  </div>;
}
