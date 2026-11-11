# SkillUp · Base de datos

Responsable: Maximiliano · Rama: `database/esquema-inicial`

La base de datos vive en **Supabase** (PostgreSQL). Piensa en ella como un Excel en internet con varias hojas conectadas entre sí, que el backend lee y escribe.

## Qué hay en esta carpeta

```
database/
├── migrations/
│   ├── 0001_esquema_inicial.sql   # crea todas las hojas (tablas) y sus reglas
│   ├── 0002_cuenta_backend_y_login.sql  # etapa 3: cuenta del backend e intentos de login
│   ├── 0003_reemplazo_acepta_y_mover_turno.sql  # solicitudes: el reemplazo acepta y el turno se mueve
│   ├── 0004_propuesto_en_y_rechazos.sql         # cuándo se propuso al reemplazo y quiénes rechazaron
│   └── 0005_franjas_luthier.sql                 # franjas del horario de Luthier (sale 11_13, entra 23_cierre)
├── seed/                          # semilla: datos SIMULADOS para la demo
│   ├── generar_semilla.py         # genera los 3 archivos SQL desde backend/app/mocks/
│   ├── 01_datos_base.sql
│   ├── 02_turnos.sql
│   └── 03_bienestar.sql
└── README.md                      # esta guía
```

Cada cambio futuro al esquema va en un archivo nuevo numerado (`0002_...sql`, `0003_...sql`). Una vez que un archivo entra a `main`, no se edita: se corrige con uno nuevo.

## Alineado con el backend

Los nombres y valores coinciden con la API de Diego (`backend/app/schemas.py` y `backend/app/mocks/`), para que en la etapa 2 los datos de ejemplo se carguen tal cual:

- ID de empleado en texto (`RST_001`).
- Contrato: `full_time`, `part_time`, `weekend_only`. Preferencia: `midday`, `evening`, `mixed`.
- 8 roles: garzón, cocinero de línea y jefe de turno (críticos), más runner, host, cajero, ayudante de cocina y copero.
- Motivo de ausencia: solo `personal` o `salud`, nunca el diagnóstico.
- Bienestar en una sola hoja `bienestar_diario`, una fila por persona y día, con los mismos nombres de columnas que el backend (encuesta de fatiga en escala 1 a 7).
- Eventos con varias franjas, impacto esperado y notas.

Se probó cargando todos los datos de ejemplo del backend (86 empleados, 140 servicios, 2.797 turnos, 2.485 días de bienestar) y entran sin problemas.

## Cómo crear la base desde cero (una sola vez)

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto: nombre `skillup`, región São Paulo. Guarda la contraseña de la base en un lugar privado.
2. Abre **SQL Editor**, crea un *snippet* nuevo, pega todo `migrations/0001_esquema_inicial.sql` y aprieta **Run**.
3. Revisa en **Table Editor** que estén las 13 hojas de `public` y las 4 de `sensible` (se cambia arriba a la izquierda, en "schema").
4. Invita al equipo desde la configuración de la organización (sección de miembros).
5. Con el botón **Connect** → *Direct* → *Session pooler* obtienes la `DATABASE_URL`. Se comparte por un canal privado, nunca en el repo (es público).

## Cargar los datos simulados (semilla)

Para la demo, la base se llena con los datos de ejemplo del backend (nombres ficticios): 86 empleados (simulación v3 de Diego, horario de Luthier), 140 servicios (2025-09-29 a 2025-11-02, "hoy" = 2025-10-17), 2.797 turnos, 71 consentimientos y 2.485 días de bienestar. Franjas: 13_15, 19_21, 21_23 y 23_cierre.

1. En el **SQL Editor**, un *snippet* nuevo por archivo, en este orden: `seed/01_datos_base.sql`, `seed/02_turnos.sql` y `seed/03_bienestar.sql`. Cada uno se pega completo y se ejecuta con **Run**.
2. Cada archivo se carga entero o no se carga nada. Si ya se había cargado, avisa y no duplica.
3. Se carga sobre el esquema recién creado (`migrations/`). Para **recargarla** sobre una base que ya tiene datos, primero hay que vaciar las tablas de datos (sin borrar las tablas), incluida `solicitud_rechazo`.

Decisiones (las mismas que `backend/scripts/cargar_mocks_en_bd.py`, por lo que ambos cargan exactamente lo mismo):
- Si los mocks traen turnos repetidos (misma persona dos veces en un servicio), se omiten y queda el primero.
- `fecha_ingreso` se calcula desde la antigüedad en años de los mocks.
- Solo hay bienestar de quien dio consentimiento.
- Usuarios demo `jefe` (RST_055, Catalina Flores) y `empleado` (RST_056, Cristóbal Silva) con un hash de relleno que no sirve para entrar: el login demo usa `DEMO_PASSWORD` en el backend.

Si cambian los mocks: desde la raíz del repo, `python database/seed/generar_semilla.py` (solo usa la librería estándar) y se suben los archivos nuevos.

## Etapa 3: cuenta del backend e intentos de login

`migrations/0002_cuenta_backend_y_login.sql` agrega:

- **Cuenta `skillup_backend`** para que el backend no use `postgres` (que puede hacer de todo). Puede leer y escribir datos, pero no crear, borrar ni vaciar tablas. En `registro_acceso` solo agrega filas. En `bienestar_diario` puede borrar (derecho a eliminar los datos propios). En `consentimiento` no borra: revocar es llenar `revocado_en`.
- **Reglas RLS `acceso_backend`** en las 18 hojas: dejan pasar solo a esa cuenta. La clave pública sigue sin ver nada.
- **Hoja `intento_login`** (usuario, si acertó y cuándo) y columna **`usuario.bloqueado_hasta`**, para que el bloqueo tras 5 intentos fallidos sobreviva a un reinicio del backend.

**Cómo aplicarla en Supabase**

1. SQL Editor → snippet nuevo → pegar `0002_cuenta_backend_y_login.sql` → Run.
2. **Ponerle contraseña a la cuenta** en otro snippet nuevo (este paso NO se guarda ni se sube):
   `alter role skillup_backend with password 'UNA-CONTRASEÑA-LARGA-Y-NUEVA';`
   Después de ejecutarlo, borra ese snippet.
3. Comprobar: `select count(*) from pg_policies where policyname = 'acceso_backend';` debe dar **18**.
4. La nueva `DATABASE_URL` es la misma de siempre (Session pooler), cambiando el usuario `postgres.<id-del-proyecto>` por `skillup_backend.<id-del-proyecto>` y la contraseña por la nueva. Se le pasa a Diego por privado.

El backend sigue funcionando como antes hasta que Diego cambie su `DATABASE_URL`. Si una tabla nueva (`0003`, …) debe usarla el backend, su migración tiene que darle permisos a `skillup_backend` y crear su regla `acceso_backend`.

## Solicitudes de cambio: el reemplazo acepta y el turno se mueve

`migrations/0003_reemplazo_acepta_y_mover_turno.sql` (decidido por Maxi). Ya está en `main` junto con su backend.

1. El empleado pide el cambio y propone un reemplazo. `respuesta_reemplazo` queda en `pendiente`.
2. El reemplazo responde `aceptada` o `rechazada` (se guarda `respondida_en`). Si rechaza, la solicitud sigue pendiente y se puede proponer a otra persona: al cambiar `reemplazo_id`, la respuesta vuelve a `pendiente`.
3. El jefe **solo puede aprobar si el reemplazo aceptó y sigue disponible**. Si nadie acepta, solo puede rechazar.
4. Al aprobar, el turno pasa al reemplazo en el mismo paso (mismo servicio y rol). Una solicitud resuelta ya no se modifica.
5. **Disponible** = sabe hacer el rol, no trabaja ya en ese servicio, no está ausente ese día y no supera `max_dias_seguidos` (hoja `configuracion`, por defecto 6, [PENDIENTE CERVECERÍA]).
6. Solo puede haber una solicitud pendiente por persona y turno.

La función `motivo_no_disponible(reemplazo, solicitante, fecha, franja)` devuelve el motivo en palabras (o vacío si está disponible), para que la app lo muestre antes de aceptar.

**`migrations/0004_propuesto_en_y_rechazos.sql`** (borrador de Diego, revisado y probado por Maxi), para el boceto de Cata (J1 "Sin respuesta hace 3 h" y J2 "Ya dijo que no puede"):
- `solicitud_cambio.propuesto_en`: se llena solo al proponer a alguien (al crear o al cambiar de reemplazo) y nadie lo cambia a mano.
- Tabla `solicitud_rechazo` (solicitud, empleado y hora): se agrega una fila sola cada vez que un reemplazo rechaza. El backend solo puede leer y agregar, no modificar ni borrar.

En Supabase se aplican en orden: primero `0003` y después `0004`.

**`migrations/0005_franjas_luthier.sql`** (borrador de Diego, revisado y probado por Maxi): horario de Luthier. Sale la franja `11_13` (antes de abrir) y entra `23_cierre` (termina a la 01:00, o a las 02:00 viernes y sábado). Cambia las reglas de franja de `servicio`, `solicitud_cambio` y `evento`. Si queda alguna fila con `11_13`, falla sin cambiar nada: por eso se aplica con los datos vacíos y después se carga la semilla v3. [PENDIENTE CERVECERÍA]: horario del domingo.

## Las hojas, en simple

| Hoja | Qué guarda |
|---|---|
| local | Cada sucursal de la cervecería |
| rol | Puestos de trabajo |
| empleado | Ficha: rol principal y de respaldo, contrato, fecha de ingreso, preferencia y distancia al trabajo |
| empleado_rol | Todos los roles que cada persona sabe hacer, incluido el principal (acordado con el backend; el comentario de `0001` dice "rol extra", vale esta definición) |
| usuario | Login de la app (perfil `jefe_turno` o `empleado`, contraseña cifrada) |
| servicio | Cada bloque de atención (fecha + franja), con su demanda prevista y dotación requerida total |
| servicio_requerimiento | Detalle por rol de cuánta gente necesita cada servicio |
| turno | Quién trabaja en qué servicio, con qué rol, horas programadas y horas extra |
| ausencia | Faltas, motivo general, horas y si fueron con aviso corto |
| prediccion | Probabilidad de déficit (total y por rol), dotación predicha, recomendación y nivel de riesgo |
| calendario_dia | Ventanas de pago, feriados, vísperas y fines de semana largos |
| evento | Partidos, conciertos, promociones del local |
| solicitud_cambio | Pedidos de cambio de turno, respuesta del reemplazo (y cuándo se propuso) y resolución del jefe |
| solicitud_rechazo | Quiénes rechazaron ser reemplazo en cada solicitud |
| configuracion | Valores ajustables (ej: máximo de días seguidos) |
| intento_login | Intentos de entrar a la app (para el bloqueo tras 5 fallidos) |

**Carpeta `sensible` (datos protegidos)**

| Hoja | Qué guarda |
|---|---|
| consentimiento | Si cada persona aceptó compartir sus datos de bienestar, cuándo y si lo revocó |
| escala_fatiga | La escala de la encuesta, con versiones (hoy: 1 a 7, preliminar) |
| bienestar_diario | Por persona y día: pasos, horas de sueño, pulso medio y encuesta de fatiga al inicio y al final |
| registro_acceso | Quién consultó datos de bienestar y cuándo (no se puede borrar) |

## Reglas automáticas que ya trae

- **Riesgo:** `prediccion.nivel_riesgo` se calcula solo: alerta desde 0,55 y alto desde 0,75.
- **Consentimiento:** no se puede guardar nada en `bienestar_diario` de alguien sin consentimiento vigente.
- **Encuestas:** la respuesta debe estar dentro de la escala.
- **Auditoría:** el registro de accesos solo acepta filas nuevas.
- **Sin duplicados:** nadie puede estar dos veces en el mismo servicio.
- **Seguridad:** ninguna hoja se puede leer desde internet con la clave pública de Supabase. Solo el backend, con la `DATABASE_URL` (o la clave secreta *service_role*), tiene acceso. Los permisos por perfil quedan para la etapa 3.

## Variables del PDF que NO están, a propósito

IMC/peso, género, número de hijos, tabaquismo, nivel educacional y sensores complejos (sudor, temperatura, SpO2).

## Pendientes

- [PENDIENTE CERVECERÍA] Roles reales del local y requerimientos por rol (los datos de ejemplo solo traen el total).
- [PENDIENTE CERVECERÍA] Texto del consentimiento y su revisión legal antes de usar datos reales.
- Escala de fatiga 1 a 7 preliminar. Si cambia, se agrega una versión nueva en `escala_fatiga`.
- Etapa 3: respaldos (pendiente de revisar qué ofrece el plan de Supabase).
