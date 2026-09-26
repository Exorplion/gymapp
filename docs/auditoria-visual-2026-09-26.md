# Auditoría visual — 2026-09-26

Pedido de Enzo (bloque 5): "una mejora estética y visual de todas las
pantallas", con foco en que lo nuevo tenga **animaciones de salida** en
confirmaciones y hojas.

**Cómo se hizo:** Chrome a 390 × 844 (y 430 × 932 en la sesión en vivo), con
los datos de prueba (`seedRegistro()`). En cada pestaña: captura, un barrido
automático (ancho del documento, textos de menos de 12 px, textos chicos en el
gris más apagado `--mut2`) y revisión a ojo. Para las salidas: qué se abre y
se cierra, y si corre una animación al cerrar (`document.getAnimations()`).

## Arreglado en este PR

| Pantalla | Problema | Arreglo |
|---|---|---|
| Descanso a pantalla completa | Entraba con fundido y se iba de golpe (`display:none`) al minimizar, saltar o terminar | `.out` con `fdout` + `dlgOut` (RestTimer.jsx, `saliendo`) |
| Descanso, pregunta del RIR | Se quedaba todo el descanso; cinco chips sueltos | Se va al contestar (altura + fundido); barra segmentada |
| Sesión, "Después" | Mandaba al final sin preguntar ni deshacer | Hoja "¿Cuándo hacés…?" con entrada escalonada + "Deshacer" |
| Inicio, rótulos de las tarjetas | Tamaño más chico y gris más apagado: no se leían | Estilo de título de sección (condensada, azul) + rayita de acento |
| Inicio, días de la semana | 10 px en `--mut2` | 11 px en `--mut` |
| Entreno, encabezado de bloque ("3 ej · 5 series") | 10 px en `--mut2` | `--mut` |
| Entreno, "Porciones que tu rutina todavía no toca" | El texto salía más grande que el título | Título 15 px, texto 13 px |
| Comida, "Calcular mis macros" | Texto centrado con el ícono a la izquierda | Alineado a la izquierda |
| Comida, tarjeta de calorías | Dos rayas seguidas con una franja vacía en el medio | El primer aviso no repite la raya |
| Comida, "Día de descanso" | Repetía "−25 g de carbohidratos" en título y texto | El texto ya no repite los gramos (`cycleExplain`) |
| Todas, títulos de sección (`.sect`) | Gris, distinto de los títulos azules nuevos | Azul, como `.plan-title` |
| Progreso, gráfico de peso | La etiqueta del último punto se cortaba ("74.:") | Se acota al ancho del canvas |
| Progreso, "+0.1 kg/sem" | Se partía en dos renglones | `whitespace-nowrap` |
| Progreso, "Tus sesiones" | "Ver todas" como botón al 100% partía el título | Enlace de texto después de la raya (`.sect-link`) |
| Progreso, lista de sesiones | Ejercicios de cada sesión en `--mut2` | `--mut` |

## Revisado y bien

- **Ninguna pantalla desborda a lo ancho** (documento = 390 px en las cuatro pestañas).
- **Hojas** (`Sheet.jsx`): ya tienen salida (`closing`). **Confirmaciones**: salen con `dlgOut`. **Aviso** (toast): transición de salida. **Aviso de la sesión anterior**: sale con `AnimatePresence`.
- **Resumen de fin de sesión**: al cerrarlo lo reemplaza la hoja de la sesión, que entra encima; no necesita salida propia.
- Subtítulos de semana en "Tus sesiones" ("Esta semana · 3 sesiones"): quedan en gris a propósito, un escalón debajo del título azul de la sección.

## Pendiente (no se tocó)

- **Progreso, "Medidas"**: dos valores a la izquierda y el resto de la tarjeta vacío. Se ve pobre, pero la solución depende de qué medidas quiera Enzo mostrar.
- **Ajustes y el resto de las hojas** no se auditaron pantalla por pantalla: el barrido fue de las cuatro pestañas y la sesión en vivo.
- **Textos de 11 px** (`--t-micro`) siguen en etiquetas secundarias de toda la app. Están en el sistema de tipos a propósito; subirlos todos es un cambio de escala que conviene decidir aparte.
