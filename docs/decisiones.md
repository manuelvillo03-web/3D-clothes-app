# Decisiones técnicas

Registro de decisiones, la más reciente arriba. Cada una dice qué se
decidió, por qué y qué la haría cambiar.

## 2026-11-10 · Identidad propia: añil y cinta métrica

**Decisión.** La interfaz deja el aspecto de formulario y pasa a tener
identidad de producto: añil vaquero como color de marca, amarillo de cinta
métrica como único acento, Bricolage Grotesque para textos y Barlow Condensed
para tallas y centímetros. Navegación por pestañas, bienvenida con un maniquí
de muestra y asistente de medidas paso a paso. Detalle en [`diseno.md`](diseno.md).

**Por qué.** La primera versión funcionaba pero no parecía una aplicación. La
identidad sale del propio oficio (el vaquero, la cinta, la etiqueta colgante)
para que no se confunda con una plantilla. La cinta de pared a escala y la
cinta en 3D no son adorno: enseñan la altura y por dónde se mide.

## 2026-11-10 · El catálogo se sincroniza por diferencias y manda el servidor

**Decisión.** La app guarda una copia del catálogo compartido y solo pide a
Supabase lo que cambió desde la última vez. Si una guía incluida en la app se
corrige o se retira en el servidor, las apps instaladas aplican el cambio.

**Por qué.** Descargar todo el catálogo en cada arranque no escala y gasta
datos del usuario. Y como las guías se transcriben a mano, hay que poder
corregir un error sin esperar a que cada persona actualice la app.

**Coste.** Una tabla más (`garment_removals`) y un disparador, para que las
apps se enteren también de lo que se retira.

## 2026-11-10 · Valoraciones de talla anónimas y voluntarias

**Decisión.** «¿Cómo te quedó?» se guarda siempre en el móvil. Solo si el
usuario marca la casilla se envía a `fit_feedback`: prenda, talla, talla
recomendada, respuesta y versión del motor. Sin medidas, sin identificador y
con el día, no la hora.

**Por qué.** Es el dato que permite saber si una marca talla pequeño o grande
y calibrar las holguras, y se puede recoger sin saber nada del cuerpo de
nadie. No se puede leer desde la app; por ahora solo lo vemos nosotros.

## 2026-11-09 · El maniquí se calcula en el móvil, sin servidor

**Decisión.** La app no llama al motor de Python. Lleva dentro un modelo
lineal del cuerpo (`app/assets/models/body-model.bin`, 3,7 MB) que genera
`engine/scripts/build_mobile_model.py` en GitHub Actions:

* ~2.250 cuerpos de Anny (fenotipo + cambios locales al azar) medidos con
  clad-body (ISO 8559-1);
* forma = malla media + 40 componentes principales;
* una gaussiana conjunta por base de cuerpo sobre [medidas, alturas de
  referencia, coeficientes]. Con las medidas que da el usuario, la media
  condicionada da la forma del maniquí y estima las que faltan con su error.

**Por qué.** Coste cero aunque la usen miles de personas, funciona sin
conexión, no hace falta ninguna cuenta en la nube y las medidas del cuerpo
nunca salen del móvil (el dato más delicado de la app).

**Precisión** (110 cuerpos apartados por base, dadas las 6 medidas básicas;
`engine/reports/body-model.json`): 10 mm de error medio por vértice;
contorno de la malla a 0,3-0,8 cm en pecho y cintura y 1,6-2,5 cm en cadera.
Medidas estimadas: muslo ±2,4 cm, hombros ±1,6-2,1, manga ±2,0, largo de
torso ±0,8, contorno de cinturilla ±0,6-0,8. La recomendación de talla usa
las medidas que da el usuario tal cual; la malla solo se enseña.

**Revisar si** hace falta más precisión en la malla (por ejemplo, para
simular tela): entonces se despliega la API de `engine/` (ya preparada para
Cloud Run) y la app la usa cuando haya conexión.

## 2026-11-09 · El motor de tallas, también en TypeScript

**Decisión.** `app/src/core/fit.ts` es una copia del motor de Python. Los
dos se comparan en 620 casos generados por `engine/scripts/export_golden.py`
(mismas tallas, puntuaciones y textos). El CI del motor falla si cambia el
motor y no se regeneran los casos.

**Por qué.** Recomendar sin servidor. Python sigue siendo la referencia:
cualquier cambio de calibración se hace allí y se copia.

## 2026-11-09 · Catálogo compartido en Supabase (París)

**Decisión.** Proyecto `probador` en Supabase, región `eu-west-3`, plan
gratuito. Dos tablas: `garments` (lectura pública de lo publicado, sin
escritura desde la app) y `garment_submissions` (cualquiera envía, nadie lo
lee desde la app; entra como pendiente). Seguridad por fila comprobada con
el rol `anon`. La app lleva además el catálogo dentro y funciona sin él.

**Ojo.** En el plan gratuito el proyecto se pausa tras una semana sin uso;
la app sigue funcionando con el catálogo incluido. Con usuarios reales,
pasar al plan Pro (25 $/mes).

## 2026-11-09 · Guías de tallas oficiales transcritas, sin extracción automática

**Decisión.** El catálogo son guías de tallas (medidas del cuerpo) publicadas
por las propias marcas (44 guías de 18 marcas a 10 de noviembre), copiadas a
mano de sus páginas con la URL y la fecha en cada ficha. No hay ningún
programa que recorra webs de tiendas.

**Por qué.** Ver «Catálogo sin copiar webs de tiendas». Una guía por marca y
categoría cubre todas sus prendas de ese tipo, con muy pocos datos.

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
