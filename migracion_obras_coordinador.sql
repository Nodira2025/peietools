-- Asignacion por identidad, sin modificar los nombres historicos ni los permisos.
begin;
alter table public.obras add column if not exists coordinador_id uuid references public.profiles(id) on delete set null;
create index if not exists obras_coordinador_id_idx on public.obras(coordinador_id);
create or replace function public.validar_coordinador_obra()
returns trigger language plpgsql set search_path = public as $$
declare nombre text;
begin
  if tg_op = 'UPDATE' then
    if new.coordinador_id is not distinct from old.coordinador_id then return new; end if;
  end if;
  if new.coordinador_id is null then return new; end if;
  select coalesce(nullif(full_name, ''), username) into nombre
  from public.profiles
  where id = new.coordinador_id and active = true
    and role in ('admin', 'coordinador', 'encargado', 'solicitante');
  if not found then
    raise exception 'Selecciona un coordinador o administrador activo.';
  end if;
  new.encargado_name := nombre;
  return new;
end;
$$;
drop trigger if exists validar_coordinador_obra on public.obras;
create trigger validar_coordinador_obra before insert or update of coordinador_id on public.obras
for each row execute function public.validar_coordinador_obra();
notify pgrst, 'reload schema';
commit;
