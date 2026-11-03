-- =====================================================================
-- SkillUp · Base de datos · Etapa 3: cuenta del backend e intentos de login
-- Autor: Maximiliano
--
-- Cómo usarlo: pegar TODO en el SQL Editor de Supabase y apretar Run.
-- Va DESPUÉS de 0001_esquema_inicial.sql.
--
-- No rompe nada: el backend sigue conectándose como hoy hasta que Diego
-- cambie su DATABASE_URL a la cuenta nueva.
--
-- La contraseña de la cuenta nueva NO va en este archivo (el repo es
-- público). Se pone aparte, ver database/README.md.
-- =====================================================================

begin;


-- ---------------------------------------------------------------------
-- 1. INTENTO_LOGIN: cada intento de entrar a la app, bueno o malo.
--    Con esto el backend cuenta los intentos fallidos recientes
--    (bloqueo tras 5) aunque se reinicie.
-- ---------------------------------------------------------------------
create table public.intento_login (
    id              bigint generated always as identity primary key,
    nombre_usuario  text not null check (length(nombre_usuario) <= 64),
    exito           boolean not null,
    creado_en       timestamptz not null default now()
);

create index intento_login_usuario_idx
    on public.intento_login (nombre_usuario, creado_en desc);

alter table public.intento_login enable row level security;

-- Hasta cuándo está bloqueado un usuario (vacío = no está bloqueado).
alter table public.usuario add column bloqueado_hasta timestamptz;


-- ---------------------------------------------------------------------
-- 2. CUENTA DEL BACKEND: skillup_backend
--    Puede leer y escribir datos, pero NO puede crear, cambiar ni borrar
--    tablas, ni vaciarlas de golpe (no es dueña de nada).
--    Se crea sin contraseña: así no puede entrar hasta que se le ponga una.
-- ---------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'skillup_backend') then
        create role skillup_backend login;
    end if;
end $$;

-- Puede "entrar" a las dos carpetas.
grant usage on schema public, sensible to skillup_backend;

-- Hojas de referencia: solo leer.
grant select on public.local, public.rol to skillup_backend;

-- Hojas de trabajo diario: leer, agregar, cambiar y borrar filas.
grant select, insert, update, delete on
    public.empleado, public.empleado_rol, public.usuario, public.servicio,
    public.servicio_requerimiento, public.turno, public.ausencia,
    public.prediccion, public.calendario_dia, public.evento,
    public.solicitud_cambio, public.intento_login
to skillup_backend;

-- Datos sensibles.
grant select, insert, update on sensible.consentimiento to skillup_backend;   -- revocar = update, nunca borrar
grant select, insert, update, delete on sensible.bienestar_diario to skillup_backend;  -- delete: derecho a eliminar sus datos
grant select on sensible.escala_fatiga to skillup_backend;
grant select, insert on sensible.registro_acceso to skillup_backend;          -- auditoría: solo agregar

-- Numeración automática de los id (necesaria para agregar filas).
grant usage on all sequences in schema public, sensible to skillup_backend;

-- Funciones de las reglas de bienestar (consentimiento y escala).
grant execute on all functions in schema sensible to skillup_backend;


-- ---------------------------------------------------------------------
-- 3. REGLAS DE ACCESO POR FILA (RLS)
--    Las hojas tienen RLS activado y, sin reglas, nadie ve nada.
--    Esta regla deja pasar SOLO a skillup_backend; la clave pública de
--    Supabase (anon / authenticated) sigue sin ver nada.
--    Qué puede hacer en cada hoja lo deciden los permisos de arriba.
-- ---------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array[
        'public.local', 'public.rol', 'public.empleado', 'public.empleado_rol',
        'public.usuario', 'public.servicio', 'public.servicio_requerimiento',
        'public.turno', 'public.ausencia', 'public.prediccion',
        'public.calendario_dia', 'public.evento', 'public.solicitud_cambio',
        'public.intento_login',
        'sensible.consentimiento', 'sensible.bienestar_diario',
        'sensible.escala_fatiga', 'sensible.registro_acceso'
    ] loop
        execute format(
            'create policy acceso_backend on %s for all to skillup_backend using (true) with check (true)',
            t);
    end loop;
end $$;


commit;
