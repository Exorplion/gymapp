# Tokens del rediseño — pantalla HOY

Valores extraídos con `getComputedStyle` del mockup real
(`docs/fierro-rediseno-mockup.html`) renderizado a 420px de ancho.
No son aproximaciones: son los valores que el mockup computa.

Método: servir el mockup, renderizarlo en Chromium a 420×900, recorrer el
árbol y volcar familia/tamaño/peso/estilo/tracking/color/fondo/radio/borde/
padding de cada elemento visible.

## Base

| | |
|---|---|
| Fondo | `rgb(4,7,15)` |
| Texto | `rgb(238,244,255)` |
| Texto atenuado | `rgb(147,164,200)` |
| Texto apagado (días libres, tabs inactivas) | `rgb(100,116,154)` |
| Cian de acento | `rgb(127,209,255)` |
| Cian puro (puntos, gradientes) | `rgb(34,211,238)` |
| Azul | `rgb(79,168,255)` |
| Azul profundo (inicio de gradientes) | `rgb(37,64,232)` |
| Ámbar (racha) | `rgb(255,196,107)` |
| `main` | padding `0 18px`, padding-bottom `132px` |

Hay además una capa de ruido a pantalla completa: un SVG `feTurbulence`
como `background-image` sobre un div de 420×900.

## Header — alto 66px, padding `16px 18px 12px`

Fondo: `linear-gradient(rgba(4,7,15,.86), rgba(4,7,15,.4))`

| Elemento | Valores |
|---|---|
| Logo FIERRO | Barlow Condensed 23px/700 **itálica**, ls `4.6px`, texto con gradiente `linear-gradient(96deg, #EEF4FF 8%, #4FA8FF 62%, #22D3EE 96%)` |
| Píldora de racha | 62×35, radio `999px`, fondo `linear-gradient(150deg, rgba(255,196,107,.18), rgba(255,255,255,.03))`, borde `1px solid rgba(255,196,107,.32)`, padding `7px 12px 7px 9px` |
| Número de racha | Barlow Condensed 16px/700, ls `.64px`, color `rgb(255,196,107)` |
| Botones de icono | 38×38, radio `13px`, fondo `linear-gradient(150deg, rgba(255,255,255,.09), rgba(255,255,255,.02))`, borde `1px solid rgba(255,255,255,.1)`, icono 19×19 color `rgb(147,164,200)` |

**Son tres controles**: racha, reloj (historial) y tema.

## Título de pantalla — gap 10px, alineado a la línea base

| | |
|---|---|
| `h1` | Barlow Condensed **40px**/700 **itálica**, ls `0.8px` |
| Fecha | Barlow 13px/500, ls `.78px`, color `rgb(147,164,200)`, en versales |

## Tarjeta hero — 384×237

Fondo `linear-gradient(158deg, rgba(37,64,232,.3), rgba(255,255,255,.03) 58%)`,
radio `26px`, borde `1px solid rgba(120,170,255,.22)`, padding `20px`.
Lleva encima un círculo de 210px con
`radial-gradient(circle, rgba(34,211,238,.28), transparent 66%)`.

| Elemento | Valores |
|---|---|
| Etiqueta "TOCA HOY" | Barlow 11px/700, ls `1.98px`, color `rgb(127,209,255)`, gap 8px, con punto de 6px `rgb(34,211,238)` radio 3px |
| Título del día | Barlow Condensed **46px**/700 **itálica**, ls `.46px`; la segunda mitad en `rgb(127,209,255)` |
| Números de stat | Barlow Condensed 26px/700 |
| Etiquetas de stat | Barlow 10.5px/400, ls `1.47px`, color `rgb(147,164,200)` |
| Fila de stats | gap `18px` |
| CTA | 342×58, Barlow Condensed 21px/700, ls `2.52px`, color **`rgb(3,18,31)`** (texto oscuro), fondo `linear-gradient(112deg, #4FA8FF, #22D3EE 58%, #7FD1FF)`, radio `18px` |
| Brillo del CTA | span con `linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)` que barre |

## Tira semanal — 7 celdas de 50×50, gap 6px

Padding de celda `9px 2px 8px`, radio `14px`.

| Estado | Valores |
|---|---|
| Entrena | fondo `linear-gradient(160deg, rgba(79,168,255,.22), rgba(255,255,255,.03))`, borde `1px solid rgba(120,170,255,.3)`, letra Barlow Condensed 14px/700 ls `1.4px` color `rgb(127,209,255)`, nombre Barlow 9px color `#EEF4FF` |
| Libre | fondo `rgba(255,255,255,.024)`, borde `1px solid rgba(255,255,255,.06)`, letra y nombre en `rgb(100,116,154)` |

La distinción **no** depende de cuál esté seleccionado: marca los días que
se entrena, siempre.

## Encabezado de sección

Barlow Condensed 15px/700, ls `2.7px`, color `rgb(147,164,200)`, gap 10px,
seguido de una línea horizontal que ocupa el resto del ancho.

## Tarjeta de músculos — 384×301

Fondo `linear-gradient(158deg, rgba(255,255,255,.075), rgba(255,255,255,.02))`,
radio `24px`, borde `1px solid rgba(255,255,255,.1)`, padding `18px`.

| Elemento | Valores |
|---|---|
| Nombre del músculo | Barlow 13.5px/600 |
| Valor "N series" | Barlow Condensed 15px/600, color `rgb(127,209,255)` |
| Riel de la barra | alto `8px`, radio `5px`, fondo `rgba(255,255,255,.05)` |
| Relleno | `linear-gradient(90deg, #2540E8, #4FA8FF 60%, #22D3EE)`, radio `5px` |
| Nota al pie | Barlow 12.5px/400, color `rgb(147,164,200)` |

## Nav flotante — 384×75

Padding `7px`, radio `24px`,
fondo `linear-gradient(158deg, rgba(255,255,255,.11), rgba(255,255,255,.043))`,
borde `1px solid rgba(255,255,255,.14)`,
sombra `inset 0 1px 0 rgba(255,255,255,.2), 0 22px 50px rgba(0,0,0,.95)`.
El `nav` que lo contiene tiene padding `0 18px 16px`.

| Elemento | Valores |
|---|---|
| Chip activo | 92×59, radio `18px`, fondo `linear-gradient(140deg, rgba(79,168,255,.38), rgba(34,211,238,.24))`, borde `1px solid rgba(140,210,255,.4)` |
| Ítem | 92×59, padding `11px 0 9px`, gap 4px |
| Icono | svg 22×22 |
| Etiqueta | Barlow Condensed 10.5px/700, ls `1.47px`; activa `#EEF4FF`, inactiva `rgb(100,116,154)` |

Las etiquetas del mockup son **HOY · RUTINA · COMIDA · PROGRESO**
("COMIDA", no "NUTRICIÓN").

## Orden en pantalla

1. Título + fecha
2. Tarjeta hero (etiqueta, título del día, stats, CTA)
3. Tira semanal
4. Encabezado "MÚSCULOS ESTA SEMANA"
5. Tarjeta de músculos
6. Nav flotante

## Lo que el mockup no define

Muestra un solo estado feliz: lunes con Push programado y datos completos.
No define día de descanso, rutina inexistente, historial vacío ni sesión
en curso. Esos estados hay que resolverlos con el mismo lenguaje.
