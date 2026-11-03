
-- =====================================================================
-- SkillUp · Base de datos · Etapa 1: esquema inicial
-- Autor: Maximiliano (responsable de base de datos)
--
-- Cómo usarlo: copiar TODO este archivo, pegarlo en el "SQL Editor" del
-- panel de Supabase y apretar "Run". Se ejecuta una sola vez sobre un
-- proyecto nuevo.
--
-- Los nombres y valores están alineados con la API del backend
-- (backend/app/schemas.py y backend/app/mocks/), para que los datos de
-- ejemplo se puedan cargar tal cual en la etapa 2.
--
-- En simple: cada "create table" es una hoja de cálculo. Las columnas
-- con "references" conectan una hoja con otra, y los "check" son reglas
-- que impiden guardar datos inválidos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LOCAL: cada sucursal de la cervecería
-- ---------------------------------------------------------------------
create table local (
    id          bigint generated always as identity primary key,
    nombre      text not null,
    direccion   text,
    creado_en   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. ROL: puestos de trabajo. Es una hoja (y no una lista fija) para
--    poder agregar roles sin tocar el resto del esquema.
-- ---------------------------------------------------------------------
create table rol (
    codigo      text primary key,           -- ej: 'garzon'
    nombre      text not null,              -- ej: 'Garzón'
    es_critico  boolean not null default false
);

insert into rol (codigo, nombre, es_critico) values
    ('garzon',          'Garzón',              true),
    ('cocinero_linea',  'Cocinero de línea',   true),
    ('jefe_turno',      'Jefe de turno',       true),
    ('runner',          'Runner',              false),
    ('host',            'Host',                false),
    ('cajero',          'Cajero',              false),
    ('ayudante_cocina', 'Ayudante de cocina',  false),
    ('copero',          'Copero',              false);
-- [PENDIENTE CERVECERÍA] confirmar los roles reales del local.


-- ---------------------------------------------------------------------
-- 3. EMPLEADO: la ficha de cada persona.
--    El id es texto (ej: 'RST_001'), igual que en la API.
--    Variables del PDF: contract_type, distance_to_work_km.
--    Las variables descartadas (IMC, género, hijos, tabaquismo,
--    nivel educacional) NO existen en ninguna hoja, a propósito.
--    Días seguidos trabajados y horas extra se calculan desde "turno".
--    "polivalente" y "puede_cubrir" se calculan desde "empleado_rol".
-- ---------------------------------------------------------------------
create table empleado (
    id                    text primary key check (length(id) between 1 and 20),
    local_id              bigint not null references local(id),
    nombre                text not null,
    rol_principal         text not null references rol(codigo),
    rol_respaldo          text references rol(codigo),
    tipo_contrato         text not null
        check (tipo_contrato in ('full_time', 'part_time', 'weekend_only')),
    fecha_ingreso         date,      -- de aquí se calcula la antigüedad
    preferencia_turno     text not null default 'mixed'
        check (preferencia_turno in ('midday', 'evening', 'mixed')),
    distancia_trabajo_km  numeric(5,1) check (distancia_trabajo_km >= 0),
    activo                boolean not null default true,
    creado_en             timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. EMPLEADO_ROL: otros roles que cada persona sabe cubrir
--    (cross_trained del PDF). Una fila por cada rol extra.
-- ---------------------------------------------------------------------
create table empleado_rol (
    empleado_id  text not null references empleado(id) on delete cascade,
    rol_codigo   text not null references rol(codigo),
    primary key (empleado_id, rol_codigo)
);


-- ---------------------------------------------------------------------
-- 5. USUARIO: login de la app. Dos perfiles: jefe_turno y empleado.
--    La contraseña NUNCA se guarda tal cual: el backend guarda una
--    versión cifrada (hash).
-- ---------------------------------------------------------------------
create table usuario (
    id              bigint generated always as identity primary key,
    empleado_id     text unique references empleado(id),
    nombre_usuario  text not null unique check (length(nombre_usuario) <= 64),
    hash_contrasena text not null,
    perfil          text not null check (perfil in ('jefe_turno', 'empleado')),
    activo          boolean not null default true,
    creado_en       timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 6. SERVICIO: un bloque de atención (fecha + franja horaria).
--    Variables del PDF: date, service_period, forecast_covers,
--    reservation_count, delivery_orders, walk_in_ratio, promo_flag.
--    is_friday / is_weekend se sacan directo de la fecha.
--    local_event_flag se saca de la hoja de eventos.
-- ---------------------------------------------------------------------
create table servicio (
    id                      bigint generated always as identity primary key,
    local_id                bigint not null references local(id),
    fecha                   date not null,
    franja                  text not null
        check (franja in ('11_13', '13_15', '19_21', '21_23')),
    requeridos              integer check (requeridos >= 0),  -- total de personas necesarias
    cubiertos_previstos     integer check (cubiertos_previstos >= 0),
    reservas                integer check (reservas >= 0),
    pedidos_delivery        integer check (pedidos_delivery >= 0),
    proporcion_sin_reserva  numeric(4,3)
        check (proporcion_sin_reserva between 0 and 1),
    hay_promocion           boolean not null default false,
    unique (local_id, fecha, franja)
);


-- ---------------------------------------------------------------------
-- 7. SERVICIO_REQUERIMIENTO: el detalle por rol de cuánta gente
--    necesita cada servicio (así se ve si la cocina está crítica).
--    [PENDIENTE CERVECERÍA] los datos de ejemplo solo traen el total.
-- ---------------------------------------------------------------------
create table servicio_requerimiento (
    servicio_id  bigint  not null references servicio(id) on delete cascade,
    rol_codigo   text    not null references rol(codigo),
    requeridos   integer not null check (requeridos >= 0),
    primary key (servicio_id, rol_codigo)
);


-- ---------------------------------------------------------------------
-- 8. TURNO: quién trabaja en qué servicio, con qué rol y cuántas horas.
--    Variables del PDF: scheduled_headcount y scheduled_role
--    (se obtienen contando filas), overtime_hours.
-- ---------------------------------------------------------------------
create table turno (
    id                 bigint generated always as identity primary key,
    servicio_id        bigint not null references servicio(id),
    empleado_id        text   not null references empleado(id),
    rol_codigo         text   not null references rol(codigo),
    horas_programadas  numeric(4,1) not null default 2 check (horas_programadas > 0),
    horas_extra        numeric(4,1) not null default 0 check (horas_extra >= 0),
    unique (servicio_id, empleado_id)       -- nadie en dos puestos a la vez
);


-- ---------------------------------------------------------------------
-- 9. AUSENCIA: faltas registradas, y si fueron con aviso corto.
--    El motivo solo puede ser 'personal' o 'salud': NUNCA el diagnóstico.
-- ---------------------------------------------------------------------
create table ausencia (
    id           bigint generated always as identity primary key,
    empleado_id  text not null references empleado(id),
    fecha        date not null,
    motivo       text not null check (motivo in ('personal', 'salud')),
    horas        numeric(4,1) check (horas > 0),
    aviso_corto  boolean not null default false,
    creado_en    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 10. PREDICCION: lo que calcula el modelo para cada servicio.
--     Una fila por servicio (se reemplaza al recalcular).
--     nivel_riesgo se calcula SOLO a partir de prob_deficit:
--     alerta >= 0,55 y alto >= 0,75.
-- ---------------------------------------------------------------------
create table prediccion (
    servicio_id          bigint primary key references servicio(id) on delete cascade,
    prob_deficit         numeric(4,3) not null check (prob_deficit between 0 and 1),
    prob_garzon          numeric(4,3) check (prob_garzon between 0 and 1),
    prob_cocinero_linea  numeric(4,3) check (prob_cocinero_linea between 0 and 1),
    prob_jefe_turno      numeric(4,3) check (prob_jefe_turno between 0 and 1),
    dotacion_predicha    numeric(5,1) check (dotacion_predicha >= 0),
    recomendacion        text,
    nivel_riesgo         text generated always as (
        case
            when prob_deficit >= 0.75 then 'alto'
            when prob_deficit >= 0.55 then 'alerta'
            else 'bajo'
        end
    ) stored,
    version_modelo       text,
    generada_en          timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 11. CALENDARIO_DIA: días especiales que suben la demanda.
--     Variables del PDF: is_payday_window, is_holiday, is_holiday_eve.
--     Solo se anotan los días especiales; un día que no aparece es normal.
-- ---------------------------------------------------------------------
create table calendario_dia (
    fecha                   date primary key,
    es_ventana_pago         boolean not null default false,  -- días de pago y quincenas
    feriado                 text,                            -- nombre del feriado, o vacío
    es_vispera_feriado      boolean not null default false,
    es_fin_de_semana_largo  boolean not null default false
);


-- ---------------------------------------------------------------------
-- 12. EVENTO: partidos, conciertos, promociones, etc. del local.
--     "franjas" vacío = afecta el día completo.
-- ---------------------------------------------------------------------
create table evento (
    id                bigint generated always as identity primary key,
    local_id          bigint not null references local(id),
    fecha             date not null,
    nombre            text not null check (length(nombre) <= 120),
    tipo              text not null default 'otro'
        check (tipo in ('partido', 'concierto', 'tocata', 'lanzamiento',
                        'promocion', 'evento_local', 'otro')),
    franjas           text[] not null default '{}'
        check (franjas <@ array['11_13', '13_15', '19_21', '21_23']),
    impacto_esperado  text not null default 'medio'
        check (impacto_esperado in ('bajo', 'medio', 'alto')),
    notas             text check (length(notas) <= 500),
    creado_en         timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 13. SOLICITUD_CAMBIO: pedidos de cambio de turno y su aprobación.
-- ---------------------------------------------------------------------
create table solicitud_cambio (
    id              bigint generated always as identity primary key,
    solicitante_id  text not null references empleado(id),
    fecha           date not null,
    franja          text not null check (franja in ('11_13', '13_15', '19_21', '21_23')),
    reemplazo_id    text references empleado(id),     -- quién cubre (puede faltar)
    motivo          text check (length(motivo) <= 300),
    estado          text not null default 'pendiente'
        check (estado in ('pendiente', 'aprobada', 'rechazada')),
    comentario      text check (length(comentario) <= 300),
    resuelta_por    bigint references usuario(id),    -- el jefe que decidió
    creada_en       timestamptz not null default now(),
    actualizada_en  timestamptz not null default now(),
    check (reemplazo_id is null or reemplazo_id <> solicitante_id)
);


-- =====================================================================
-- DATOS SENSIBLES (bienestar: biometría y encuestas de fatiga)
-- Van en un "esquema" aparte llamado "sensible": una carpeta separada,
-- con candado, que la app no puede abrir directamente. Solo el backend
-- la lee. Nada se guarda sin consentimiento vigente.
-- =====================================================================
create schema sensible;


-- ---------------------------------------------------------------------
-- 14. CONSENTIMIENTO: si la persona aceptó compartir sus datos.
--     Una fila por cada vez que acepta. Si se arrepiente, se llena
--     revocado_en (no se borra, para que quede el registro).
--     'bienestar' cubre biometría y encuestas; 'tests' queda para
--     cuando se definan los tests (hoy siguen pendientes).
-- ---------------------------------------------------------------------
create table sensible.consentimiento (
    id             bigint generated always as identity primary key,
    empleado_id    text not null references public.empleado(id),
    tipo           text not null default 'bienestar'
        check (tipo in ('bienestar', 'tests')),
    version_texto  text not null,       -- qué versión del texto aceptó
    otorgado_en    timestamptz not null default now(),
    revocado_en    timestamptz,
    check (revocado_en is null or revocado_en >= otorgado_en)
);

-- Solo un consentimiento vigente por persona y tipo.
create unique index consentimiento_vigente_unico
    on sensible.consentimiento (empleado_id, tipo)
    where revocado_en is null;

-- Función de ayuda: ¿esta persona tiene consentimiento vigente?
create function sensible.tiene_consentimiento(p_empleado text, p_tipo text)
returns boolean
language sql stable
as $$
    select exists (
        select 1 from sensible.consentimiento
        where empleado_id = p_empleado
          and tipo = p_tipo
          and revocado_en is null
    );
$$;


-- ---------------------------------------------------------------------
-- 15. ESCALA_FATIGA: la escala de la encuesta, con versiones.
--     Versión 1: del 1 al 7 (la misma que usa el backend).
--     Si cambia, se agrega una versión nueva y las respuestas
--     antiguas conservan la suya.
-- ---------------------------------------------------------------------
create table sensible.escala_fatiga (
    version          integer primary key,
    valor_min        smallint not null,
    valor_max        smallint not null,
    etiqueta_min     text not null,
    etiqueta_max     text not null,
    vigente          boolean not null default false,
    check (valor_max > valor_min)
);

-- Solo una escala vigente a la vez.
create unique index escala_fatiga_una_vigente
    on sensible.escala_fatiga (vigente) where vigente;

insert into sensible.escala_fatiga
    (version, valor_min, valor_max, etiqueta_min, etiqueta_max, vigente)
values
    (1, 1, 7, 'Totalmente alerta', 'Agotado/a', true);
-- Escala preliminar, sujeta a cambios.


-- ---------------------------------------------------------------------
-- 16. BIENESTAR_DIARIO: un registro por persona y día, con los datos
--     del reloj y la encuesta de fatiga (mismos nombres que el backend).
--     Variables del PDF: avg_steps, avg_sleep_hours, avg_hr_mean_bpm,
--     survey_fatigue_in, survey_fatigue_out.
--     Un dato vacío = no hubo señal del reloj o no se respondió.
-- ---------------------------------------------------------------------
create table sensible.bienestar_diario (
    empleado_id             text not null references public.empleado(id),
    fecha                   date not null,
    pasos                   integer check (pasos between 0 and 100000),
    sueno_horas             numeric(3,1) check (sueno_horas between 0 and 24),
    pulso_medio_bpm         numeric(4,1) check (pulso_medio_bpm between 30 and 220),
    encuesta_fatiga_inicio  smallint,
    encuesta_fatiga_fin     smallint,
    escala_version          integer not null default 1
        references sensible.escala_fatiga(version),
    fuente                  text not null default 'simulado'
        check (fuente in ('simulado', 'smartwatch')),
    primary key (empleado_id, fecha)
);


-- ---------------------------------------------------------------------
-- 17. REGISTRO_ACCESO: quién consultó datos de bienestar y cuándo
--     (log de auditoría que pide el backend). Solo se agregan filas.
-- ---------------------------------------------------------------------
create table sensible.registro_acceso (
    id           bigint generated always as identity primary key,
    usuario      text not null,
    accion       text not null,
    empleado_id  text,              -- de quién eran los datos (vacío = varios)
    creado_en    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Reglas automáticas (triggers) para los datos sensibles:
-- se revisan cada vez que alguien intenta guardar una fila.
-- ---------------------------------------------------------------------

-- a) Bienestar: sin consentimiento vigente no se guarda nada, y las
--    respuestas de la encuesta deben estar dentro de la escala.
create function sensible.validar_bienestar()
returns trigger
language plpgsql
as $$
declare
    v_min smallint;
    v_max smallint;
begin
    if not sensible.tiene_consentimiento(new.empleado_id, 'bienestar') then
        raise exception 'El empleado % no tiene consentimiento vigente de bienestar', new.empleado_id;
    end if;

    select valor_min, valor_max into v_min, v_max
    from sensible.escala_fatiga where version = new.escala_version;

    if new.encuesta_fatiga_inicio is not null
       and new.encuesta_fatiga_inicio not between v_min and v_max then
        raise exception 'encuesta_fatiga_inicio debe estar entre % y %', v_min, v_max;
    end if;
    if new.encuesta_fatiga_fin is not null
       and new.encuesta_fatiga_fin not between v_min and v_max then
        raise exception 'encuesta_fatiga_fin debe estar entre % y %', v_min, v_max;
    end if;

    return new;
end;
$$;

create trigger bienestar_valido
    before insert or update on sensible.bienestar_diario
    for each row execute function sensible.validar_bienestar();


-- b) Registro de accesos: no se puede modificar ni borrar.
create function sensible.bloquear_cambios()
returns trigger
language plpgsql
as $$
begin
    raise exception 'El registro de accesos no se puede modificar ni borrar';
end;
$$;

create trigger registro_acceso_solo_agregar
    before update or delete on sensible.registro_acceso
    for each row execute function sensible.bloquear_cambios();


-- =====================================================================
-- ÍNDICES: como el índice de un libro, hacen más rápidas las búsquedas
-- que la app va a hacer seguido (por fecha y por empleado).
-- =====================================================================
create index servicio_fecha_idx        on servicio (fecha);
create index turno_empleado_idx        on turno (empleado_id);
create index ausencia_empleado_idx     on ausencia (empleado_id, fecha);
create index evento_fecha_idx          on evento (local_id, fecha);
create index solicitud_estado_idx      on solicitud_cambio (estado);
create index solicitud_solicitante_idx on solicitud_cambio (solicitante_id);
create index empleado_local_idx        on empleado (local_id);
create index bienestar_fecha_idx       on sensible.bienestar_diario (fecha);
create index registro_acceso_fecha_idx on sensible.registro_acceso (creado_en);


-- =====================================================================
-- SEGURIDAD
-- Supabase publica automáticamente las hojas de "public" en internet.
-- Activamos RLS (seguridad por fila) SIN reglas de acceso: así nadie
-- puede leerlas desde afuera con la clave pública. El backend se
-- conecta con la contraseña de la base (DATABASE_URL), que sí tiene
-- acceso completo. Las reglas finas por perfil quedan para la etapa 3.
-- =====================================================================
alter table local                  enable row level security;
alter table rol                    enable row level security;
alter table empleado               enable row level security;
alter table empleado_rol           enable row level security;
alter table usuario                enable row level security;
alter table servicio               enable row level security;
alter table servicio_requerimiento enable row level security;
alter table turno                  enable row level security;
alter table ausencia               enable row level security;
alter table prediccion             enable row level security;
alter table calendario_dia         enable row level security;
alter table evento                 enable row level security;
alter table solicitud_cambio       enable row level security;

-- La carpeta "sensible" queda cerrada para los accesos públicos de Supabase.
revoke all on schema sensible from public;
revoke all on all tables in schema sensible from public;
revoke all on all functions in schema sensible from public;
alter table sensible.consentimiento   enable row level security;
alter table sensible.bienestar_diario enable row level security;
alter table sensible.escala_fatiga    enable row level security;
alter table sensible.registro_acceso  enable row level security;
