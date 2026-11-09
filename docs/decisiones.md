# Decisiones técnicas

Registro de decisiones, la más reciente arriba. Cada una dice qué se
decidió, por qué y qué la haría cambiar.

## 2026-11-09 · Catálogo sin copiar webs de tiendas

**Decisión.** El catálogo se alimenta de feeds de afiliación, guías de tallas
publicadas por las marcas, tablas que aportan los usuarios y acuerdos con
marcas. No copiamos automáticamente webs de tiendas sin permiso.

**Por qué.** Las condiciones de uso de muchas tiendas prohíben la extracción
automatizada, y una app que crece apoyada en eso puede tener que cerrar de
golpe. Los feeds de afiliación existen justamente para que terceros muestren
productos con precio y enlace, y pagan comisión por venta. Detalle en
[datos.md](datos.md).

**Revisar si** una tienda concreta autoriza por escrito el uso de su web o
publica una API.

## 2026-11-09 · Corrección final con la medición ISO

**Decisión.** El ajuste se hace con las medidas derivables de clad-body y
termina con hasta dos pasos de Gauss-Newton que corrigen el desvío frente a
su medición de referencia (ISO 8559-1).

**Por qué.** Las versiones derivables se separan de la referencia hasta
~1,5 cm en cadera y bajo pecho. Sin la corrección, el maniquí «cumplía» las
medidas en la aproximación pero no con la cinta métrica.

**Resultado** en 30 cuerpos sintéticos con las 6 medidas básicas: todas las
medidas a 1 cm o menos (error medio de cadera 0,2 cm), mediana de 3,7 s por
ajuste en una máquina de 2 núcleos.

## 2026-11-09 · Tabla de cuerpos de arranque

**Decisión.** El ajuste empieza desde el cuerpo más parecido de una tabla de
800 cuerpos de muestra ya medidos (`engine/src/probador/data/init_table.json`,
generada con `scripts/build_init_table.py`).

**Por qué.** Desde el cuerpo medio hacían falta 15 iteraciones (20-40 s);
desde el más parecido, 3-5.

## 2026-11-09 · Anny 0.3.1 fijado

**Decisión.** `anny==0.3.1` y `clad-body==0.6.1`.

**Por qué.** clad-body usa la parametrización de pose `root_relative_world`,
que Anny eliminó a partir de la 0.5. Actualizar requiere que clad-body se
adapte o adaptarlo nosotros, y volver a pasar los tests lentos.

**Ojo.** La interpolación de fenotipos de Anny es lineal a trozos con nudos
en 0, 0,5 y 1, y en un nudo su gradiente es 0. El ajuste aparta los
parámetros de los nudos (`KNOT_EPS`).

## 2026-11-09 · Sin parámetros étnicos ni edad en el ajuste

**Decisión.** Los parámetros de origen étnico de Anny se quedan en la mezcla
neutra y la edad en adulto joven; el ajuste solo mueve altura, peso,
musculatura, proporciones, copa (cuerpo femenino) y cambios locales de
medidas.

**Por qué.** No hacen falta para reproducir medidas y serían datos sensibles.

## 2026-11-09 · Motor aparte en Python, sin estado

**Decisión.** El cálculo vive en un servicio Python (FastAPI) que no guarda
nada; la app guarda las medidas en el móvil y solo las envía para calcular.

**Por qué.** Las librerías del cuerpo solo existen en Python, y un servidor
sin datos personales simplifica mucho la protección de datos.
