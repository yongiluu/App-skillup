# SkillUp · Frontend

React 19 + Vite + TypeScript. Responsable: Manuel.

## Cómo levantarlo

```bash
cd frontend
npm install
cp .env.example .env.local   # por defecto usa datos simulados
npm run dev                  # http://localhost:5173
```

- **Con la API de Diego** (por defecto, `VITE_USAR_MOCKS=false`): levanta el backend (`backend/README.md`, con `FUENTE_DATOS=mock` o `supabase`) y usa la contraseña de `DEMO_PASSWORD`, que se comparte por un canal privado.
- **Con datos simulados** (`VITE_USAR_MOCKS=true`): no necesita backend. Ingresa con `jefe` o `empleado` y cualquier contraseña. Las pruebas automáticas usan siempre este modo.
- Catálogo del sistema visual (solo en desarrollo): http://localhost:5173/sistema-visual

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto fijo 5173: el CORS del backend solo permite ese) |
| `npm test` | Pruebas (Vitest + Testing Library) |
| `npm run typecheck` | Revisa tipos |
| `npm run lint` | Lint (oxlint) |
| `npm run build` | Build de producción en `dist/` |

## Estructura

```
src/
├── api/
│   ├── tipos.ts       # Tipos del contrato (copiados de backend/app/schemas.py)
│   ├── cliente.ts     # fetch con token; 401 → login, 403 → "sin permiso"
│   ├── index.ts       # getServicios, getSemana… (mocks o API según .env)
│   └── mocks/         # Respuestas reales de la API de ejemplo (misma forma que el contrato)
├── auth/              # Sesión (token en sessionStorage) y rutas protegidas por perfil
├── components/
│   ├── layout/        # Barra lateral (desktop) / pestañas inferiores (móvil)
│   └── ui/            # Boton, Tarjeta, InsigniaRiesgo, Aviso, Pendiente, Icono…
├── lib/               # riesgo.ts (umbrales), formato.ts, useDatos.ts
├── pages/             # Hoy, Planificador, Equipo, Login, MiTurno, SinPermiso…
├── styles/tokens.css  # TODOS los colores, espacios y tamaños
└── test/
```

## Sistema visual

- Base: demo **SkillUp Luthier** y su **kit de diseño v14** (paleta cervecera: oliva `#55652A`, ámbar y crema;
  cabecera con degradado y patrón de lúpulo; Inter; tarjetas de 18–20 px; íconos de trazo 1,75).
- **Modo oscuro:** automático según el sistema, o con el botón luna/sol de la cabecera (se recuerda en el
  navegador, `lib/tema.ts`).
- Piezas del kit: tarjeta de saludo, avatares con iniciales, cifras del día, riesgo por rol, demanda prevista,
  anillo de fatiga, "Tu turno de hoy" y "Tu semana". **Solo muestran datos que ya entrega la API**: el frontend
  no agrega variables ni cálculos nuevos (el anillo muestra el nivel del backend, no la fórmula ilustrativa del kit).
- Los componentes usan **solo** variables de `styles/tokens.css`; nada de colores sueltos.
- Patrón de lúpulo reutilizable: clase global `con-lupulo` (en `styles/global.css`).
- Los textos de riesgo son un tono más oscuro que los de la demo para cumplir contraste AA (todos ≥ 4,8:1).
- Logo de Luthier en la cabecera y el login (`src/assets/luthier-logo.png`, del kit). El de la Facultad de
  Ingeniería **no** se usa.
- Estilos con **CSS Modules** (`Componente.module.css`): las clases no chocan entre componentes.
- Riesgo: bajo < 0,55 · alerta ≥ 0,55 · alto ≥ 0,75 (`lib/riesgo.ts`). Siempre color + ícono + palabra.
- Accesibilidad: botones reales, objetivos táctiles ≥ 44 px, foco visible, enlace "Saltar al contenido",
  contraste AA en textos de riesgo, el foco va al título al cambiar de vista.

## Navegación

| Ruta | Quién | Etapa |
|---|---|---|
| `/login` | todos | 1 |
| `/hoy`, `/planificador`, `/equipo` | jefe de turno | 1 (estructura) → 2 y 3 |
| `/planificador?inicio=YYYY-MM-DD` | jefe de turno | 2 (grilla semanal + calendario; la semana va en la URL) |
| `/equipo/:id` (ficha) | jefe de turno | 1 (bienestar) → 3 |
| `/solicitudes` | jefe de turno | 3 (aprobar o rechazar cambios de turno) |
| `/mi-turno` | empleado | 3 (mis turnos desde hoy + pedir cambio) |
| `/mis-solicitudes` | empleado | 3 (estado de lo que pidió y donde lo proponen como reemplazo) |
| `/mi-bienestar` | empleado | 1 (bienestar propio) |

En pantallas ≥ 900 px las secciones van en la cabecera; en celular, como pestañas abajo.
La protección por perfil en el frontend es solo de experiencia de uso: la seguridad real la hace el backend.

## Bienestar (datos sensibles, simulados)

Sigue las reglas de `backend/biometria-simulada` (ver `backend/README.md` → Bienestar):

| Dónde | Quién | Qué se muestra |
|---|---|---|
| `/equipo` y `/equipo/:id` (ficha) | Jefe de turno | Solo el **indicador**: nivel (bajo / medio / alto) y hasta 2 motivos generales. Nunca datos crudos |
| `/mi-turno` (anillo) y `/mi-bienestar` | La propia persona | Su indicador **y**, en Mi bienestar, sus registros: sueño, pasos, pulso y encuesta de cansancio |

La ficha siempre muestra uno de los **3 casos**: con datos, sin consentimiento (no se muestra ni se calcula
nada) y sin datos recientes. Cuando hay consentimiento, se muestra un aviso con la fecha, la versión del texto
y quién ve qué. Los tests psicológicos siguen como "Pendiente".
Componente: `src/components/bienestar/Bienestar.tsx` (con `vista="jefe"` nunca dibuja registros, aunque
lleguen en el objeto).

## Seguridad

- El token se guarda en `sessionStorage` (se borra al cerrar la pestaña). La contraseña nunca se guarda.
- Todo lo que empieza con `VITE_` queda visible en el navegador: **no** poner claves en `.env`.
