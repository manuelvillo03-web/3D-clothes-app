# Catálogo de prendas

Cada prenda es un archivo JSON que cumple [`schema.json`](schema.json)
(generado desde `engine/src/probador/garments.py` con
`python engine/scripts/export_schema.py`; no se edita a mano).

Las prendas de [`ejemplos/`](ejemplos/) son **inventadas**: sirven para
probar el motor y como plantilla, no describen productos reales. El catálogo
real vivirá en la base de datos (fase 2), no en el repositorio.

## Campos principales

| Campo | Qué es |
| --- | --- |
| `category` | `tshirt`, `shirt`, `polo`, `sweater`, `hoodie`, `jacket`, `coat`, `dress`, `jeans`, `trousers`, `shorts`, `skirt` |
| `cut` | Corte: `slim`, `regular`, `relaxed`, `oversize` |
| `chart_type` | `garment` si las medidas son de la prenda; `body` si son del cuerpo al que va destinada cada talla (guía de tallas) |
| `sleeve` | `none`, `short`, `long` (por defecto según la categoría) |
| `rise` | Tiro de pantalones y faldas: `low`, `mid`, `high` (por defecto `mid`) |
| `composition` | Porcentajes de cada fibra; el elastano cuenta para la elasticidad |
| `sizes` | Lista de tallas, en orden, cada una con sus medidas en cm |
| `source` | De dónde salen las medidas, para poder retirarlas si hace falta |

## Puntos de medida

Contornos completos en cm. Si la marca da el ancho a plano (de costura a
costura con la prenda extendida), usa la clave con `_flat` y el motor lo
multiplica por dos.

| Clave | Medida |
| --- | --- |
| `chest` / `chest_flat` | Pecho, de axila a axila |
| `waist` / `waist_flat` | Cintura (en pantalones, la cinturilla) |
| `hip` / `hip_flat` | Cadera |
| `thigh` / `thigh_flat` | Muslo, justo bajo la entrepierna |
| `length` | Largo, del punto más alto del hombro al bajo |
| `sleeve_length` | Manga, de la costura del hombro al puño |
| `shoulder_width` | Hombros, de costura a costura por la espalda |
| `inseam` | Entrepierna, de la entrepierna al bajo |
| `rise` | Tiro delantero |
| `neck` | Cuello de camisa |
| `leg_opening` / `leg_opening_flat` | Bajo del pantalón |
| `height` | Solo en guías por cuerpo: altura de la persona |

En las guías por cuerpo (`chart_type: "body"`) cada valor puede ser un número
o un intervalo `[mínimo, máximo]`.
