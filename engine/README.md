# Motor del probador

Servicio en Python que hace dos cosas:

1. **Maniquí a partir de medidas.** Ajusta el modelo de cuerpo
   [Anny](https://pypi.org/project/anny/) a las medidas del usuario y devuelve
   los parámetros del maniquí, el maniquí en 3D (GLB) y todas sus medidas,
   incluidas las que el usuario no dio.
2. **Ajuste de prendas.** Compara el cuerpo con las medidas de cada talla de
   una prenda, zona a zona, y recomienda la talla con una explicación.

No guarda nada: recibe medidas, calcula y responde.

## Puesta en marcha

```bash
cd engine
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -e ".[dev]"
pytest -m "not slow"     # tests rápidos (sin el modelo 3D)
pytest                   # todos; la primera vez Anny tarda ~1 min en preparar sus datos
uvicorn probador.api:app --reload   # documentación interactiva en http://localhost:8000/docs
```

Con Docker:

```bash
docker build -t probador-engine .
docker run -p 8080:8080 probador-engine
```

## API

| Ruta | Qué hace |
| --- | --- |
| `GET /health` | Estado; `body_model` pasa de `loading` a `ready` cuando el modelo está cargado |
| `GET /v1/measurements` | Catálogo de medidas con nombre, unidad, rango e instrucciones para tomarlas |
| `GET /v1/topology` | Parte del cuerpo de cada vértice (tronco, brazos, piernas) para colorear zonas |
| `POST /v1/body` | Medidas → parámetros del maniquí, medidas completas, alturas de referencia y avisos |
| `POST /v1/body/mesh` | Parámetros → maniquí en GLB (`model/gltf-binary`) |
| `POST /v1/fit` | Medidas del cuerpo + prenda → talla recomendada con explicación |
| `POST /v1/fit/reference` | Prenda + prenda propia de referencia → talla más parecida |

Flujo de la app:

```text
medidas ──POST /v1/body──▶ parámetros + medidas completas   (se guardan en el móvil)
parámetros ──POST /v1/body/mesh──▶ GLB para el visor
medidas completas + prenda ──POST /v1/fit──▶ talla y explicación
```

Ejemplo:

```bash
curl -s localhost:8080/v1/body -H 'Content-Type: application/json' -d '{
  "sex": "male",
  "measurements": {"height": 178, "weight": 76, "chest": 98, "waist": 84, "hip": 98, "inseam": 81}
}'
```

Variables de entorno:

| Variable | Para qué |
| --- | --- |
| `PROBADOR_API_KEY` | Si está, las rutas `/v1` exigen la cabecera `X-Api-Key` |
| `PROBADOR_CORS_ORIGINS` | Orígenes permitidos para la versión web de la app, separados por comas |
| `PROBADOR_LAZY_MODEL=1` | No cargar el modelo al arrancar (tests) |
| `ANNY_CACHE_DIR` | Dónde guarda Anny sus datos procesados |

## Cómo se ajusta el maniquí

`src/probador/body.py`:

1. Arranca del cuerpo de muestra más parecido de `data/init_table.json`
   (800 cuerpos medidos, generados con `scripts/build_init_table.py`).
2. Levenberg-Marquardt sobre las medidas derivables de clad-body, con una
   regularización que mantiene el cuerpo plausible. Mueve altura, peso,
   musculatura, proporciones y copa, más un cambio local por cada medida
   dada.
3. Mide el resultado con la referencia ISO 8559-1 de clad-body y corrige el
   desvío con hasta dos pasos de Gauss-Newton.
4. Mide lo que el usuario no dio y el contorno a la altura de la cinturilla
   para cada tipo de tiro.

Resultados (`scripts/evaluate_body_fit.py`, 30 cuerpos sintéticos, medidas
básicas): todas las medidas a 1 cm o menos, error medio de cadera 0,2 cm,
mediana de 3,7 s por ajuste en 2 núcleos.

## Versiones fijadas

`anny==0.3.1` y `clad-body==0.6.1` van juntas: clad-body usa una
parametrización de pose que Anny eliminó en la versión 0.5. No actualizar
una sin la otra y sin pasar los tests marcados como `slow`.

## Scripts

| Script | Para qué |
| --- | --- |
| `scripts/build_init_table.py` | Regenera la tabla de cuerpos de arranque |
| `scripts/evaluate_body_fit.py` | Mide la precisión y el tiempo del ajuste |
| `scripts/render_body.py` | Dibuja el maniquí de frente y de perfil en un PNG |
| `scripts/export_schema.py` | Regenera `data/catalog/schema.json` |
