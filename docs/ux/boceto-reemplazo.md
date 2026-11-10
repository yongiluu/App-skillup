# Notas de diseño · Cambio de turno y reemplazo (E3, E4, J1 y J2)

**Responsable:** Catalina (UX e investigación con usuarios)
**Para programar:** Manuel (frontend)
**Estado:** borrador para revisión del equipo
**Bocetos:** lienzo "SkillUp · Boceto cambio de turno y reemplazo" (https://claude.ai/artifact/3sQTCKbc4S1NWS4ZBm4ZFJ). Este documento no repite las pantallas: explica las decisiones y las reglas que el dibujo no muestra.

---

## 1. Qué pantalla es cuál

| Pantalla | Quién | Para qué |
|---|---|---|
| E1 | Empleado | Pedir cambio (selector solo con disponibles, AP-03) |
| E2 | Empleado | Mis solicitudes (las que pidió) |
| **E3** | Empleado propuesto | "Me propusieron como reemplazo": acepta o rechaza |
| **E3b** | Empleado propuesto | Ya respondió: ve su respuesta y puede cambiarla mientras el jefe no decida |
| **E4** | Empleado propuesto | Confirmar que acepta |
| **J1** | Jefe | Bandeja de solicitudes, con el estado de cada una |
| **J2** | Jefe | Proponer reemplazo entre los disponibles |

Aclaración de nombres: en el chat del equipo "E1" se ha usado para la pantalla donde el reemplazo acepta o rechaza. En el lienzo esa pantalla es **E3** (con la confirmación E4). Conviene usar los nombres del lienzo.

## 2. Por qué es lo más urgente

Con la API real, el jefe solo puede aprobar un cambio si el reemplazo aceptó. Sin E3 nadie puede aceptar, así que el jefe puede rechazar pero no aprobar. Flujo completo:

empleado pide el cambio → **reemplazo acepta o rechaza (E3, E4)** → jefe aprueba o rechaza (J1) → el turno pasa al reemplazo.

## 3. E3, E3b y E4 · El reemplazo responde

**De dónde salen los datos:** el reemplazo ve sus solicitudes en el mismo `GET /solicitudes-cambio`. A un empleado le devuelve las que pidió y aquellas donde lo proponen como reemplazo. E3 muestra las que tienen `reemplazo_id` = la persona y siguen pendientes (lectura del código por Manuel; falta que Diego lo confirme).

**Dónde vive:** en Solicitudes, bloque "Te propusieron como reemplazo". La pestaña "Solicitudes" lleva un indicador numérico cuando hay una petición sin responder. Hoy no existen los avisos, así que este indicador es la única forma de que la persona se entere.

**Botones:** "Acepto" y "No puedo", con el mismo peso visual (los dos con borde, sin relleno) para no empujar a aceptar. Tamaño táctil mínimo de 44 px.

**Cambiar la respuesta (E3b):** se puede mientras la solicitud siga pendiente y la persona siga siendo el reemplazo propuesto. Puede pasar de "No puedo" a "Acepto" y al revés. Cuando el jefe aprueba o rechaza, ya no se puede. Si proponen a otra persona, la tarjeta desaparece.
- Tras aceptar: etiqueta "Aceptaste", texto "Esperando la decisión del jefe de turno. El turno pasa a ser tuyo solo cuando lo apruebe. Puedes cambiar tu respuesta hasta que el jefe decida." y botón **"Ya no puedo cubrirlo"**.
- Tras rechazar: etiqueta "Dijiste que no", texto "No tienes que dar explicaciones. Puedes cambiar tu respuesta hasta que el jefe decida." y botón **"Sí puedo cubrirlo"**, que pasa por E4.
- Los botones nombran la acción concreta en vez de un genérico "Cambiar mi respuesta".

**Confirmación (E4):** al tocar "Acepto" (o "Sí puedo cubrirlo") se pide confirmar. Se mantiene: aunque la respuesta se puede cambiar, el jefe puede aprobar en cualquier momento, y desde ahí el turno pasa a la persona.

**Estados:**

| Situación | Texto sugerido |
|---|---|
| Aceptó | "Aceptaste. Esperando la decisión del jefe de turno. Puedes cambiar tu respuesta hasta que el jefe decida." |
| Rechazó | "Dijiste que no. No tienes que dar explicaciones. Puedes cambiar tu respuesta hasta que el jefe decida." |
| El jefe aprobó | "El jefe de turno lo aprobó. Ahora el turno es tuyo." (sin botón para cambiar) |
| El jefe no lo aprobó | "El jefe de turno no aprobó el cambio. Tu turno sigue como estaba." (sin botón) |
| Propusieron a otra persona | La tarjeta desaparece de la lista. |

Cada estado lleva color, ícono y palabra.

**Si la API responde "No puede aceptar: <motivo>":**
- Mostrar el motivo en lenguaje normal dentro de la tarjeta, no como error técnico.
- Dejar solo la opción "No puedo".
- Texto sugerido: "No puedes cubrir este turno: <motivo>. Puedes responder que no."
- Si el motivo es una ausencia, decir solo "Estás ausente ese día", sin tipo ni diagnóstico (regla de la migración 0003).

## 4. J1 · Estado de cada solicitud (jefe)

| Estado | Texto | Dato de la API |
|---|---|---|
| Sin reemplazo | "No propuso a nadie: te toca proponer a alguien." | `respuesta_reemplazo` nulo |
| Esperando | "Sin respuesta hace 3 h" | `propuesto_en` |
| Aceptó | "El reemplazo aceptó" | `respuesta_reemplazo = aceptada`, `respondida_en` |
| Rechazó | "El reemplazo no puede" | `respuesta_reemplazo = rechazada` |

- **"Aprobar" solo existe o está activo cuando el reemplazo aceptó.** Así el jefe nunca llega al mensaje de error "Solo se puede aprobar si un reemplazo aceptó…", que hoy es lo que ve.
- **Si el reemplazo cambia su respuesta justo antes de aprobar,** la API puede responder 409. La tarjeta se refresca y lo dice en claro: "Ignacia cambió su respuesta: ya no puede cubrirlo." Nada de errores técnicos.
- "Rechazar" siempre disponible.
- Junto al "hace X" conviene mostrar cuánto falta para el turno ("el turno es en 3 días"): para decidir importa más que el tiempo transcurrido.

## 5. J2 · Proponer reemplazo

- Lista de `/disponibles` (el jefe ve a todos, con motivo en los no disponibles).
- Junto a cada persona, solo el **nivel** de fatiga (nunca datos), ordenado de menor a mayor. "Sin indicador" no se favorece ni se perjudica.
- **"Ya dijo que no puede"** a partir de `rechazaron[]`. `/disponibles` no excluye a quien ya rechazó, porque no sabe de qué solicitud se trata (lectura de Manuel). Quien rechazó sigue en la lista, marcado, para poder volver a pedírselo si cambian las cosas.
- Decisión abierta: hoy esa persona aparece en su lugar por fatiga. Propuesta alternativa: llevarla al final para que el jefe no la proponga sin querer. Con la marca puede bastar.
- El orden por fatiga depende de que el texto del consentimiento lo diga (AP-15) [PENDIENTE CERVECERÍA / revisión legal].

## 6. Reglas de privacidad

1. No se pide motivo al rechazar.
2. No se muestra al reemplazo el "motivo" del solicitante. Es un campo libre (hasta 300 caracteres) que puede contener datos personales o de salud.
3. No se muestra la fatiga del reemplazo en E3, E3b ni E4. Es información del jefe.
4. El reemplazo no ve a quién más se le propuso ni quién rechazó antes.
5. El empleado ve solo a los disponibles y sin motivos; el jefe ve a todos.

**No basta con no mostrarlo (AP-21):** hoy `GET /solicitudes-cambio` le entrega al reemplazo el motivo del solicitante y `rechazaron[]`. El frontend no los muestra, pero viajan en la respuesta y se ven con las herramientas del navegador. Diego debe vaciarlos cuando consulta el reemplazo.

## 7. Accesibilidad

- Al responder, el foco pasa a la tarjeta actualizada y el resultado se anuncia solo (`role="status"`).
- Los estados no dependen del color.
- Botones reales con nombre accesible completo ("Acepto cubrir el turno de Cristóbal Silva del 17 de octubre").
- Probar en 360 px, modo oscuro y texto ampliado.

## 8. Cómo se verifica con usuarios

Tareas:
- *"Te acaban de pedir que cubras el turno de un compañero. Respóndele que sí."*
- *"Te surgió algo: avísale que ya no puedes."*
- Para el jefe: *"Aprueba el cambio que ya aceptó su reemplazo."*

Observar:
- ¿Encuentra la petición sin ayuda?
- ¿Entiende que aceptar no significa que el turno ya es suyo?
- ¿Descubre que puede cambiar su respuesta, y entiende hasta cuándo?
- ¿Duda entre los dos botones?
- El jefe, ¿entiende por qué no puede aprobar una solicitud que aún no se aceptó?

## 9. Pendientes de confirmar

| # | Pregunta | Estado | Quién |
|---|---|---|---|
| 1 | ¿Qué endpoint entrega al reemplazo sus solicitudes? | Respondido por Manuel según el código: el mismo `GET /solicitudes-cambio`. Falta que Diego lo confirme. | Diego |
| 2 | ¿Se puede cambiar la respuesta después de enviarla? | Respondido por Manuel: sí, mientras esté pendiente. Falta que Diego lo confirme. | Diego |
| 3 | ¿`/disponibles` excluye a quienes ya rechazaron? | Respondido por Manuel: no; se usa `rechazaron[]`. Falta que Diego lo confirme. | Diego |
| 4 | Vaciar `motivo` y `rechazaron[]` para el reemplazo (AP-21). | Pendiente | Diego |
| 5 | ¿El reemplazo ve el motivo del solicitante? Propuesta: no. | Pendiente | Equipo |
| 6 | Datos del lienzo: pasar a la simulación v3 (cantidad de disponibles y días seguidos en J2; turno de Ignacia de 13:00 a 15:00). | Pendiente | Cata, Diego |
| 7 | AP-20: el 19–21 del 17-10 sale "Riesgo bajo" (35 %) con el único jefe de turno ausente, y el texto dice "faltan cocinero de línea" aunque quedan 5 de 6. | Registrado en la evaluación | Diego y Maxi (nivel), Diego (texto), cervecería (requeridos por rol) |
| 8 | Peso visual de "Acepto" y "No puedo". | Decidido: mismo peso (09-11). | Cata |
| 9 | Textos finales a confirmar con el equipo y, los que toquen datos personales, con la cervecería. | Pendiente | Equipo |

## 10. Cambios hechos en el lienzo

**09-11, primera ronda**
- E3 y E4: la franja de 11:00 pasó a 13:00 (Luthier abre a las 13:00).
- E3: quitado "Te avisaremos cuando el turno sea tuyo" (los avisos aún no existen).
- E3: "Todavía no pides cambios" pasó a "Todavía no has pedido cambios" (AP-14).
- Nota de pendientes: J1 y J2 ya pueden usar `propuesto_en` y `rechazaron[]` (migración 0004).

**09-11, segunda ronda**
- Nueva pantalla **E3b** ("Ya respondí"): estado aceptado con "Ya no puedo cubrirlo". La variante de rechazo está en una nota al lado.
- Nota de pendientes: respuestas de Manuel según el código y aviso de privacidad (AP-21).
- E3: "Acepto" y "No puedo" con el mismo peso visual (antes "Acepto" iba relleno).
