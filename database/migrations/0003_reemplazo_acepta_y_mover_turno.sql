-- =====================================================================
-- SkillUp · Base de datos · Solicitudes de cambio: el reemplazo acepta
-- y, al aprobar, el turno pasa al reemplazo.
-- Autor: Maximiliano
--
-- Cómo usarlo: pegar TODO en el SQL Editor de Supabase y apretar Run.
-- Va DESPUÉS de 0001 y 0002. Todo se aplica junto o nada.
--
-- Reglas (decididas por Maxi):
-- 1. El reemplazo responde: acepta o rechaza.
-- 2. Si rechaza, la solicitud sigue pendiente para proponer a otra persona.
-- 3. El jefe solo puede APROBAR si el reemplazo aceptó y sigue disponible.
--    Si nadie acepta, el jefe solo puede rechazar.
-- 4. Al aprobar, el turno pasa al reemplazo (en el mismo paso, o nada).
-- 5. "Disponible" = sabe hacer el rol, no trabaja ya en ese servicio,
--    no está ausente ese día y no supera el máximo de días seguidos.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. CONFIGURACION: valores ajustables sin tocar el esquema.
-- ---------------------------------------------------------------------
create table public.configuracion (
    clave        text primary key,
    valor        integer not null,
    descripcion  text
);

insert into public.configuracion (clave, valor, descripcion) values
    ('max_dias_seguidos', 6,
     'Máximo de días seguidos que alguien puede trabajar si acepta un reemplazo. [PENDIENTE CERVECERÍA]');

alter table public.configuracion enable row level security;


-- ---------------------------------------------------------------------
-- 2. RESPUESTA DEL REEMPLAZO en cada solicitud.
--    Vacía si la solicitud no propone a nadie.
-- ---------------------------------------------------------------------
alter table public.solicitud_cambio
    add column respuesta_reemplazo text
        check (respuesta_reemplazo in ('pendiente', 'aceptada', 'rechazada')),
    add column respondida_en timestamptz;

-- Las solicitudes que ya existían con reemplazo quedan esperando su respuesta.
update public.solicitud_cambio
set respuesta_reemplazo = 'pendiente'
where reemplazo_id is not null and estado = 'pendiente';

-- Una sola solicitud pendiente por persona y turno.
create unique index solicitud_una_pendiente
    on public.solicitud_cambio (solicitante_id, fecha, franja)
    where estado = 'pendiente';


-- ---------------------------------------------------------------------
-- 3. ¿ESTÁ DISPONIBLE ESTE REEMPLAZO?
--    Devuelve vacío (null) si está disponible, o el motivo en palabras
--    si no lo está. El backend puede usarla para mostrar el motivo.
-- ---------------------------------------------------------------------
create function public.motivo_no_disponible(
    p_reemplazo   text,
    p_solicitante text,
    p_fecha       date,
    p_franja      text
) returns text
language plpgsql stable
as $$
declare
    v_servicio  bigint;
    v_rol       text;
    v_max       integer;
    v_dias      date[];
    v_inicio    date;
    v_fin       date;
begin
    if not exists (select 1 from public.empleado where id = p_reemplazo and activo) then
        return 'El reemplazo no es un empleado activo';
    end if;

    -- El turno que se quiere cambiar.
    select t.servicio_id, t.rol_codigo into v_servicio, v_rol
    from public.turno t
    join public.servicio s on s.id = t.servicio_id
    where t.empleado_id = p_solicitante and s.fecha = p_fecha and s.franja = p_franja;

    if v_servicio is null then
        return 'Quien pide el cambio no tiene turno en esa fecha y franja';
    end if;

    -- a) Sabe hacer el rol.
    if not exists (select 1 from public.empleado_rol where empleado_id = p_reemplazo and rol_codigo = v_rol)
       and not exists (select 1 from public.empleado where id = p_reemplazo and rol_principal = v_rol) then
        return format('No sabe hacer el rol %s', v_rol);
    end if;

    -- b) No trabaja ya en ese servicio.
    if exists (select 1 from public.turno where servicio_id = v_servicio and empleado_id = p_reemplazo) then
        return 'Ya trabaja en ese mismo servicio';
    end if;

    -- c) No está ausente ese día.
    if exists (select 1 from public.ausencia where empleado_id = p_reemplazo and fecha = p_fecha) then
        return 'Está ausente ese día';
    end if;

    -- d) No supera el máximo de días seguidos (contando el día nuevo).
    select valor into v_max from public.configuracion where clave = 'max_dias_seguidos';
    select array_agg(distinct s.fecha) into v_dias
    from public.turno t join public.servicio s on s.id = t.servicio_id
    where t.empleado_id = p_reemplazo;
    v_dias := coalesce(v_dias, '{}') || p_fecha;

    v_inicio := p_fecha;
    while (v_inicio - 1) = any (v_dias) loop
        v_inicio := v_inicio - 1;
    end loop;
    v_fin := p_fecha;
    while (v_fin + 1) = any (v_dias) loop
        v_fin := v_fin + 1;
    end loop;

    if (v_fin - v_inicio + 1) > v_max then
        return format('Quedaría con %s días seguidos de trabajo (máximo %s)', v_fin - v_inicio + 1, v_max);
    end if;

    return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. REGLAS AUTOMÁTICAS al guardar una solicitud.
-- ---------------------------------------------------------------------
create function public.reglas_solicitud_cambio()
returns trigger
language plpgsql
as $$
declare
    v_motivo text;
begin
    -- Al crearla o al proponer a otro reemplazo: su respuesta vuelve a "pendiente".
    if tg_op = 'INSERT' or new.reemplazo_id is distinct from old.reemplazo_id then
        if new.reemplazo_id is null then
            new.respuesta_reemplazo := null;
        else
            new.respuesta_reemplazo := 'pendiente';
        end if;
        new.respondida_en := null;
    end if;

    if tg_op = 'UPDATE' then
        -- Una solicitud ya resuelta no se cambia.
        if old.estado <> 'pendiente' then
            raise exception 'La solicitud % ya está %', old.id, old.estado;
        end if;

        -- El reemplazo responde.
        if new.respuesta_reemplazo is distinct from old.respuesta_reemplazo
           and new.reemplazo_id is not distinct from old.reemplazo_id then
            if new.reemplazo_id is null then
                raise exception 'La solicitud no tiene reemplazo que pueda responder';
            end if;
            if new.respuesta_reemplazo = 'aceptada' then
                v_motivo := public.motivo_no_disponible(new.reemplazo_id, new.solicitante_id, new.fecha, new.franja);
                if v_motivo is not null then
                    raise exception 'No puede aceptar: %', v_motivo;
                end if;
            end if;
            new.respondida_en := now();
        end if;

        -- El jefe aprueba: solo con reemplazo que aceptó y sigue disponible.
        if new.estado = 'aprobada' then
            if new.reemplazo_id is null or new.respuesta_reemplazo is distinct from 'aceptada' then
                raise exception 'Solo se puede aprobar si un reemplazo aceptó. Si nadie acepta, hay que rechazarla';
            end if;
            v_motivo := public.motivo_no_disponible(new.reemplazo_id, new.solicitante_id, new.fecha, new.franja);
            if v_motivo is not null then
                raise exception 'No se puede aprobar: %', v_motivo;
            end if;

            -- Mover el turno al reemplazo (mismo servicio y mismo rol).
            update public.turno t
            set empleado_id = new.reemplazo_id
            from public.servicio s
            where s.id = t.servicio_id
              and t.empleado_id = new.solicitante_id
              and s.fecha = new.fecha
              and s.franja = new.franja;
        end if;
    end if;

    new.actualizada_en := now();
    return new;
end;
$$;

create trigger solicitud_cambio_reglas
    before insert or update on public.solicitud_cambio
    for each row execute function public.reglas_solicitud_cambio();


-- ---------------------------------------------------------------------
-- 5. PERMISOS para la cuenta del backend (regla de 0002).
-- ---------------------------------------------------------------------
grant select on public.configuracion to skillup_backend;
grant execute on function public.motivo_no_disponible(text, text, date, text) to skillup_backend;
create policy acceso_backend on public.configuracion
    for all to skillup_backend using (true) with check (true);


commit;
