-- Agenda compartida PEIE. Aplicar en el proyecto Supabase de esta app.
begin;
create table if not exists public.agenda_eventos (
 id uuid primary key default gen_random_uuid(), titulo text not null check(length(btrim(titulo)) between 1 and 160),
 descripcion text not null default '' check(length(descripcion)<=4000), fecha date not null,
 hora time, lugar text not null default '' check(length(lugar)<=250),
 creado_por uuid not null references public.profiles(id), eliminado boolean not null default false,
 actualizado_en timestamptz not null default now()
);
create index if not exists agenda_eventos_fecha on public.agenda_eventos(fecha) where not eliminado;
create table if not exists public.agenda_vinculos (
 evento_id uuid not null references public.agenda_eventos(id) on delete cascade,
 persona_tipo text not null check(persona_tipo in ('empleado','perfil')), persona_id uuid not null,
 avisar boolean not null default false, leido_en timestamptz,
 primary key(evento_id,persona_tipo,persona_id)
);
create index if not exists agenda_vinculos_persona on public.agenda_vinculos(persona_id) where avisar;
create table if not exists public.agenda_cumpleanos (
 persona_tipo text not null check(persona_tipo in ('empleado','perfil')), persona_id uuid not null,
 mes integer not null check(mes between 1 and 12), dia integer not null,
 primary key(persona_tipo,persona_id), check(dia between 1 and extract(day from (make_date(2000,mes,1)+interval '1 month - 1 day')))
);
create or replace function public.agenda_rol() returns text language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and active=true
$$;
revoke all on function public.agenda_rol() from public,anon;
grant execute on function public.agenda_rol() to authenticated;
alter table public.agenda_eventos enable row level security;
alter table public.agenda_vinculos enable row level security;
alter table public.agenda_cumpleanos enable row level security;
drop policy if exists agenda_lectura on public.agenda_eventos;
create policy agenda_lectura on public.agenda_eventos for select to authenticated using(public.agenda_rol() is not null and not eliminado);
drop policy if exists agenda_lectura on public.agenda_vinculos;
create policy agenda_lectura on public.agenda_vinculos for select to authenticated using(public.agenda_rol() is not null and exists(select 1 from public.agenda_eventos e where e.id=evento_id and not e.eliminado));
revoke all on public.agenda_eventos,public.agenda_vinculos,public.agenda_cumpleanos from anon,authenticated;
grant select on public.agenda_eventos,public.agenda_vinculos to authenticated;

create or replace function public.agenda_personas() returns table(persona_tipo text,persona_id uuid,nombre text,detalle text,whatsapp text,mes integer,dia integer)
language plpgsql stable security definer set search_path=public as $$
begin
 if public.agenda_rol() is null then raise exception 'Se requiere una cuenta activa'; end if;
 return query select 'empleado'::text,e.id,e.full_name,e.specialty,e.whatsapp,c.mes,c.dia
 from public.empleados e left join public.agenda_cumpleanos c on c.persona_tipo='empleado' and c.persona_id=e.id where e.active=true
 union all select 'perfil'::text,p.id,p.full_name,p.role,p.whatsapp,c.mes,c.dia
 from public.profiles p left join public.agenda_cumpleanos c on c.persona_tipo='perfil' and c.persona_id=p.id where p.active=true;
end $$;

create or replace function public.agenda_guardar(p_id uuid,p_titulo text,p_descripcion text,p_fecha date,p_hora time,p_lugar text,p_personas jsonb,p_avisar boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_owner uuid; v_person jsonb; v_tipo text; v_person_id uuid; v_role text:=public.agenda_rol();
begin
 if v_role is null or v_role not in ('admin','logistica','coordinador','encargado') then raise exception 'No tenés permiso para gestionar eventos'; end if;
 if p_fecha is null or p_titulo is null or length(btrim(p_titulo)) not between 1 and 160 then raise exception 'Revisá el título y la fecha'; end if;
 if p_personas is null or jsonb_typeof(p_personas)<>'array' or jsonb_array_length(p_personas)>500 then raise exception 'Lista de personas inválida'; end if;
 if p_id is not null then
  select creado_por into v_owner from public.agenda_eventos where id=p_id for update;
 end if;
 if v_owner is not null then
  if (v_owner<>auth.uid() and v_role not in ('admin','logistica')) or exists(select 1 from public.agenda_eventos where id=p_id and eliminado) then raise exception 'No podés editar este evento'; end if;
  update public.agenda_eventos set titulo=btrim(p_titulo),descripcion=coalesce(p_descripcion,''),fecha=p_fecha,hora=p_hora,lugar=coalesce(p_lugar,''),actualizado_en=now() where id=p_id returning id into v_id;
 else
  insert into public.agenda_eventos(id,titulo,descripcion,fecha,hora,lugar,creado_por) values(coalesce(p_id,gen_random_uuid()),btrim(p_titulo),coalesce(p_descripcion,''),p_fecha,p_hora,coalesce(p_lugar,''),auth.uid()) returning id into v_id;
 end if;
 delete from public.agenda_vinculos where evento_id=v_id;
 for v_person in select value from jsonb_array_elements(p_personas) loop
  v_tipo:=v_person->>'tipo'; v_person_id:=(v_person->>'id')::uuid;
  if v_person_id is null or v_tipo is null or v_tipo not in ('empleado','perfil') then raise exception 'Persona inválida'; end if;
  if v_tipo='empleado' and not exists(select 1 from public.empleados where id=v_person_id and active=true) then raise exception 'Empleado no disponible'; end if;
  if v_tipo='perfil' and not exists(select 1 from public.profiles where id=v_person_id and active=true) then raise exception 'Usuario no disponible'; end if;
  insert into public.agenda_vinculos(evento_id,persona_tipo,persona_id,avisar) values(v_id,v_tipo,v_person_id,coalesce(p_avisar,false)) on conflict do nothing;
 end loop;
 return v_id;
end $$;

create or replace function public.agenda_quitar(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_role text:=public.agenda_rol();
begin
 if v_role is null or v_role not in ('admin','logistica','coordinador','encargado') then raise exception 'Sin permiso'; end if;
 update public.agenda_eventos set eliminado=true,actualizado_en=now() where id=p_id and not eliminado and (creado_por=auth.uid() or v_role in ('admin','logistica'));
 if not found then raise exception 'Evento no disponible o sin permiso'; end if;
end $$;

create or replace function public.agenda_cumple_guardar(p_tipo text,p_id uuid,p_mes integer,p_dia integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if coalesce(public.agenda_rol(),'') not in ('admin','logistica') then raise exception 'Solo Administración o Logística puede editar cumpleaños'; end if;
 if p_tipo is null or p_tipo not in ('empleado','perfil') or p_id is null then raise exception 'Persona inválida'; end if;
 if p_tipo='empleado' and not exists(select 1 from public.empleados where id=p_id and active=true) then raise exception 'Empleado no disponible'; end if;
 if p_tipo='perfil' and not exists(select 1 from public.profiles where id=p_id and active=true) then raise exception 'Usuario no disponible'; end if;
 if p_mes is null and p_dia is null then delete from public.agenda_cumpleanos where persona_tipo=p_tipo and persona_id=p_id;
 else insert into public.agenda_cumpleanos values(p_tipo,p_id,p_mes,p_dia) on conflict(persona_tipo,persona_id) do update set mes=excluded.mes,dia=excluded.dia; end if;
end $$;
create or replace function public.agenda_leer(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if public.agenda_rol() is null then raise exception 'Sin sesión activa'; end if;
 update public.agenda_vinculos set leido_en=now() where evento_id=p_id and persona_tipo='perfil' and persona_id=auth.uid() and avisar;
end $$;

-- Importa únicamente día y mes si el módulo privado de legajos ya está instalado.
do $$ begin
 if to_regclass('public.empleados_legajos') is not null then
  execute 'insert into public.agenda_cumpleanos select ''empleado'',empleado_id,extract(month from fecha_nacimiento)::integer,extract(day from fecha_nacimiento)::integer from public.empleados_legajos where fecha_nacimiento is not null on conflict do nothing';
 end if;
end $$;
revoke all on function public.agenda_personas(),public.agenda_guardar(uuid,text,text,date,time,text,jsonb,boolean),public.agenda_quitar(uuid),public.agenda_cumple_guardar(text,uuid,integer,integer),public.agenda_leer(uuid) from public,anon;
grant execute on function public.agenda_personas(),public.agenda_guardar(uuid,text,text,date,time,text,jsonb,boolean),public.agenda_quitar(uuid),public.agenda_cumple_guardar(text,uuid,integer,integer),public.agenda_leer(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

