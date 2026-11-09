# Estrategia de datos de prendas

Para recomendar talla hacen falta **medidas por talla**; para que la app sea
útil, además, **muchas prendas con precio y enlace**. Son dos problemas
distintos y se resuelven con fuentes distintas.

## Lo que da cada fuente

| Fuente | Precio y enlace | Tallas disponibles | Composición | Medidas por talla | Escala |
| --- | --- | --- | --- | --- | --- |
| Feeds de afiliación (Awin y similares) | Sí | Sí | A veces | No | Miles de prendas por tienda |
| Guías de tallas de cada marca (por cuerpo) | No | — | — | Sí, por marca y categoría | Una tabla sirve para muchas prendas |
| Tablas de medidas de la prenda en su ficha | No | — | — | Sí, exactas | Prenda a prenda |
| Usuarios (a mano o foto de la tabla) | — | — | — | Sí | Crece con el uso |
| Armario de referencia del usuario | — | — | — | Sí, de su ropa | Personal |
| Acuerdos con marcas | Sí | Sí | Sí | Sí, incluso patrones | Lento pero completo |

Los feeds de Awin, por ejemplo, traen precio, moneda, talla y stock por talla,
material, EAN, enlace e imágenes, pero ningún campo con medidas de la prenda
([columnas del feed](https://help.awin.com/developers/docs/hosting-feeds)).

## Cómo se combinan

1. **Feed → catálogo navegable.** Cada producto del feed entra con su marca,
   categoría, composición (para la elasticidad), EAN (para el escáner) y
   precio. Si la tienda está en varios feeds, comparamos precios.
2. **Guía de tallas de la marca → medidas.** Una guía por marca, categoría y
   corte (por ejemplo, «camisetas de hombre, corte regular») cubre todos los
   productos del feed que encajan. Con eso ya hay recomendación, marcada como
   «guía por cuerpo» (menos precisa).
3. **Tabla de la prenda → recomendación precisa.** Cuando alguien aporta las
   medidas de una prenda concreta, esa prenda pasa a recomendación exacta.
4. **Valoraciones → calibración.** Cada «¿te quedó bien?» ajusta las
   holguras de esa marca y categoría.

## Reglas

- **Nada de copiar webs sin permiso.** Antes de usar cualquier web se revisan
  sus condiciones y su `robots.txt`; muchas tiendas prohíben la extracción
  automatizada. Si no está permitido, solo feeds, APIs oficiales o acuerdos.
- **Las aportaciones de usuarios entran como «pendiente de revisión»** y no
  se usan para otros hasta revisarlas.
- **Cada prenda guarda su fuente** (`source`) para poder retirarla si una
  marca lo pide.

## Pendiente

- Darse de alta como editor (publisher) en una red de afiliación y solicitar
  los programas de las tiendas de moda que más interesen. Las redes y las
  tiendas revisan a cada editor antes de aceptarlo, así que conviene hacerlo
  con la app ya en beta (fase 3).
- Lista de marcas prioritarias y sus guías de tallas (Manu apunta las que
  compra; ver el documento de requisitos).
