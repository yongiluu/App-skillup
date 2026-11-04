-- =====================================================================
-- SkillUp · Base de datos · Cuándo se propuso al reemplazo y quiénes
-- ya dijeron que no.
-- BORRADOR del backend (Diego/Claude) para que Maxi lo revise y lo haga
-- suyo. Va DESPUÉS de 0003. No toca la función de reglas de la 0003.
--
-- Para qué (boceto de Cata):
--   J1 "Sin respuesta hace 3 h": hace falta la hora en que se propuso.
--   J2 "Ya dijo que no puede": al proponer a otra persona, la 0003
--      pierde quién había rechazado antes.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. CUÁNDO SE PROPUSO al reemplazo actual.
--    Se llena solo: al crear la solicitud con reemplazo y cada vez que
--    se propone a otra persona. Vacío si no hay reemplazo.
-- ---------------------------------------------------------------------
alter table public.solicitud_cambio
    add column propuesto_en timestamptz;

update public.solicitud_cambio
set propuesto_en = creada_en
where reemplazo_id is not null;

create function public.marcar_propuesto_en()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' or new.reemplazo_id is distinct from old.reemplazo_id then
        new.propuesto_en := case when new.reemplazo_id is null then null else now() end;
    else
        new.propuesto_en := old.propuesto_en;   -- nadie lo cambia a mano
    end if;
    return new;
end;
$$;

-- Los triggers BEFORE corren en orden alfabético: este ("..._propuesto")
-- va antes que el de la 0003 ("..._reglas"), y no se pisan.
create trigger solicitud_cambio_propuesto
    before insert or update on public.solicitud_cambio
    for each row execute function public.marcar_propuesto_en();


-- ---------------------------------------------------------------------
-- 2. QUIÉNES YA RECHAZARON cada solicitud.
--    Una fila cada vez que el reemplazo responde "rechazada".
--    Solo se agrega: no se modifica ni se borra.
-- ---------------------------------------------------------------------
create table public.solicitud_rechazo (
    id            bigint generated always as identity primary key,
    solicitud_id  bigint not null references public.solicitud_cambio(id),
    empleado_id   text   not null references public.empleado(id),
    rechazado_en  timestamptz not null default now()
);

create index solicitud_rechazo_solicitud_idx on public.solicitud_rechazo (solicitud_id);

create function public.guardar_rechazo()
returns trigger
language plpgsql
as $$
begin
    if new.respuesta_reemplazo = 'rechazada'
       and old.respuesta_reemplazo is distinct from 'rechazada'
       and new.reemplazo_id is not null then
        insert into public.solicitud_rechazo (solicitud_id, empleado_id)
        values (new.id, new.reemplazo_id);
    end if;
    return null;
end;
$$;

create trigger solicitud_cambio_guardar_rechazo
    after update on public.solicitud_cambio
    for each row execute function public.guardar_rechazo();

alter table public.solicitud_rechazo enable row level security;


-- ---------------------------------------------------------------------
-- 3. PERMISOS para la cuenta del backend (regla de 0002).
--    Solo leer: las filas las escribe el trigger.
--    El trigger corre con los permisos de quien actualiza la solicitud
--    (skillup_backend), por eso también necesita insertar.
-- ---------------------------------------------------------------------
grant select, insert on public.solicitud_rechazo to skillup_backend;
create policy acceso_backend on public.solicitud_rechazo
    for all to skillup_backend using (true) with check (true);


commit;
