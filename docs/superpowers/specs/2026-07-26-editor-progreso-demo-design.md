# Editor de rutina, progreso y datos de demo — diseño

**Fecha:** 2026-07-26
**Alcance:** un solo diseño que cubre el editor de rutina, la pantalla de Progreso, y un ajuste al generador de datos de demo existente. Las tres piezas comparten el mismo lenguaje visual (sheets, toasts, tema oscuro con acento azul) y se implementan en el mismo archivo (`index.html`), por lo que se tratan como un solo proyecto con fases.

## Contexto

`index.html` es una PWA de un solo archivo (~3000 líneas), sin framework ni build step: HTML/CSS/JS inline, estado en un objeto global `S`, persistencia en IndexedDB vía el helper `idb`, renderizado por strings de HTML (`innerHTML`) con un mapa de acciones delegadas (`data-act`). Patrones ya existentes que este diseño reutiliza: el bottom sheet (`#sheet` / `openSheet()`), el toast (`#toast`), y el drag-to-reorder por presión prolongada ya usado en la lista de ejercicios (`data-sort`).

Problemas reportados por el usuario:
1. En el editor de rutina no se puede reordenar ni eliminar un día completo (sólo los ejercicios dentro de él).
2. No hay forma de deshacer cambios en el editor.
3. "Guardar como…" y otras confirmaciones usan `prompt()`/`confirm()` nativos del navegador, sin estilo ni animación.
4. En Progreso, los gráficos no son interactivos y los ejes son confusos (peor aún: el eje X no es proporcional al tiempo real).
5. Las pantallas de Editar rutina y Progreso requieren demasiado scroll.
6. (Surgido durante el diseño) Se quiere ver la app con ~1 mes de uso realista simulado, sin pisar datos reales.

## 1. Edición de días en el editor de rutina

**Interacción:** mantener presionado el encabezado de un día (`.day-head`) activa un modo de edición para ese día específico — el mismo gesto de press-and-hold que ya usan los ejercicios dentro del día (`data-sort="rut"`). Al activarse, aparecen inline dos controles en el encabezado:
- Un asa de arrastre (`⠠`) a la izquierda del nombre del día, que permite arrastrarlo verticalmente dentro de la lista de días.
- Una papelera (`🗑`) a la derecha, que vacía ese día (borra `name` y `exercises`, lo deja como "Descanso / sin asignar") con un solo tap.

**Semántica del arrastre:** los días siguen siendo casilleros fijos Lun–Dom (`WEEK_ORDER`); no se puede "mover" un día fuera del calendario. Arrastrar el día A hasta soltarlo sobre el día B **intercambia el contenido completo** (`name` + `exercises`) entre ambos casilleros. Esto es distinto al reorder de ejercicios (que sí cambia el orden real de un array) — aquí se trata de un swap de dos entradas de `S.routine`.

**Qué no cambia:** el botón "✎ Día" que ya existe para renombrar un día se mantiene igual y sigue siendo el camino normal para asignar/renombrar. El día "libre" (chip en la sección "Días libres") no participa del drag — sólo los días con contenido asignado.

## 2. Deshacer / rehacer en el editor

**Modelo:** una pila de historial en memoria (no persistida en IndexedDB, vive sólo mientras `S.rutMode==='edit'`) que registra un snapshot ligero de `S.routine` antes de cada acción destructiva o de reordenamiento: `ex-del`, `ex-up`/`ex-down` (o el nuevo drag), `day-del` (vaciar día), el swap de días, y el borrado desde `day-edit`. Cada entrada del historial guarda: la acción (para el texto del toast) y el estado anterior de los días afectados.

**UI:** tras cada acción que entra al historial aparece el toast existente (`#toast`) con el texto de la acción + un botón "Rehacer" en el mismo toast (ej. "Ejercicio eliminado · Rehacer"). No hay botones fijos de deshacer/rehacer en la pantalla. El historial se descarta al salir del modo edición (`rut-view` o `lib-save` exitoso) — no es necesario que sobreviva entre sesiones.

**Límite:** pila acotada (ej. últimas 20 acciones) para no acumular memoria indefinidamente en una sesión de edición larga.

## 3. Modales propios en vez de diálogos nativos

Se reemplaza todo uso de `prompt()`/`confirm()` del navegador por el componente de bottom sheet existente (mismo sube-desde-abajo con animación que ya usa `openSheet()`), con un input propio para los casos que hoy usan `prompt()`. Cubre los 4 diálogos nativos actuales:
- "¿Con qué nombre la guardo?" (Guardar como…) → sheet con campo de texto + botones Cancelar/Guardar.
- Confirmar sobrescritura de una rutina guardada con el mismo nombre.
- Confirmar borrado de una rutina guardada.
- Confirmar "Vaciar tu split".

Cada sheet de confirmación sigue el mismo layout: título, texto explicativo breve, dos botones (`ghost` para cancelar, sólido para confirmar — rojo cuando la acción es destructiva).

## 4. Progreso — gráficos legibles e interactivos

Afecta a la función compartida `drawChart()` ([index.html:2206](../../../index.html#L2206)), usada tanto por el gráfico de peso corporal como por el de progresión de carga por ejercicio — los cambios benefician a ambos automáticamente.

**Eje X proporcional a fecha real:** hoy `X(i)` reparte los puntos en espacios iguales por índice de sesión, sin importar cuánto tiempo real pasó entre ellas. Pasa a calcularse en base a la fecha real de cada punto (`X(date)` interpolado entre la fecha mínima y máxima del rango visible), de forma que un hueco de varias semanas sin sesiones se vea como un hueco real en el gráfico.

**Ejes con unidad:** se agrega un título de unidad visible junto al eje Y (ej. "kg" o "kg (mejor serie)"), además de los números de las gridlines que ya existen.

**Tooltip al tocar:** al tocar/tap un punto del gráfico (hit-test sobre las coordenadas ya calculadas por `X()`/`Y()`) aparece un tooltip con la fecha completa, el valor exacto, y — en el gráfico de progresión de carga — las reps de esa serie.

**Filtro de rango:** chips (1M / 3M / 6M / Todo) sobre cada gráfico que filtran qué puntos se pasan a `drawChart()`, para no forzar todo el historial en un trazo apretado.

## 5. Progreso — menos scroll con tabs internos

El bloque de peso corporal (`.card.hero`) permanece siempre visible arriba de la pantalla, sin cambios de posición. Debajo, las tres secciones que hoy se apilan completas — Progresión de carga, Fuerza · 1RM, Volumen por grupo — pasan a vivir detrás de un selector de pestañas (`.seg`, el mismo componente de segmented control que ya usa la app en otras pantallas) que muestra una sola sección expandida a la vez. No se oculta información, sólo se cambia cuánto está expandido simultáneamente.

## 6. Generador de datos de demo más realista

Se ajusta el generador existente (`seedRegistro()` / `seedSessions()`, [index.html:2315](../../../index.html#L2315)) que ya crea datos separados marcados `seed:true` (wipeables con `wipeSeed()`), activado por un botón en Ajustes. No se cambia la arquitectura, sólo los datos que genera:

1. **Ventana temporal:** de `SEED_WEEKS=8` (8 semanas) a ~4-5 semanas terminando hoy, para simular "casi un mes" de uso.
2. **Sesiones con variación humana:** algunas sesiones salteadas al azar (día ocupado/enfermo, no todas las semanas tienen las mismas sesiones que el split indica), ruido pequeño en peso/reps entre sesiones de la misma posición del ciclo (en vez de valores idénticos), y algún estancamiento ocasional en la progresión en vez de escalones perfectos cada 3 semanas.
3. **Comidas todos los días de la ventana** (hoy sólo hay 6 días con datos), con kcal/macros fluctuando de forma natural alrededor de `S.cfg.goals`, conservando el patrón real ya presente de días incompletos y un día "libre" con una sola comida grande.
4. **Peso corporal con cadencia más real:** varias mediciones por semana (no sólo una) con ruido día a día de ±0.3–0.5 kg, respetando la tendencia que marcan los puntos reales ya anotados en `SEED_BODY`.

Se mantiene la rutina Anterior/Posterior como base, el botón de Ajustes para cargar/vaciar, y el tag `seed:true` para que nunca se mezcle con datos reales del usuario.

## Verificación

Sin framework de tests (PWA de un archivo). La verificación es manual en navegador, usando la skill `run` para levantar la app localmente y probar cada flujo antes de considerar el trabajo terminado:
- Mantener presionado un día → arrastrar para intercambiar con otro → vaciar un día con la papelera.
- Deshacer/rehacer una secuencia de varias acciones en el editor.
- Guardar como… con el nuevo sheet, y las 3 confirmaciones que reemplazan a `confirm()`.
- Tocar puntos de ambos gráficos (peso y progresión de carga), cambiar el filtro de rango, verificar que un hueco de varias semanas se vea como hueco.
- Cambiar entre las pestañas de Progreso y confirmar que el peso corporal sigue siempre visible arriba.
- Cargar el demo ajustado y confirmar que los datos se ven variados (no perfectamente regulares) y que `wipeSeed()` los borra sin tocar nada marcado como no-seed.

## Fuera de alcance

- Ninguna otra pantalla de la app (Hoy, Nutrición) se toca en este diseño.
- No se agrega comparación de 2 ejercicios superpuestos en el mismo gráfico.
- El historial de deshacer/rehacer no persiste entre sesiones ni se sincroniza con IndexedDB.
