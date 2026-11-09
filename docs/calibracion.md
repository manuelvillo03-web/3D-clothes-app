# Calibración pendiente

El motor funciona, pero varios números son hipótesis razonables, no
mediciones. Esta es la lista de lo que hay que comprobar con personas y
prendas reales antes de la beta, en orden de importancia. Cada cambio de
calibración sube `ENGINE_VERSION` en `engine/src/probador/ease.py`.

## Cómo se calibra

1. **Usuario cero.** Manu se mide (lista en el documento de requisitos) y
   mide cinco prendas suyas: tres que le quedan bien y dos que no.
2. Se meten las medidas en `/v1/body` y las prendas en `/v1/fit`.
3. Donde la app diga algo distinto de lo que pasa en la realidad, se ajusta
   la tabla correspondiente y se añade el caso como test.
4. Se repite con 5-10 personas de cuerpos distintos (fase 2).

## Lista

| # | Qué | Dónde | Por qué es dudoso |
| --- | --- | --- | --- |
| 1 | Ancho de hombros del cuerpo frente al de la prenda | `ease.SHOULDER` | clad-body lo mide entre acromiones y sale menor que lo que una persona mide «de hombro a hombro» por la espalda. Hay que ver qué mide la gente al seguir nuestras instrucciones y cuánto más ancha es una prenda que queda bien |
| 2 | Holguras de pecho por categoría y corte | `ease.CHEST` | Rangos habituales de patronaje; cada marca entalla distinto |
| 3 | Altura de la cinturilla según el tiro | `body.RISE_HEIGHT_FRACTION` | Fracciones entre cintura y cadera estimadas; habría que medir dónde cae la cinturilla de vaqueros reales |
| 4 | Holgura de cinturilla, cadera y muslo | `ease.WAISTBAND`, `ease.HIP`, `ease.THIGH` | Igual que el pecho |
| 5 | Elasticidad por elastano y tejido | `ease.BASE_STRETCH`, `STRETCH_PER_ELASTANE_PCT` | Valores aproximados; depende mucho del tejido |
| 6 | Largo de prendas de arriba frente al largo de torso | `ease.TOP_LENGTH` | El largo de torso de clad-body va por delante sobre el pecho, la prenda se mide desde el hombro |
| 7 | Tolerancia del peso | `measurements.weight.tolerance` (3 kg) | El peso depende de la composición corporal, no solo de la forma |
| 8 | Pesos de cada zona en la puntuación | `fit.ZONE_WEIGHT` | Decide qué pesa más cuando dos zonas se contradicen |

## Lo que ya está comprobado

- El maniquí del móvil, dadas las 6 medidas básicas, se separa del cuerpo real
  10 mm de media por vértice, y estima las medidas que faltan con estos
  errores en cuerpos sintéticos: muslo ±2,4 cm, hombros ±1,6-2,1, manga ±2,0,
  largo de torso ±0,8 (`engine/reports/body-model.json`). En personas reales
  habrá que comprobarlo, sobre todo el muslo y los hombros.

- El maniquí reproduce las medidas que se le dan: en 30 cuerpos sintéticos,
  todas a 1 cm o menos (`scripts/evaluate_body_fit.py`).
- Las medidas que el usuario no da salen de un cuerpo humano plausible, pero
  su precisión real (por ejemplo, el muslo estimado a partir de la cadera)
  solo se puede comprobar con personas reales.
