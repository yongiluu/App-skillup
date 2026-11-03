# SkillUp · Base de datos

Responsable: Maximiliano · Rama: `database/esquema-inicial`

La base de datos vive en **Supabase** (PostgreSQL). Piensa en ella como un Excel en internet con varias hojas conectadas entre sí, que el backend lee y escribe.

## Qué hay en esta carpeta

```
database/
├── migrations/
│   └── 0001_esquema_inicial.sql   # crea todas las hojas (tablas) y sus reglas
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

## Las hojas, en simple

| Hoja | Qué guarda |
|---|---|
| local | Cada sucursal de la cervecería |
| rol | Puestos de trabajo |
| empleado | Ficha: rol principal y de respaldo, contrato, fecha de ingreso, preferencia y distancia al trabajo |
| empleado_rol | Otros roles que cada persona sabe cubrir |
| usuario | Login de la app (perfil `jefe_turno` o `empleado`, contraseña cifrada) |
| servicio | Cada bloque de atención (fecha + franja), con su demanda prevista y dotación requerida total |
| servicio_requerimiento | Detalle por rol de cuánta gente necesita cada servicio |
| turno | Quién trabaja en qué servicio, con qué rol, horas programadas y horas extra |
| ausencia | Faltas, motivo general, horas y si fueron con aviso corto |
| prediccion | Probabilidad de déficit (total y por rol), dotación predicha, recomendación y nivel de riesgo |
| calendario_dia | Ventanas de pago, feriados, vísperas y fines de semana largos |
| evento | Partidos, conciertos, promociones del local |
| solicitud_cambio | Pedidos de cambio de turno y su resolución |

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
- Etapa 2: cargar los datos simulados (seed).
- Etapa 3: permisos por perfil, índices extra, respaldos y guardar los intentos de login (la hoja `usuario` con contraseña en hash ya existe).
