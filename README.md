# Probador

App para saber qué talla de una prenda te queda bien antes de comprarla. Cada
persona crea, con unas pocas medidas, un maniquí 3D de su cuerpo; la app
compara ese cuerpo con las medidas de cada talla, zona a zona, y recomienda
la talla con una explicación («en la M te sobran 4 cm de pecho; en la S vas
justo»).

El documento de requisitos y arquitectura está en Claude:
[Probador virtual — requisitos y arquitectura](https://claude.ai/artifact/GYYwcQ87YXHKMHhHHWo6w5).

## Estructura

| Carpeta | Qué hay | Estado |
| --- | --- | --- |
| [`engine/`](engine/) | Motor en Python: maniquí a partir de medidas y recomendación de talla, servido como API | Fase 0 y 1 en marcha |
| [`data/`](data/) | Formato del catálogo de prendas y prendas de ejemplo | Formato definido |
| [`docs/`](docs/) | Decisiones técnicas, calibración pendiente y estrategia de datos | Vivo |
| `app/` | App móvil (Expo, React Native) | Fase 2 |

## Cómo funciona, en corto

1. **Maniquí.** El modelo paramétrico de cuerpo [Anny](https://pypi.org/project/anny/)
   (Apache 2.0) se ajusta a las medidas del usuario resolviendo un problema de
   mínimos cuadrados (Levenberg-Marquardt) sobre medidas derivables de
   [clad-body](https://pypi.org/project/clad-body/) (Apache 2.0, ISO 8559-1),
   y se corrige al final con la medición de referencia ISO.
2. **Holguras.** Para cada talla y zona, holgura = prenda − cuerpo, comparada
   con un intervalo ideal según categoría, corte, elasticidad del tejido y
   preferencia del usuario (ceñido, normal, holgado).
3. **Recomendación.** Cada talla suma una penalización por zona (apretar pesa
   más que sobrar); gana la menor y se explica en español.

## Desarrollo

```bash
cd engine
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
pytest -m "not slow"      # sin modelo 3D, en un segundo
pytest                    # completo; la primera vez Anny tarda ~1 min en preparar sus datos
uvicorn probador.api:app --reload    # documentación interactiva en /docs
```

## Licencias de terceros

Ver [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). El código de este
repositorio es privado y todos sus derechos están reservados.
