# SkillUp · Base de datos

Responsable: Maximiliano · Rama: `database/esquema-inicial`

La base de datos vive en **Supabase** (PostgreSQL). Piensa en ella como un Excel en internet con varias hojas conectadas entre sí, que el backend lee y escribe.

## Qué hay en esta carpeta

```
database/
├── migrations/
│   ├── 0001_esquema_inicial.sql   # crea todas las hojas (tablas) y sus reglas
│   └── 0002_cuenta_backend_y_login.sql  # etapa 3: cuenta del backend e intentos de login
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

Se probó cargando todos los datos de ejemplo del backend (72 empleados, 140 servicios, 2.493 turnos, 2.065 días de bienestar) y entran sin problemas, salvo 12 turnos simulados donde una persona tiene dos roles en el mismo servicio (ver Pendientes).

## Cómo crear la base desde cero (una sola vez)

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto: nombre `skillup`, región São Paulo. Guarda la contraseña de la base en un lugar privado.
2. Abre **SQL Editor**, crea un *snippet* nuevo, pega todo `migrations/0001_esquema_inicial.sql` y aprieta **Run**.
3. Revisa en **Table Editor** que estén las 13 hojas de `public` y las 4 de `sensible` (se cambia arriba a la izquierda, en "schema").
4. Invita al equipo desde la configuración de la organización (sección de miembros).
5. Con el botón **Connect** → *Direct* → *Session pooler* obtienes la `DATABASE_URL`. Se comparte por un canal privado, nunca en el repo (es público).

## Cargar los datos simulados (semilla)

Para la demo, la base se llena con los datos de ejemplo del backend (nombres ficticios): 72 empleados, 140 servicios (2025-09-29 a 2025-11-02, "hoy" = 2025-10-17), 2.481 turnos, 181 ausencias, 26 eventos, 59 consentimientos y 2.065 días de bienestar.

1. En el **SQL Editor**, un *snippet* nuevo por archivo, en este orden: `seed/01_datos_base.sql`, `seed/02_turnos.sql` y `seed/03_bienestar.sql`. Cada uno se pega completo y se ejecuta con **Run**.
2. Cada archivo se carga entero o no se carga nada. Si ya se había cargado, avisa y no duplica.
3. Se carga sobre el esquema recién creado (`migrations/0001_esquema_inicial.sql`).

Decisiones (las mismas que `backend/scripts/cargar_mocks_en_bd.py`, por lo que ambos cargan exactamente lo mismo):
- Se omiten los 12 turnos repetidos de los mocks (queda el primero).
- `fecha_ingreso` se calcula desde la antigüedad en años de los mocks.
- Solo hay bienestar de quien dio consentimiento.
- Usuarios demo `jefe` (RST_008) y `empleado` (RST_001) con un hash de relleno que no sirve para entrar: el login demo usa `DEMO_PASSWORD` en el backend.

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
| solicitud_cambio | Pedidos de cambio de turno y su resolución |
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

- **Para Diego:** 12 turnos de `mocks/turnos.json` tienen a la misma persona en dos roles en el mismo servicio (ej: RST_039 como garzón y host el 2025-09-29, 13–15). La base no lo acepta; hay que corregir esos datos simulados.
- [PENDIENTE CERVECERÍA] Roles reales del local y requerimientos por rol (los datos de ejemplo solo traen el total).
- [PENDIENTE CERVECERÍA] Texto del consentimiento y su revisión legal antes de usar datos reales.
- Escala de fatiga 1 a 7 preliminar. Si cambia, se agrega una versión nueva en `escala_fatiga`.
- Etapa 3: respaldos (pendiente de revisar qué ofrece el plan de Supabase).
