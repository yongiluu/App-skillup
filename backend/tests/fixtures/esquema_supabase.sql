-- Copia de la ESTRUCTURA del esquema de Supabase (sin datos), solo para pruebas del backend.
-- Fuente de verdad: el esquema de Maxi en Supabase / database/migrations.
-- Generado el 2026-11-02 leyendo el catálogo de Postgres (solo lectura).
create schema if not exists sensible;
create table "public"."ausencia" (
  "id" bigint generated always as identity not null,
  "empleado_id" text not null,
  "fecha" date not null,
  "motivo" text not null,
  "horas" numeric(4,1),
  "aviso_corto" boolean default false not null,
  "creado_en" timestamp with time zone default now() not null
);
create table "public"."calendario_dia" (
  "fecha" date not null,
  "es_ventana_pago" boolean default false not null,
  "feriado" text,
  "es_vispera_feriado" boolean default false not null,
  "es_fin_de_semana_largo" boolean default false not null
);
create table "public"."empleado" (
  "id" text not null,
  "local_id" bigint not null,
  "nombre" text not null,
  "rol_principal" text not null,
  "rol_respaldo" text,
  "tipo_contrato" text not null,
  "fecha_ingreso" date,
  "preferencia_turno" text default 'mixed'::text not null,
  "distancia_trabajo_km" numeric(5,1),
  "activo" boolean default true not null,
  "creado_en" timestamp with time zone default now() not null
);
create table "public"."empleado_rol" (
  "empleado_id" text not null,
  "rol_codigo" text not null
);
create table "public"."evento" (
  "id" bigint generated always as identity not null,
  "local_id" bigint not null,
  "fecha" date not null,
  "nombre" text not null,
  "tipo" text default 'otro'::text not null,
  "franjas" text[] default '{}'::text[] not null,
  "impacto_esperado" text default 'medio'::text not null,
  "notas" text,
  "creado_en" timestamp with time zone default now() not null
);
create table "public"."local" (
  "id" bigint generated always as identity not null,
  "nombre" text not null,
  "direccion" text,
  "creado_en" timestamp with time zone default now() not null
);
create table "public"."prediccion" (
  "servicio_id" bigint not null,
  "prob_deficit" numeric(4,3) not null,
  "prob_garzon" numeric(4,3),
  "prob_cocinero_linea" numeric(4,3),
  "prob_jefe_turno" numeric(4,3),
  "dotacion_predicha" numeric(5,1),
  "recomendacion" text,
  "nivel_riesgo" text generated always as (
CASE
    WHEN (prob_deficit >= 0.75) THEN 'alto'::text
    WHEN (prob_deficit >= 0.55) THEN 'alerta'::text
    ELSE 'bajo'::text
END) stored,
  "version_modelo" text,
  "generada_en" timestamp with time zone default now() not null
);
create table "public"."rol" (
  "codigo" text not null,
  "nombre" text not null,
  "es_critico" boolean default false not null
);
create table "public"."servicio" (
  "id" bigint generated always as identity not null,
  "local_id" bigint not null,
  "fecha" date not null,
  "franja" text not null,
  "requeridos" integer,
  "cubiertos_previstos" integer,
  "reservas" integer,
  "pedidos_delivery" integer,
  "proporcion_sin_reserva" numeric(4,3),
  "hay_promocion" boolean default false not null
);
create table "public"."servicio_requerimiento" (
  "servicio_id" bigint not null,
  "rol_codigo" text not null,
  "requeridos" integer not null
);
create table "public"."solicitud_cambio" (
  "id" bigint generated always as identity not null,
  "solicitante_id" text not null,
  "fecha" date not null,
  "franja" text not null,
  "reemplazo_id" text,
  "motivo" text,
  "estado" text default 'pendiente'::text not null,
  "comentario" text,
  "resuelta_por" bigint,
  "creada_en" timestamp with time zone default now() not null,
  "actualizada_en" timestamp with time zone default now() not null
);
create table "public"."turno" (
  "id" bigint generated always as identity not null,
  "servicio_id" bigint not null,
  "empleado_id" text not null,
  "rol_codigo" text not null,
  "horas_programadas" numeric(4,1) default 2 not null,
  "horas_extra" numeric(4,1) default 0 not null
);
create table "public"."usuario" (
  "id" bigint generated always as identity not null,
  "empleado_id" text,
  "nombre_usuario" text not null,
  "hash_contrasena" text not null,
  "perfil" text not null,
  "activo" boolean default true not null,
  "creado_en" timestamp with time zone default now() not null
);
create table "sensible"."bienestar_diario" (
  "empleado_id" text not null,
  "fecha" date not null,
  "pasos" integer,
  "sueno_horas" numeric(3,1),
  "pulso_medio_bpm" numeric(4,1),
  "encuesta_fatiga_inicio" smallint,
  "encuesta_fatiga_fin" smallint,
  "escala_version" integer default 1 not null,
  "fuente" text default 'simulado'::text not null
);
create table "sensible"."consentimiento" (
  "id" bigint generated always as identity not null,
  "empleado_id" text not null,
  "tipo" text default 'bienestar'::text not null,
  "version_texto" text not null,
  "otorgado_en" timestamp with time zone default now() not null,
  "revocado_en" timestamp with time zone
);
create table "sensible"."escala_fatiga" (
  "version" integer not null,
  "valor_min" smallint not null,
  "valor_max" smallint not null,
  "etiqueta_min" text not null,
  "etiqueta_max" text not null,
  "vigente" boolean default false not null
);
create table "sensible"."registro_acceso" (
  "id" bigint generated always as identity not null,
  "usuario" text not null,
  "accion" text not null,
  "empleado_id" text,
  "creado_en" timestamp with time zone default now() not null
);
alter table "public"."ausencia" add constraint "ausencia_pkey" PRIMARY KEY (id);
alter table "public"."calendario_dia" add constraint "calendario_dia_pkey" PRIMARY KEY (fecha);
alter table "public"."empleado" add constraint "empleado_pkey" PRIMARY KEY (id);
alter table "public"."empleado_rol" add constraint "empleado_rol_pkey" PRIMARY KEY (empleado_id, rol_codigo);
alter table "public"."evento" add constraint "evento_pkey" PRIMARY KEY (id);
alter table "public"."local" add constraint "local_pkey" PRIMARY KEY (id);
alter table "public"."prediccion" add constraint "prediccion_pkey" PRIMARY KEY (servicio_id);
alter table "public"."rol" add constraint "rol_pkey" PRIMARY KEY (codigo);
alter table "public"."servicio" add constraint "servicio_pkey" PRIMARY KEY (id);
alter table "public"."servicio" add constraint "servicio_local_id_fecha_franja_key" UNIQUE (local_id, fecha, franja);
alter table "public"."servicio_requerimiento" add constraint "servicio_requerimiento_pkey" PRIMARY KEY (servicio_id, rol_codigo);
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_pkey" PRIMARY KEY (id);
alter table "public"."turno" add constraint "turno_pkey" PRIMARY KEY (id);
alter table "public"."turno" add constraint "turno_servicio_id_empleado_id_key" UNIQUE (servicio_id, empleado_id);
alter table "public"."usuario" add constraint "usuario_pkey" PRIMARY KEY (id);
alter table "public"."usuario" add constraint "usuario_empleado_id_key" UNIQUE (empleado_id);
alter table "public"."usuario" add constraint "usuario_nombre_usuario_key" UNIQUE (nombre_usuario);
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_pkey" PRIMARY KEY (empleado_id, fecha);
alter table "sensible"."consentimiento" add constraint "consentimiento_pkey" PRIMARY KEY (id);
alter table "sensible"."escala_fatiga" add constraint "escala_fatiga_pkey" PRIMARY KEY (version);
alter table "sensible"."registro_acceso" add constraint "registro_acceso_pkey" PRIMARY KEY (id);
alter table "public"."ausencia" add constraint "ausencia_horas_check" CHECK ((horas > (0)::numeric));
alter table "public"."ausencia" add constraint "ausencia_motivo_check" CHECK ((motivo = ANY (ARRAY['personal'::text, 'salud'::text])));
alter table "public"."empleado" add constraint "empleado_id_check" CHECK (((length(id) >= 1) AND (length(id) <= 20)));
alter table "public"."empleado" add constraint "empleado_tipo_contrato_check" CHECK ((tipo_contrato = ANY (ARRAY['full_time'::text, 'part_time'::text, 'weekend_only'::text])));
alter table "public"."empleado" add constraint "empleado_preferencia_turno_check" CHECK ((preferencia_turno = ANY (ARRAY['midday'::text, 'evening'::text, 'mixed'::text])));
alter table "public"."empleado" add constraint "empleado_distancia_trabajo_km_check" CHECK ((distancia_trabajo_km >= (0)::numeric));
alter table "public"."evento" add constraint "evento_impacto_esperado_check" CHECK ((impacto_esperado = ANY (ARRAY['bajo'::text, 'medio'::text, 'alto'::text])));
alter table "public"."evento" add constraint "evento_franjas_check" CHECK ((franjas <@ ARRAY['11_13'::text, '13_15'::text, '19_21'::text, '21_23'::text]));
alter table "public"."evento" add constraint "evento_notas_check" CHECK ((length(notas) <= 500));
alter table "public"."evento" add constraint "evento_nombre_check" CHECK ((length(nombre) <= 120));
alter table "public"."evento" add constraint "evento_tipo_check" CHECK ((tipo = ANY (ARRAY['partido'::text, 'concierto'::text, 'tocata'::text, 'lanzamiento'::text, 'promocion'::text, 'evento_local'::text, 'otro'::text])));
alter table "public"."prediccion" add constraint "prediccion_prob_cocinero_linea_check" CHECK (((prob_cocinero_linea >= (0)::numeric) AND (prob_cocinero_linea <= (1)::numeric)));
alter table "public"."prediccion" add constraint "prediccion_dotacion_predicha_check" CHECK ((dotacion_predicha >= (0)::numeric));
alter table "public"."prediccion" add constraint "prediccion_prob_garzon_check" CHECK (((prob_garzon >= (0)::numeric) AND (prob_garzon <= (1)::numeric)));
alter table "public"."prediccion" add constraint "prediccion_prob_jefe_turno_check" CHECK (((prob_jefe_turno >= (0)::numeric) AND (prob_jefe_turno <= (1)::numeric)));
alter table "public"."prediccion" add constraint "prediccion_prob_deficit_check" CHECK (((prob_deficit >= (0)::numeric) AND (prob_deficit <= (1)::numeric)));
alter table "public"."servicio" add constraint "servicio_pedidos_delivery_check" CHECK ((pedidos_delivery >= 0));
alter table "public"."servicio" add constraint "servicio_reservas_check" CHECK ((reservas >= 0));
alter table "public"."servicio" add constraint "servicio_franja_check" CHECK ((franja = ANY (ARRAY['11_13'::text, '13_15'::text, '19_21'::text, '21_23'::text])));
alter table "public"."servicio" add constraint "servicio_cubiertos_previstos_check" CHECK ((cubiertos_previstos >= 0));
alter table "public"."servicio" add constraint "servicio_proporcion_sin_reserva_check" CHECK (((proporcion_sin_reserva >= (0)::numeric) AND (proporcion_sin_reserva <= (1)::numeric)));
alter table "public"."servicio" add constraint "servicio_requeridos_check" CHECK ((requeridos >= 0));
alter table "public"."servicio_requerimiento" add constraint "servicio_requerimiento_requeridos_check" CHECK ((requeridos >= 0));
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_comentario_check" CHECK ((length(comentario) <= 300));
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text])));
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_franja_check" CHECK ((franja = ANY (ARRAY['11_13'::text, '13_15'::text, '19_21'::text, '21_23'::text])));
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_motivo_check" CHECK ((length(motivo) <= 300));
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_check" CHECK (((reemplazo_id IS NULL) OR (reemplazo_id <> solicitante_id)));
alter table "public"."turno" add constraint "turno_horas_extra_check" CHECK ((horas_extra >= (0)::numeric));
alter table "public"."turno" add constraint "turno_horas_programadas_check" CHECK ((horas_programadas > (0)::numeric));
alter table "public"."usuario" add constraint "usuario_nombre_usuario_check" CHECK ((length(nombre_usuario) <= 64));
alter table "public"."usuario" add constraint "usuario_perfil_check" CHECK ((perfil = ANY (ARRAY['jefe_turno'::text, 'empleado'::text])));
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_fuente_check" CHECK ((fuente = ANY (ARRAY['simulado'::text, 'smartwatch'::text])));
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_pasos_check" CHECK (((pasos >= 0) AND (pasos <= 100000)));
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_pulso_medio_bpm_check" CHECK (((pulso_medio_bpm >= (30)::numeric) AND (pulso_medio_bpm <= (220)::numeric)));
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_sueno_horas_check" CHECK (((sueno_horas >= (0)::numeric) AND (sueno_horas <= (24)::numeric)));
alter table "sensible"."consentimiento" add constraint "consentimiento_check" CHECK (((revocado_en IS NULL) OR (revocado_en >= otorgado_en)));
alter table "sensible"."consentimiento" add constraint "consentimiento_tipo_check" CHECK ((tipo = ANY (ARRAY['bienestar'::text, 'tests'::text])));
alter table "sensible"."escala_fatiga" add constraint "escala_fatiga_check" CHECK ((valor_max > valor_min));
alter table "public"."ausencia" add constraint "ausencia_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id);
alter table "public"."empleado" add constraint "empleado_rol_principal_fkey" FOREIGN KEY (rol_principal) REFERENCES rol(codigo);
alter table "public"."empleado" add constraint "empleado_local_id_fkey" FOREIGN KEY (local_id) REFERENCES local(id);
alter table "public"."empleado" add constraint "empleado_rol_respaldo_fkey" FOREIGN KEY (rol_respaldo) REFERENCES rol(codigo);
alter table "public"."empleado_rol" add constraint "empleado_rol_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id) ON DELETE CASCADE;
alter table "public"."empleado_rol" add constraint "empleado_rol_rol_codigo_fkey" FOREIGN KEY (rol_codigo) REFERENCES rol(codigo);
alter table "public"."evento" add constraint "evento_local_id_fkey" FOREIGN KEY (local_id) REFERENCES local(id);
alter table "public"."prediccion" add constraint "prediccion_servicio_id_fkey" FOREIGN KEY (servicio_id) REFERENCES servicio(id) ON DELETE CASCADE;
alter table "public"."servicio" add constraint "servicio_local_id_fkey" FOREIGN KEY (local_id) REFERENCES local(id);
alter table "public"."servicio_requerimiento" add constraint "servicio_requerimiento_rol_codigo_fkey" FOREIGN KEY (rol_codigo) REFERENCES rol(codigo);
alter table "public"."servicio_requerimiento" add constraint "servicio_requerimiento_servicio_id_fkey" FOREIGN KEY (servicio_id) REFERENCES servicio(id) ON DELETE CASCADE;
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_reemplazo_id_fkey" FOREIGN KEY (reemplazo_id) REFERENCES empleado(id);
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_resuelta_por_fkey" FOREIGN KEY (resuelta_por) REFERENCES usuario(id);
alter table "public"."solicitud_cambio" add constraint "solicitud_cambio_solicitante_id_fkey" FOREIGN KEY (solicitante_id) REFERENCES empleado(id);
alter table "public"."turno" add constraint "turno_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id);
alter table "public"."turno" add constraint "turno_rol_codigo_fkey" FOREIGN KEY (rol_codigo) REFERENCES rol(codigo);
alter table "public"."turno" add constraint "turno_servicio_id_fkey" FOREIGN KEY (servicio_id) REFERENCES servicio(id);
alter table "public"."usuario" add constraint "usuario_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id);
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id);
alter table "sensible"."bienestar_diario" add constraint "bienestar_diario_escala_version_fkey" FOREIGN KEY (escala_version) REFERENCES sensible.escala_fatiga(version);
alter table "sensible"."consentimiento" add constraint "consentimiento_empleado_id_fkey" FOREIGN KEY (empleado_id) REFERENCES empleado(id);
CREATE INDEX ausencia_empleado_idx ON public.ausencia USING btree (empleado_id, fecha);
alter table "public"."ausencia" enable row level security;
alter table "public"."calendario_dia" enable row level security;
CREATE INDEX empleado_local_idx ON public.empleado USING btree (local_id);
alter table "public"."empleado" enable row level security;
alter table "public"."empleado_rol" enable row level security;
CREATE INDEX evento_fecha_idx ON public.evento USING btree (local_id, fecha);
alter table "public"."evento" enable row level security;
alter table "public"."local" enable row level security;
alter table "public"."prediccion" enable row level security;
alter table "public"."rol" enable row level security;
CREATE INDEX servicio_fecha_idx ON public.servicio USING btree (fecha);
alter table "public"."servicio" enable row level security;
alter table "public"."servicio_requerimiento" enable row level security;
CREATE INDEX solicitud_estado_idx ON public.solicitud_cambio USING btree (estado);
CREATE INDEX solicitud_solicitante_idx ON public.solicitud_cambio USING btree (solicitante_id);
alter table "public"."solicitud_cambio" enable row level security;
CREATE INDEX turno_empleado_idx ON public.turno USING btree (empleado_id);
alter table "public"."turno" enable row level security;
alter table "public"."usuario" enable row level security;
CREATE INDEX bienestar_fecha_idx ON sensible.bienestar_diario USING btree (fecha);
alter table "sensible"."bienestar_diario" enable row level security;
CREATE UNIQUE INDEX consentimiento_vigente_unico ON sensible.consentimiento USING btree (empleado_id, tipo) WHERE (revocado_en IS NULL);
alter table "sensible"."consentimiento" enable row level security;
CREATE UNIQUE INDEX escala_fatiga_una_vigente ON sensible.escala_fatiga USING btree (vigente) WHERE vigente;
alter table "sensible"."escala_fatiga" enable row level security;
CREATE INDEX registro_acceso_fecha_idx ON sensible.registro_acceso USING btree (creado_en);
alter table "sensible"."registro_acceso" enable row level security;
insert into public.rol values ('ayudante_cocina', 'Ayudante de cocina', false);
insert into public.rol values ('cajero', 'Cajero', false);
insert into public.rol values ('cocinero_linea', 'Cocinero de línea', true);
insert into public.rol values ('copero', 'Copero', false);
insert into public.rol values ('garzon', 'Garzón', true);
insert into public.rol values ('host', 'Host', false);
insert into public.rol values ('jefe_turno', 'Jefe de turno', true);
insert into public.rol values ('runner', 'Runner', false);

CREATE OR REPLACE FUNCTION sensible.bloquear_cambios()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

begin

    raise exception 'El registro de accesos no se puede modificar ni borrar';

end;

$function$;

CREATE OR REPLACE FUNCTION sensible.tiene_consentimiento(p_empleado text, p_tipo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$

    select exists (

        select 1 from sensible.consentimiento

        where empleado_id = p_empleado

          and tipo = p_tipo

          and revocado_en is null

    );

$function$;

CREATE OR REPLACE FUNCTION sensible.validar_bienestar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$

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

$function$;

CREATE TRIGGER bienestar_valido BEFORE INSERT OR UPDATE ON sensible.bienestar_diario FOR EACH ROW EXECUTE FUNCTION sensible.validar_bienestar();

CREATE TRIGGER registro_acceso_solo_agregar BEFORE DELETE OR UPDATE ON sensible.registro_acceso FOR EACH ROW EXECUTE FUNCTION sensible.bloquear_cambios();

insert into sensible.escala_fatiga values (1, 1, 7, 'Totalmente alerta', 'Agotado/a', true);
