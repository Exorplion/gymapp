# Rediseño visual + funcionalidades nuevas — spec de diseño

## Contexto

Se generó un mockup con una herramienta de diseño ("Claude design"), exportado como bundle de Artifact (React + datos hardcodeados, sin conexión a datos reales). Ese mockup sirve como **referencia visual y de features**, no como código a trasplantar: la app real (`index.html`, PWA vanilla JS, sin build step, `S`/`idb`/`ACT`) ya tiene toda la lógica funcional (IndexedDB, editor de rutina con drag/undo, sesión en vivo, registro por voz, gráficos con eje temporal real, datos demo) que el mockup no reproduce.

**Objetivo:** portar el lenguaje visual del mockup sobre la app real sin tocar su lógica de datos, y sumar las funcionalidades que el mockup muestra y hoy no existen.

## Qué se mantiene sin cambios

- Esquema de datos IndexedDB, `S` (estado global), `ACT` (dispatch de acciones), `idb.put/clear`.
- Editor de rutina: drag de días/ejercicios, undo/redo, sheets de guardar/plantillas/biblioteca.
- Registro por voz, generación de datos demo, PWA (`sw.js`).
- Estructura de las 4 pestañas (`hoy`/`rutina`/`nutri`/`prog`) y el nav inferior con indicador deslizante (`.tab-ind`), que ya existe.
- Gráficos de Progreso (eje temporal real, tooltip, filtro de rango, tabs Carga/1RM/Volumen) — solo cambian de estilo, no de lógica.

## Parte 1 — Sistema visual (tokens)

La app ya tiene un sistema de tokens en `:root` (Barlow/Barlow Condensed, `--bg:#05070D`, `--blue:#2E7DFF`, `--blue2:#5EA2FF`, `--blue3:#8FC2FF`, `font-variant-numeric: tabular-nums`). Se evoluciona, no se reemplaza:

- **Fondo**: `--bg` pasa a `#04070F` + glows radiales fijos (azul arriba, cian abajo-derecha, vía `radial-gradient` en un pseudo-elemento o capa fija) + textura de ruido sutil (SVG `feTurbulence` inline en CSS, sin imágenes, opacidad ~0.045).
- **Acentos**: se suma cian (`#22D3EE`) como segundo acento junto a `--blue`/`--blue2`/`--blue3`, para gradientes tipo `linear-gradient(112deg, var(--blue2), #22D3EE)` en botones primarios, el indicador del nav y el anillo de kcal.
- **Glassmorphism**: `.card`, `.hero`, `.sheet` y `.tabbar` pasan a `backdrop-filter: blur(20-26px) saturate(1.4-1.6)` + `border: 1px solid rgba(255,255,255,.1-.14)` + `box-shadow` inset de brillo superior (`inset 0 1px 0 rgba(255,255,255,.12-.18)`) + sombra exterior difusa.
- **Animaciones nuevas** (se agregan como keyframes, no reemplazan las existentes como `pulse`): `vin` (entrada de vistas: fade+translateY+blur), `pop`/`zoom` (aparición de elementos con rebote), `sweep` (brillo diagonal que cruza el botón primario en loop), `grow`/`rise` (barras que crecen desde 0), `flash`/`glowring` (pulsos de foco/loading).
- Todo vive en `:root` y clases utilitarias nuevas — **no cambia ningún selector `data-act` ni la estructura de eventos**.

## Parte 2 — Funcionalidades nuevas

### Racha (streak)
- Ícono 🔥 + contador en el header (junto al botón de historial/ajustes), abre un sheet de detalle.
- **Definición**: un día está "cumplido" si tiene rutina asignada (`S.routine[wd].exercises.length`) y existe una sesión guardada (`S.sessions`) con esa fecha. Los días sin rutina asignada (descanso) no cuentan ni cortan la racha.
- Racha actual = días consecutivos hacia atrás desde hoy que están cumplidos, sin contar los días de descanso como corte.
- Mejor racha = máximo histórico de esa misma métrica sobre `S.sessions`.
- El sheet muestra: heatmap de 12 semanas (56 días) coloreando cumplido/no cumplido/descanso, racha actual, mejor racha, % de cumplimiento sobre los últimos 12 semanas.

### Resumen de sesión con confetti
- Al llamar `completeSession()`, en vez de solo mostrar el toast actual, se abre un sheet de resumen antes de cerrar: duración, cantidad de series, volumen total movido (kg), cantidad de ejercicios.
- **Detección de PR**: se reutiliza la misma lógica que ya calcula récords personales en Progreso (comparar el peso de la mejor serie de cada ejercicio de la sesión contra el máximo histórico previo a esa sesión). Si hay al menos un PR, se dispara una animación de confetti (partículas CSS, sin librerías) y un cartel destacado con el/los ejercicio(s).
- El toast actual (`💪 Sesión guardada`) se reemplaza por este sheet; se cierra con un botón "Guardar y cerrar".

### Timer de descanso: pantalla completa + minimizado
- Mismo `startRest()`/`tickRest()`/`ding()` de base — no se toca la lógica del conteo.
- Estado por defecto al iniciar: overlay a pantalla completa con anillo circular animado (`stroke-dashoffset` sobre `<circle>`, igual que el mockup) y botones +30s / Saltar.
- Se agrega un botón de minimizar: colapsa el overlay a una píldora flotante fija (posición tipo la barra actual `#restbar`, pero como chip flotante con blur) que muestra el tiempo restante corriendo mientras el usuario navega otras pestañas. Tocar la píldora la vuelve a expandir a pantalla completa.
- Estados: `hidden` → `fullscreen` (default al iniciar) → `minimized` (persiste mientras corre) → `hidden` (al terminar o saltar).

### Carrusel horizontal de sesión en vivo + reordenar en modal
- La lista vertical actual de ejercicios durante la sesión (`#ex-list`, `data-sort="hoy"`) pasa a tarjetas deslizables horizontalmente (`scroll-snap`), una visible por vez, con puntitos de posición indicando cuál está activa.
- Cada tarjeta conserva exactamente el contenido/controles actuales (steppers de peso/reps, botón guardar serie, chips de series hechas, warning de progresión).
- Se agrega un botón "Reordenar" que abre un sheet con la lista vertical original y el mismo mecanismo de drag (`data-sort`) que ya usa el editor de rutina — no se reimplementa el drag, se reutiliza tal cual en este nuevo contexto.

### "Un toque" en Nutrición
- Se calculan las 4-6 comidas más frecuentes históricamente a partir de `S.meals` (agrupando por nombre normalizado, tomando los macros más recientes de esa comida), no una lista fija como en el mockup.
- Se muestran como chips debajo del anillo de kcal; tocar un chip agrega esa comida al momento con un solo tap (sin abrir `sheetMealForm()`).

### Tira semanal + volumen muscular en "Hoy"
- La tira de 7 días existente (`.dayrow`, hoy chica) se amplía: nombre del día debajo de cada indicador, mismo criterio activo/descanso que ya usa `S.routine`.
- Se agrega una tarjeta de barras de volumen por grupo muscular de la semana en curso, reutilizando `muscleVolume(7)` (ya existe, usado en Progreso → tab Volumen).

## Parte 3 — Mapeo por pantalla

- **Hoy**: hero de sesión activa/próxima con glassmorphism nuevo, tira semanal ampliada, tarjeta de volumen muscular, historial se mantiene inline (no se separa a sheet).
- **Rutina**: misma estructura y mecánica (ver/editar, drag de días, undo/redo, sheets) con el reskin de tarjetas/botones. Cero cambios de comportamiento.
- **Nutrición**: anillo de kcal reskineado, chips de "un toque" nuevos, lista de comidas reskineada.
- **Progreso**: mismo gráfico/tabs/filtro de rango existentes, con el glassmorphism nuevo aplicado a las tarjetas contenedoras.
- **Nav inferior**: mismo `.tab-ind` deslizante existente, solo cambia gradiente/blur — cero cambios de estructura.

## Alcance técnico

- Todo vive en el único `index.html` (sin build step, sin frameworks), coherente con la arquitectura actual.
- Se extiende el bloque `:root` de tokens y las clases CSS existentes en vez de reescribirlas.
- Las funciones `render*()` actuales (`renderHoy`, `renderRutina`, `renderNutri`, `renderProg`) se modifican para emitir el nuevo markup/clases — la lógica de estado (`S`, `idb`, `ACT`) solo se extiende donde hacen falta datos nuevos: cálculo de racha, comidas frecuentes, detección de PR de sesión, estado del timer (fullscreen/minimized).
- Verificación manual en navegador (skill `run`) en cada tarea — no hay suite de tests automatizada en este proyecto.

## Fuera de alcance

- No se reemplaza ninguna lógica de negocio existente por la del mockup (que usa datos hardcodeados y no persiste nada).
- No se introduce React, build step, ni librerías de animación/confetti externas.
- No se toca el editor de rutina más allá del reskin visual (su mecánica ya es sólida y no aparece en el mockup con cambios funcionales).
