# Probador

App para saber qué talla de una prenda te queda bien antes de comprarla. Cada
persona crea, con unas pocas medidas, un maniquí 3D de su cuerpo; la app
compara ese cuerpo con las medidas de cada talla, zona a zona, y recomienda
la talla con una explicación («en la M te sobran 4 cm de pecho; en la S vas
justo»).

El documento de requisitos y arquitectura está en Claude:
[Probador virtual — requisitos y arquitectura](https://claude.ai/artifact/GYYwcQ87YXHKMHhHHWo6w5).

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| [`app/`](app/) | App (Expo, React Native, TypeScript) para iOS, Android y web. Calcula el maniquí y la talla en el propio móvil |
| [`engine/`](engine/) | Motor de referencia en Python: ajuste del maniquí con Anny y clad-body, motor de tallas, API y generador del modelo del móvil |
| [`data/catalog/`](data/catalog/) | Formato de las prendas, guías de tallas reales de marcas y prendas de ejemplo |
| [`supabase/`](supabase/) | Base de datos del catálogo compartido: migraciones y datos iniciales |
| [`docs/`](docs/) | Decisiones técnicas, calibración pendiente y estrategia de datos |

## Cómo funciona, en corto

```text
medidas del usuario ──▶ maniquí (en el móvil) ──▶ medidas completas ──▶ talla + explicación
                         gaussiana medidas↔forma     dadas + estimadas      holgura zona a zona
```

1. **Maniquí.** `engine/scripts/build_mobile_model.py` genera miles de cuerpos
   con [Anny](https://pypi.org/project/anny/) (Apache 2.0), los mide con
   [clad-body](https://pypi.org/project/clad-body/) (Apache 2.0, ISO 8559-1) y
   resume la relación entre medidas y forma en un binario de 3,7 MB que va
   dentro de la app. Con las medidas que da el usuario, el móvil calcula la
   forma más probable y estima las medidas que faltan.
2. **Holguras.** Para cada talla y zona, holgura = prenda − cuerpo, comparada
   con un intervalo ideal según categoría, corte, elasticidad del tejido y
   preferencia del usuario (ceñido, normal, holgado).
3. **Recomendación.** Cada talla suma una penalización por zona (apretar pesa
   más que sobrar); gana la menor y se explica en español.
4. **Privacidad.** Las medidas del cuerpo no salen del dispositivo. Internet
   solo se usa para el catálogo compartido de prendas.

## Desarrollo

App:

```bash
cd app
npm ci
npm test              # paridad con el motor de Python, maniquí, catálogo
npm run typecheck
npx expo start        # escanea el QR con Expo Go
npm run catalog       # tras añadir guías en data/catalog/marcas
```

Motor (Python 3.12):

```bash
cd engine
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install --index-url https://download.pytorch.org/whl/cpu torch
uv pip install -e ".[dev]"
pytest -m "not slow"                  # sin modelo 3D, en un segundo
python scripts/export_golden.py       # tras tocar el motor de tallas
```

El modelo del maniquí se regenera en GitHub Actions (workflow «Maniquí para
el móvil», unos 15 minutos) y se guarda solo en la rama.

## Datos

- **Catálogo incluido:** 17 guías de tallas oficiales de Levi's, Mango, New
  Balance, Nike, Primark y ASOS, cada una con su fuente.
- **Catálogo compartido:** Supabase (proyecto `probador`, París). Lectura
  pública de lo publicado; las aportaciones de usuarios entran pendientes de
  revisión. Ver [`supabase/`](supabase/).
- No se extraen datos automáticamente de webs de tiendas
  ([por qué](docs/datos.md)).

## Licencias de terceros

Ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). El código de este
repositorio es privado y todos sus derechos están reservados.
