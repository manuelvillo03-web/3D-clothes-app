# Sistema de diseño

La identidad sale del oficio: el **añil** del vaquero, el **amarillo** de la
cinta métrica y la **etiqueta colgante** de la ropa. Los valores están en
[`app/src/lib/theme.ts`](../app/src/lib/theme.ts) y los componentes en
[`app/src/components/`](../app/src/components/).

## Color

| Nombre | Valor | Uso |
| --- | --- | --- |
| Añil | `#1D2257` | Marca, escenario del maniquí, botones oscuros, texto destacado |
| Añil profundo | `#14183F` | Superficies sobre añil |
| Cinta | `#FFD43A` | Único acento: acción principal, tu talla, cinta de medir |
| Fondo | `#F1F2F6` | Gris frío de las pantallas |
| Superficie | `#FFFFFF` | Tarjetas |
| Tinta | `#171A33` | Texto |
| Maniquí | `#D9DCE8` | Gris mate, como un maniquí de escaparate |

El amarillo es para **una** cosa por pantalla (la acción principal o la talla
recomendada). Los cinco colores de ajuste (aprieta, justo, bien, holgado, muy
holgado) solo se usan para eso y siempre con su texto al lado.

## Tipografía

- **Bricolage Grotesque** (400–800): títulos y texto.
- **Barlow Condensed** (500–700): todo lo que sea un número o una talla, como
  en las etiquetas de la ropa y en la propia cinta.

Escala: 36 / 28 / 21 / 17 / 15 / 13 / 11. Sin mayúsculas sostenidas.

## Elementos propios

- **El probador** (`BodyViewer`): escenario añil con el maniquí. A la
  izquierda, una cinta métrica de pared a escala real con el cuerpo (usa la
  misma proyección que la cámara, `screenY`), con la altura marcada.
- **La cinta en 3D** (`core/bodyMarkers.ts`): banda amarilla alrededor del
  maniquí por donde se toma la medida que se está pidiendo. Sale de cortar la
  malla y rodear el corte, así que mide lo mismo que el maniquí.
- **La etiqueta colgante** (`HangTag`): así se enseñan las tallas. Amarilla,
  la tuya; añil, la que estás mirando.
- **El medidor de zona** (`ZoneGauges`): aprieta, bien, holgado en una barra
  con el punto donde cae cada zona, y las cifras debajo.
- **Monogramas de marca** (`BrandMark`): iniciales sobre un color estable por
  marca. No usamos logotipos de terceros.

## Reglas

- Radios según jerarquía: 28 el escenario, 20 las tarjetas, 14 los controles,
  píldora los botones.
- Una acción principal por pantalla, fija abajo cuando la pantalla es un
  formulario.
- Decimales con coma de cara al usuario (`lib/format.ts`); el motor trabaja
  con punto para ser idéntico al de Python.
- El movimiento automático (el giro del maniquí en la bienvenida) se apaga si
  el sistema pide reducir movimiento y en cuanto el usuario toca.
- Los iconos de la app se generan con `node scripts/build-icons.mjs`.
