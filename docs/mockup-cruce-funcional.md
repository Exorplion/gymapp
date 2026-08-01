# Cruce funcional: mockup ↔ app

Qué hace cada control del mockup y si la app ya lo tiene. Obtenido
manejando `fierro-rediseno.html` en un navegador: se hace clic en cada
botón y se observa qué cambia en el DOM. No es lectura de código ni
suposición a partir de los iconos.

## Header (en las 4 pantallas)

| Control | Qué hace en el mockup | En la app |
|---|---|---|
| 🔥 racha | abre el detalle de racha | ya existía |
| 🕐 reloj | abre **Historial** como sheet | **agregado** — antes el historial era una sección al final de Hoy |
| ☀ sol | inerte en el export (sería tema claro/oscuro) | mapeado a Ajustes |

## HOY

| Control | Qué hace | En la app |
|---|---|---|
| EMPEZAR ENTRENAMIENTO | abre la sesión en vivo: carrusel de ejercicios, ± de peso y reps, cronómetro, TERMINAR | ya existía |
| Tira semanal | en el mockup son divs, no botones | en la app **sí** son botones (elegís qué día ver) — se mantiene, es más funcional |

La pantalla del mockup termina en la tarjeta de músculos. No tiene
historial embebido, ni pre-workout, ni registro por voz, ni reordenar.

## RUTINA

| Control | Qué hace | En la app |
|---|---|---|
| EDITAR RUTINA | pasa a modo edición: aparecen LISTO, EDITAR DÍAS, y cada ejercicio con ✕ y flechas ↑↓ | ya existía |
| MIS RUTINAS | abre la biblioteca de rutinas guardadas | ya existía |
| Fila de día | despliega/pliega el detalle del día con sus ejercicios numerados | ya existía |

Estructura del mockup: encabezado "TU SEMANA" → tarjeta "PLAN ACTIVO" con
el nombre del split y el resumen (`3 días · 15 ejercicios · 53 series por
semana`) → tira de letras L M M J V S D → los dos botones → filas de día.

## COMIDA (Nutrición)

| Control | Qué hace | En la app |
|---|---|---|
| Chip `＋ Pollo con arroz 620` | suma la comida: se actualizan el anillo de kcal, las tres barras de macros y la frase de feedback | ya existía |
| ✕ en una comida | la borra y recalcula todo | ya existía |

Estructura: número grande de kcal (`1340`) + `DE 2380` + `RESTANTES 1040
kcal`, subtítulo con objetivo y peso, tres filas de macros `120/160`, una
frase de feedback que cambia según lo que falta, sección **UN TOQUE** con
los chips de acceso rápido, y la lista de comidas del día.

## PROGRESO

| Control | Qué hace | En la app |
|---|---|---|
| + REGISTRO | inerte en el export (registrar peso corporal) | ya existía |
| 1M / 3M / 6M / TODO | filtra el rango del gráfico | ya existía |
| CARGA / 1RM / VOLUMEN | cambia de pestaña; VOLUMEN muestra series por músculo ordenadas | ya existía |

Estructura: subtítulo "12 SEMANAS", tarjeta de peso `PESO · PROMEDIO 7
DÍAS` con el valor grande y la tendencia (`esta semana · −0,3 kg/sem`), el
gráfico, los rangos, las tres pestañas, y tarjetas por ejercicio con una
frase de diagnóstico (`+0,6 kg/sem · en 4 semanas ≈ 97,8 kg`, `plano en
las últimas 4 sesiones · variá reps o series`) y el 1RM estimado grande.

## Conclusión

**La app ya tiene todas las funciones del mockup.** No falta ninguna
pantalla ni ningún control: el trabajo pendiente es de forma, no de
función — tipografía, jerarquía, orden de bloques y color.

La única diferencia estructural real era el historial, que el mockup saca
de la pantalla Hoy y pone detrás del reloj del header. Ya está aplicado.

Al revés, la app tiene cosas que el mockup no muestra y que se conservan:
pre-workout, registro por voz, reordenar ejercicios, temporizador de
descanso, datos de demo, respaldo JSON y el editor de rutinas completo.
