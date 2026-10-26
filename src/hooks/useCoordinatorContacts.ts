import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CoordinatorContact } from '../lib/coordinatorDirectory';

export function useCoordinatorContacts() {
  const [contacts, setContacts] = useState<CoordinatorContact[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const { data, error } = await supabase.from('profiles').select('id,full_name,username,whatsapp')
        .in('role', ['admin','coordinador','encargado','solicitante']).abortSignal(controller.signal);
      if (!controller.signal.aborted && !error) setContacts(data || []);
    })().catch(() => { /* Keep unresolved labels; never infer a phone on failure. */ });
    return () => controller.abort();
  }, []);
  return contacts;
}
