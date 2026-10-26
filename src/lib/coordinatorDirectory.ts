export interface CoordinatorContact {
  id: string;
  full_name: string | null;
  username: string | null;
  whatsapp: string | null;
}
export interface CoordinatorWorksite {
  coordinador_id?: string | null;
  encargado_name?: string | null;
}
export const normalizeCoordinator = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

export function coordinatorEntry(obra: CoordinatorWorksite | null | undefined, contacts: CoordinatorContact[]) {
  const name = (obra?.encargado_name || '').trim().replace(/\s+/g, ' ');
  const exact = contacts.filter(contact => normalizeCoordinator(contact.full_name || '') === normalizeCoordinator(name));
  const contact = obra?.coordinador_id ? contacts.find(contact => contact.id === obra.coordinador_id) : name && exact.length === 1 ? exact[0] : undefined;
  const key = obra?.coordinador_id || contact?.id;
  if (!key && !name) return { value: '', label: 'Sin coordinador' };
  return {
    value: key ? `user:${key}` : `legacy:${normalizeCoordinator(name)}`,
    label: contact
      ? `${contact.full_name || contact.username || name} · ${contact.whatsapp?.trim() || 'Celular pendiente'}`
      : `${name || 'Coordinador'} · ${key ? 'Contacto no disponible' : 'Sin vincular'}`,
  };
}

export function coordinatorOptions(obras: (CoordinatorWorksite | null | undefined)[], contacts: CoordinatorContact[]) {
  const entries = obras.map(obra => coordinatorEntry(obra, contacts)).filter(entry => entry.value);
  return [...new Map(entries.map(entry => [entry.value, entry])).values()].sort((a,b) => a.label.localeCompare(b.label, 'es'));
}
