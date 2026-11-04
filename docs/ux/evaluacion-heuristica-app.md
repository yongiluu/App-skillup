# Evaluación heurística (Nielsen) · App SkillUp con el diseño del kit v14

**Responsable:** Catalina (UX e investigación con usuarios)
**Rama:** `docs/ux-catalina`
**Estado:** revisado por Cata (los 14 hallazgos tienen decisión; ver la sección 9)
**Fecha:** 03-11-2026

---

## Resumen: qué se puede cambiar ahora

**Se pueden hacer ya (solo frontend, Manuel):**
- **AP-06 · Equipo:** agregar buscador por nombre, filtro por rol y orden alfabético.
- **AP-09 · Hoy:** que "Llamar" y "Mover" abran la ficha de la persona.
- **AP-05 · Equipo:** cambiar "Sin consentimiento" por una palabra más suave (propuesta: "Sin indicador"; confirmar con el equipo).
- **AP-07 · Planificador:** usar colores que se distingan mejor en los puntos del calendario.
- **AP-12 · Bienestar:** poner la explicación de la escala de cansancio antes de la tabla, más destacada.
- **AP-14 · Solicitudes:** cambiar "Todavía no pides cambios" por "Todavía no has pedido cambios".

**Urgente, pero depende de backend:**
- ~~AP-03 · Pedir cambio: mostrar solo a quienes están disponibles.~~ **Resuelto:** el endpoint `/disponibles` ya está (Diego, 04-11). Pendiente que Manuel lo conecte.

**Por conversar antes de cambiar:**
- **AP-01:** respuesta de Diego abajo (sección 9); falta confirmar si se ajusta la alerta visual.
- **AP-04:** el retiro de la autorización ya está (Diego, 04-11). Falta la decisión con la cervecería sobre los datos ya guardados.
- **AP-11:** revisar en un celular real si conviene poner el turno antes que la fatiga.

---

## 1. Objetivo

Detectar problemas de usabilidad en la app con la que trabaja el equipo, antes de la prueba con usuarios del piloto, para la vista del **jefe de turno** y la del **trabajador**, en **computador** y **celular**.

## 2. Qué se evaluó y qué no

- **Se evaluó:** la app de la rama `frontend/diseno-kit` (kit enviado a Cata el 03-11), corriendo con datos simulados (`VITE_USAR_MOCKS=true`). "Hoy" es el 17-10-2025. Usuarios: `jefe` (Catalina Flores) y `empleado` (Cristóbal Silva, garzón).
  - Celular: 390 px de ancho. Computador: 1366 px.
  - Pantallas: Login · Jefe: Hoy, Planificador, Equipo, ficha de una persona y Solicitudes · Trabajador: Mis turnos (con "Pedir cambio"), Solicitudes y Bienestar · modo claro y oscuro.
- **No se evaluó:**
  - Las funciones que aún no existen (el reemplazo que acepta o rechaza, turnos extra y avisos). Esas pantallas se están diseñando aparte.
  - El backend real: con datos simulados, algunas reglas (como la de disponibilidad) todavía no se aplican.
- **Antecedente:** antes se evaluó la demo Luthier (`evaluacion-heuristica-demo.md`). La sección 6 resume qué pasó con esos hallazgos en la app real.
- **Limitación de método:** Nielsen recomienda entre 3 y 5 evaluadores. Se sugiere una segunda pasada independiente (por ejemplo, de Manuel).

## 3. Método

Se recorrieron las tareas principales de cada perfil y se registró cada problema según la heurística que incumple.

| Perfil | Tarea |
|---|---|
| Jefe | Ver qué servicio necesita atención hoy y por qué |
| Jefe | Revisar la semana en el Planificador |
| Jefe | Buscar a una persona del equipo y ver su ficha |
| Jefe | Revisar y aprobar una solicitud de cambio |
| Trabajador | Ver mi turno de hoy y mi semana |
| Trabajador | Pedir un cambio de turno y seguir la solicitud |
| Trabajador | Ver mi fatiga y mis datos de bienestar |

**Heurísticas:** H1 Visibilidad del estado · H2 Relación con el mundo real · H3 Control y libertad · H4 Consistencia y estándares · H5 Prevención de errores · H6 Reconocer antes que recordar · H7 Flexibilidad y eficiencia · H8 Diseño estético y minimalista · H9 Recuperarse de errores · H10 Ayuda y documentación.

**Severidad (Nielsen):** 0 no es problema · 1 cosmético · 2 menor · 3 mayor (arreglar antes de la prueba con usuarios) · 4 catastrófico.

---

## 4. Hallazgos

### Resumen

| Severidad | Cantidad |
|---|---|
| 3 · Mayor | 4 |
| 2 · Menor | 7 |
| 1 · Cosmético | 3 |
| **Total** | **14** |

### Detalle

| ID | Heur. | Perfil · dispositivo | Problema | Sev. | Recomendación | Captura |
|---|---|---|---|---|---|---|
| AP-01 | H1 · H2 | Jefe · ambos | Servicios con **más personas que las requeridas** aparecen en "Riesgo alto" y con "busca reemplazo ya". Ejemplo: 13–15 tiene "25 de 23 programados" y riesgo alto de 87 %; 21–23, "13 de 12" y 87 %. El número grande en rojo y la barra llena dicen "está completo", pero la alerta dice "falta gente". El riesgo viene de un rol específico (jefe de turno 75 %, garzón 71 %), y eso solo se entiende cruzando con "Riesgo por rol". Lo mismo pasa en la cifra "Crítico 13–15: 25 de 23" y en el Planificador. **Resuelto (Manuel, 04-11).** | 3 | Encabezar la alerta con el rol en riesgo ("Riesgo alto en jefe de turno · 75 %") y mostrar "25 de 23" en color neutro, aclarando que el total alcanza pero puede faltar un rol. | `app-pc_jefe_hoy.png`, `app-pc_jefe_planificador.png` |
| AP-02 | H4 · H8 | Jefe · celular | **Hoy se desborda hacia el lado.** La página mide 505 px en una pantalla de 390 px: las tarjetas quedan cortadas y en la barra inferior la pestaña "Solicitudes" aparece cortada. La causa es la tabla "Riesgo por rol": su contenedor tiene desplazamiento propio, pero no tiene el ancho limitado. | 3 | Limitar el ancho del contenedor de la tabla (`min-width: 0` / `max-width: 100%`) para que solo la tabla se desplace hacia el lado. Revisar las demás pantallas en 360–390 px. | `app-mob_jefe_hoy_rol.png` |
| AP-03 | H5 | Trabajador · celular | En "Pedir cambio", el selector "¿Quién te podría cubrir?" muestra a **30 personas** (todas las que saben el rol), incluidas las que no pueden: ausentes, que ya trabajan en ese servicio o que pasarían de 6 días seguidos. Con datos simulados se pudo proponer a Agustín Díaz, que quedaría con 7 días seguidos. **Resuelto (04-11):** Diego ya hizo `/disponibles`. | 3 | Mostrar solo a los disponibles (`GET /disponibles`, regla de la migración 0003), como en el boceto E1. Falta que Manuel lo conecte en el frontend. | `app-i_pedir.png` |
| AP-04 | H3 | Trabajador · ambos | En Bienestar, la persona ve que autorizó el uso de sus datos, pero **no puede retirar esa autorización ni borrar sus datos** desde la app. La base ya lo contempla (`revocado_en` y el borrado de `bienestar_diario`). Al ser datos de salud, el control debería estar a la vista. **Resuelto en parte (04-11):** Diego ya hizo el endpoint para retirar la autorización. Falta decidir con la cervecería qué pasa con los datos ya guardados. | 3 | Agregar "Retirar mi autorización" en la pantalla (Manuel). Coordinar con el texto del consentimiento [PENDIENTE CERVECERÍA / revisión legal]. | `app-mob_emp_mi-bienestar.png` |
| AP-05 | Privacidad · H2 | Jefe · computador | En Equipo, el jefe ve la etiqueta **"Sin consentimiento"** junto a cada persona que no autorizó. Así se entera de quién dijo que no, lo que puede presionar a esas personas a autorizar. | 2 | Usar la misma etiqueta neutra para "sin consentimiento" y "sin datos" (por ejemplo, "Sin indicador"). Decidirlo con el equipo, porque toca las reglas de datos de salud. | `app-pc_jefe_equipo.png` |
| AP-06 | H7 | Jefe · computador | Equipo muestra a las 80 personas en tres columnas, **sin buscador, sin filtro por rol y sin orden alfabético**. Encontrar a alguien obliga a recorrer toda la lista. | 2 | Agregar buscador por nombre, filtro por rol y orden alfabético (o por nivel de fatiga). | `app-pc_jefe_equipo.png` |
| AP-07 | H4 | Jefe · computador | En el calendario del Planificador, pago o quincena, feriado o víspera y evento se distinguen **solo por el color del punto**. Incumple la regla del equipo (color + ícono + palabra) y no sirve para personas que no distinguen colores. | 2 | Usar marcas con forma o letra distinta, o etiquetas cortas como en la grilla semanal ("Pago", "Evento"). | `app-pc_jefe_planificador.png` |
| AP-08 | H2 · H4 | Jefe · computador | En la ficha, **"Ausencias recientes" muestra fechas futuras** (18-10 y 02-11, con hoy 17-10). Además, la ficha mezcla formatos de fecha: "sáb, 18 oct" en próximos turnos y "18-10-2025" en ausencias. | 2 | Separar "Próximas ausencias" y "Ausencias recientes", y usar un solo formato de fecha. | `app-pc_jefe_ficha.png` |
| AP-09 | H4 · H6 | Jefe · ambos | En "Acciones sugeridas", "Llamar" y "Mover" tienen forma de botón, pero son etiquetas: no hacen nada al tocarlas. | 2 | Darles estilo de etiqueta (sin relieve), o convertirlas en una acción real, como abrir la ficha de la persona. | `app-pc_jefe_hoy.png` |
| AP-10 | H8 | Trabajador · ambos | En Mis turnos, el turno de hoy aparece **tres veces** (Tu turno de hoy, Tu semana y Próximos turnos), y la lista de próximos turnos llega hasta el 02-11 (16 días). "Pedir cambio" no está en "Tu turno de hoy": hay que bajar más allá de la semana para encontrarlo. | 2 | Agregar "Pedir cambio" en la tarjeta "Tu turno de hoy" y acortar "Próximos turnos" a 7 días, con un "Ver más". | `app-mob_emp_mi-turno.png` |
| AP-11 | H8 | Trabajador · celular | "Tu fatiga" va antes de "Tu turno de hoy". Al abrir la app, el turno queda al borde inferior de la pantalla. Es el mismo problema que el hallazgo EH-13 de la demo. | 2 | Poner "Tu turno de hoy" primero. | `app-mob_emp_mi-turno_pliegue.png` |
| AP-12 | H6 | Trabajador · ambos | En Bienestar, la columna "Cansancio" muestra "3 → 4" y solo se entiende leyendo la nota al pie. | 1 | Dividirla en dos columnas: "Al llegar" y "Al salir". | `app-mob_emp_mi-bienestar.png` |
| AP-13 | H2 | Ambos · ambos | Textos técnicos: "texto borrador-v0", "Tests: Pendiente" (sin explicar qué tests) y "Horas extra (7 días): 0,6" (son 36 minutos). | 1 | "Versión del texto: borrador"; "Tests psicológicos: aún no disponibles"; "36 min" o "0,6 h". | `app-pc_jefe_ficha.png` |
| AP-14 | H2 | Trabajador · ambos | "Todavía no pides cambios" suena poco natural. | 1 | "Todavía no has pedido cambios". | — |

---

## 5. Lo que funciona bien

- **Datos simulados siempre visibles:** la franja "Datos simulados · 'hoy' es el 17 de octubre" evita confusiones en la demo.
- **Riesgo con color, ícono y porcentaje** en Hoy, Planificador y Riesgo por rol (cumple la regla del equipo).
- **Privacidad explicada donde corresponde:** "Aquí solo ves el nivel; el detalle lo ve únicamente la persona", y en Bienestar, "Solo tú ves este detalle".
- **Fatiga honesta:** usa el nivel del backend, con su motivo y el aviso "Indicador simple · No es diagnóstico". El anillo queda gris sin consentimiento o sin datos.
- **Respuesta inmediata al pedir un cambio:** "Solicitud enviada… Puedes seguirla en Solicitudes", y el turno queda marcado como "Pendiente".
- **Error de login claro:** "Usuario o contraseña incorrectos".
- **Modo oscuro coherente** en celular y computador.

---

## 6. Qué pasó con los hallazgos de la demo

| Demo | Estado en la app real |
|---|---|
| EH-03 y EH-04 (dónde y cómo se pide un cambio) | **Resueltos:** el cambio se pide desde cada turno. |
| EH-07 y EH-08 (recuperación 0–100 y fórmula técnica) | **Resueltos:** la app usa el nivel de fatiga del backend con explicación simple. |
| EH-09 ("entrenamiento cruzado") | **Resuelto:** la ficha dice "también cubre Garzón". |
| EH-10 y EH-11 (encuesta 1–5) | **No aplica:** la app no tiene encuesta. Al agregarla, recordar que en el backend (escala 1–7) el número mayor es más cansancio. |
| EH-14 (contraste) | **Resuelto:** la app usa colores más oscuros, con contraste AA. |
| EH-13 (fatiga antes que el turno) | **Persiste:** ver AP-11. |
| EH-02 y EH-12 (propuesta de cambio y confirmación) | **Pendientes:** se resuelven en el boceto de reemplazo. |
| EH-01, EH-06, EH-15 a EH-19 | **No aplican:** esas pantallas o datos no existen en la app real. |

---

## 7. Notas para el equipo

1. **"Demanda prevista" sigue en Hoy.** Según `decisiones-frontend-etapa-4.md`, ese gráfico se sacó en la revisión del equipo, pero aparece en la versión del kit. Hay que confirmar con Manuel cuál es la versión vigente.
2. **Días seguidos en los datos simulados.** Cristóbal trabaja del 17-10 al 26-10 (10 días seguidos), más que el máximo de 6 de la regla [PENDIENTE CERVECERÍA]. Ya está anotado en las decisiones del backend. En la prueba con usuarios conviene que los datos no contradigan la regla.
3. **AP-03 y AP-04 ya tienen backend** (Diego, 04-11): `/disponibles` y el endpoint para retirar la autorización. Falta que Manuel los conecte en el frontend.

---

## 8. Próximos pasos

1. ✅ Cata revisó los hallazgos (sección 9).
2. Segunda evaluación independiente y unión de resultados.
3. Con Manuel: conectar AP-03 y AP-04 (endpoints ya listos) antes de la prueba con usuarios, y AP-06 y AP-09. Con el equipo y la cervecería: qué pasa con los datos ya guardados al retirar la autorización (AP-04). Con el equipo: el texto de AP-05. AP-01 ya resuelto.
4. Usar esta evaluación como comentario de revisión en el PR de `frontend/diseno-kit`, donde Cata figura como revisora.

## 9. Registro de revisión de Cata

| ID | Estado | Urgencia | Comentario |
|---|---|---|---|
| AP-01 | Resuelto | — | Diego explicó el cálculo (riesgo = probabilidad de que falte gente de un rol, ya con el margen en el texto). Manuel ajustó también la alerta visual. |
| AP-02 | Omitido | — | Cata lo considera un detalle visual. El jefe trabaja sobre todo en el computador. Nota: la corrección es de una línea de código, por si Manuel quiere hacerla al pasar. |
| AP-03 | Resuelto (backend) | Falta conectar en frontend | El endpoint `/disponibles` ya está (Diego, 04-11). |
| AP-04 | Resuelto en parte | Falta la cervecería | El endpoint para retirar la autorización ya está (Diego, 04-11). Queda pendiente con la cervecería qué pasa con los datos ya guardados. |
| AP-05 | Ajustado | Baja | Se mantiene que el jefe sepa si hay indicador o no, pero con palabras más suaves que "Sin consentimiento". Opciones a probar: "Sin indicador", "No comparte datos" o "Indicador no activado". |
| AP-06 | Confirmado | Necesario | Buscador, filtro por rol y orden, para que la lista no se vea tan saturada. |
| AP-07 | Ajustado | Baja | Cambiar los colores de los puntos para que se distingan mejor entre sí. |
| AP-08 | Omitido | — | Las ausencias futuras son ausencias avisadas con anticipación; por eso están registradas. |
| AP-09 | Confirmado | Media | Que "Llamar" y "Mover" abran la ficha de la persona. |
| AP-10 | Omitido | — | Detalle; no es necesario por ahora. |
| AP-11 | En consideración | — | Verificar en un celular real (`npm run dev -- --host`) antes de decidir. |
| AP-12 | Ajustado | Baja | Poner la explicación de la escala antes de la tabla o más destacada. |
| AP-13 | Postergado | — | Los tests psicológicos aún no están definidos y los datos son estáticos; el texto se ajusta cuando existan. |
| AP-14 | Confirmado | Baja | Cambio de texto simple. |

**Resumen:** 4 confirmados, 3 ajustados, 2 pendientes de consulta, 1 en consideración, 1 postergado y 3 omitidos.

## Capturas

Están en `docs/ux/capturas/`, con el prefijo `app-`. Se tomaron en un navegador automático con la app corriendo con datos simulados.
