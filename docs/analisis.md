# Análisis: requisitos, riesgos y base de datos

Revisión del 10 de noviembre de 2026, con la versión 0.2 de la app. Sirve
para saber qué está resuelto, qué puede salir mal y qué hay que decidir.

## Qué tiene que hacer la app

| Requisito | Estado | Dónde |
| --- | --- | --- |
| Crear un maniquí 3D con pocas medidas, para cualquier persona adulta | Hecho | Asistente de 6 pasos; con altura y peso ya sale un cuerpo, y cada medida lo afina |
| Enseñar por dónde se toma cada medida | Hecho | Cinta amarilla sobre el maniquí (`core/bodyMarkers.ts`) y texto de cómo medir |
| Recomendar talla con explicación, zona a zona | Hecho | `core/fit.ts`, idéntico al motor de Python (620 casos de paridad) |
| Ver la prenda sobre el cuerpo con el mapa de ajuste | Hecho, aproximado | `core/garmentShell.ts`: separa la superficie según la holgura; no simula la caída de la tela |
| Catálogo de marcas con su fuente | 44 guías de 18 marcas | `data/catalog/marcas`, dentro de la app y en Supabase |
| Añadir cualquier prenda copiando su tabla | Hecho | «Añadir una prenda» |
| Comparar con una prenda propia | Hecho | Armario |
| Funcionar sin cuenta y sin enviar medidas | Hecho | Todo el cálculo es local |
| Funcionar sin conexión | Hecho | Catálogo incluido + copia local del compartido |
| iPhone, Android y web con el mismo código | Web comprobada; iOS y Android compilan, falta probar en un móvil real | Expo |
| Precios y enlace de compra | No | Necesita feeds de afiliación (ver `datos.md`) |
| Otros idiomas y pulgadas | No | Ver «Para todo el mundo» |

Requisitos de calidad que nos hemos puesto:

- **Privacidad por diseño.** Las medidas del cuerpo no salen del dispositivo.
  El servidor no tiene ninguna tabla donde quepan.
- **Honestidad de la recomendación.** Cada talla dice con qué confianza se
  recomienda, qué medidas son estimadas (con «≈» y su margen) y de dónde sale
  la guía. Las guías sin contrastar llevan aviso.
- **Coste cero hasta tener usuarios.** Sin servidores propios: la app es
  estática y la base de datos cabe en el plan gratuito.

## Rendimiento medido

Medido en Node en la máquina de desarrollo (un móvil de gama media será entre
3 y 6 veces más lento; aun así, todo queda por debajo de lo perceptible).

| Operación | Tiempo |
| --- | --- |
| Leer el modelo del maniquí (3,7 MB, una vez al abrir) | 5,8 ms |
| Estimar el cuerpo a partir de las medidas | 0,06 ms |
| Generar los 13.718 vértices del maniquí | 2,7 ms |
| Marcar una medida con la cinta (corte de la malla) | 1,4 ms |
| Recomendar talla en las 44 guías del catálogo | 2,3 ms (0,05 ms por guía) |
| Construir la prenda sobre el maniquí | 4,9 ms |

Tamaño de la versión web: 3,4 MB de JavaScript (0,85 MB comprimido) y 3,7 MB
del modelo (3,2 MB comprimido: ya está cuantizado y apenas se comprime más).

Dónde se quedará corto y qué hacer entonces:

- **Catálogo de más de ~3.000 prendas.** Hoy la pantalla «Probar» calcula la
  talla de todas al abrirse y las pinta en una sola lista. A partir de ahí hay
  que pintar solo las visibles (lista virtualizada) y calcular la talla al
  mostrarlas. Es un cambio acotado a esa pantalla.
- **Catálogo de más de ~20.000 prendas.** Deja de tener sentido descargarlo
  entero. La búsqueda pasa al servidor (índice de trigramas `pg_trgm` sobre
  marca y nombre, paginada) y el móvil solo guarda lo que el usuario mira.
- **Peso inicial.** El modelo del maniquí es la mitad de la descarga. Si hace
  falta, se puede bajar a 20 componentes (la mitad de tamaño) perdiendo algo
  de precisión en cuerpos extremos.

## Base de datos

Supabase, proyecto `probador`, región de París, plan gratuito. Esquema en
`supabase/migrations`.

| Tabla | Para qué | Lee | Escribe |
| --- | --- | --- | --- |
| `garments` | Catálogo publicado (una fila por guía o prenda, el contenido en JSON validado) | Cualquiera, solo lo publicado | Solo nosotros |
| `garment_removals` | Ids retirados, para que las apps los quiten de su copia | Cualquiera | Solo un disparador |
| `garment_submissions` | Prendas que proponen los usuarios, pendientes de revisión | Nadie desde la app | Cualquiera, máx. 30 por minuto |
| `fit_feedback` | «Me quedó pequeña / perfecta / grande», anónimo y voluntario | Nadie desde la app | Cualquiera, máx. 60 por minuto |

Decisiones de eficiencia:

- **Sincronización incremental.** La app guarda el catálogo y solo pide lo que
  cambió desde la última vez (`updated_at` mayor que el último recibido, con
  un índice parcial sobre las publicadas). En un día normal la respuesta es
  una lista vacía.
- **El servidor manda.** Si corregimos o retiramos una guía en Supabase, las
  apps ya instaladas usan la corrección sin esperar a una actualización de la
  tienda. Con datos transcritos a mano, poder corregir rápido importa.
- **Sin datos personales.** No hay usuarios, sesiones ni identificadores. Las
  valoraciones guardan el día, no la hora.
- **Seguridad por fila comprobada.** Con el rol anónimo se ha verificado que
  solo se leen prendas publicadas, que no se pueden leer aportaciones ni
  valoraciones, y que no se puede modificar el catálogo.

Límites del plan gratuito que nos afectan (comprobar los vigentes en
supabase.com/pricing antes de lanzar): el proyecto se pausa tras una semana
sin actividad y la base de datos tiene un tope de tamaño. El catálogo actual
ocupa menos de 1 MB, así que el tamaño no es problema; la pausa sí lo sería en
una beta con poco uso. Si ocurre, la app sigue funcionando con su catálogo
local y basta reactivar el proyecto. Pasar al plan de pago es el primer gasto
razonable cuando haya usuarios.

## Riesgos

### De producto

| Riesgo | Gravedad | Qué hacemos |
| --- | --- | --- |
| **La recomendación falla** y el usuario pierde la confianza a la primera | Alta | Confianza visible, medidas estimadas marcadas, explicación zona a zona. Falta calibrar con personas reales (`calibracion.md`): hoy las holguras son de manual de patronaje, no medidas en usuarios |
| **Las guías de marca son genéricas**: una misma guía para todas las camisetas de la marca, aunque cada modelo talle distinto | Alta | Se avisa en cada ficha («según la guía de la marca») y se prioriza la tabla de la prenda cuando existe. Las valoraciones dirán qué marcas tallan pequeño o grande |
| **El usuario se mide mal** | Media | Cinta en 3D por medida, avisos de valores raros y de combinaciones imposibles. No detecta un error de 3 o 4 cm |
| **Medirse da pereza** y se abandona en el asistente | Media | Con altura y peso ya hay maniquí; cada medida se puede saltar. Siguiente paso: estimar medidas a partir de «qué talla usas de tal marca» |
| **No hay prendas concretas**, solo guías por marca | Alta para crecer | Feeds de afiliación para precio y enlace, y prendas aportadas por usuarios. Sin esto la app es una calculadora de tallas, no un probador |

### De datos y legales

| Riesgo | Gravedad | Qué hacemos |
| --- | --- | --- |
| **Copiar datos de webs de tiendas**: sus condiciones suelen prohibir la extracción automática y en la UE las bases de datos tienen protección propia | Alta | No hay extracción automática. Guías oficiales copiadas a mano, con fuente y fecha; a escala, feeds de afiliación y acuerdos |
| **Marcas y logotipos de terceros** | Media | Solo el nombre de la marca, en texto, para identificar la guía. Sin logotipos. Conviene que lo revise un abogado antes de publicar en tiendas |
| **Datos corporales**: las medidas del cuerpo son datos personales y, según el uso, podrían tratarse como sensibles | Media | No salen del móvil, hay consentimiento explícito y borrado total. Si algún día hay cuentas o copia en la nube, hace falta base legal, política de privacidad completa y evaluación de impacto |
| **Menores** | Media | El maniquí solo cubre cuerpos adultos (140–210 cm) y el asistente lo dice en el primer paso. Falta declarar la edad mínima en las tiendas de apps |
| **Guías que cambian** sin avisar | Media | Cada guía guarda su fecha de consulta. Falta una revisión periódica (un aviso cuando una guía tenga más de 6 meses) |
| **Aportaciones falsas o basura** | Media | Nada se publica sin revisión manual; hay límite de envíos. La revisión no escala: hará falta un panel y reglas automáticas de coherencia |
| **Responsabilidad** si alguien compra por una recomendación equivocada | Baja | La app dice que la recomendación es orientativa. Falta ponerlo en unas condiciones de uso |

### Técnicos

| Riesgo | Gravedad | Qué hacemos |
| --- | --- | --- |
| **Sin probar en móviles reales** (solo web y compilación nativa) | Alta | Es lo siguiente: publicar en Expo Go y probar en iPhone y Android. El 3D usa `expo-gl`, que puede comportarse distinto en gama baja |
| **Cuerpos fuera de la muestra** (muy altos, muy bajos, embarazo, prótesis, asimetrías) | Media | El modelo avisa de valores raros pero dibuja un cuerpo «medio». Hay que decirlo y, a futuro, permitir ajustar zonas a mano |
| **Dos motores** (Python y TypeScript) que se desincronizan | Media | 620 casos comparados en cada cambio; el CI falla si difieren |
| **Dependencia de Anny y clad-body** para regenerar el maniquí | Baja | Versiones fijadas; el modelo generado va en el repositorio |
| **Almacenamiento local** que se pierde al cambiar de móvil o borrar la app | Media | Hoy se pierde todo. Opciones: exportar a un archivo o un código, o cuentas opcionales (cambia el análisis de privacidad) |
| **Proyecto de Supabase pausado** | Baja | La app funciona con su catálogo local |

### De negocio

| Riesgo | Gravedad | Qué hacemos |
| --- | --- | --- |
| **El nombre «Probador»** es genérico: difícil de registrar como marca y de encontrar en las tiendas de apps | Media | Decidir nombre antes de publicar (cambia icono, dominio y fichas) |
| **Las tiendas ya tienen recomendadores de talla** propios | Media | Nuestra diferencia es ser independientes y servir para todas las marcas, con el cuerpo en 3D. Hay que comprobar que eso le importa a alguien con una beta |
| **Modelo de ingresos** sin decidir | Media | Lo natural es afiliación (comisión por compra). Exige catálogo con enlaces y ser aceptados por las redes |

## Para todo el mundo

Lo que falta para que la app sirva de verdad a cualquiera, por orden de
impacto:

1. **Idiomas.** Todo está en español. Los textos del motor (explicaciones)
   salen de `core/fit.ts`; hay que separarlos en un diccionario para
   traducirlos sin tocar la lógica. Primero inglés.
2. **Unidades.** Solo centímetros y kilos. Para Estados Unidos y Reino Unido
   hacen falta pulgadas, libras y pies. La conversión es solo de presentación.
3. **Sistemas de tallas.** Cada guía usa el suyo (S/M/L, 38/40, W32, tallas de
   EE. UU.). Falta mostrar equivalencias cuando la marca las publica.
4. **Accesibilidad.** Los controles tienen etiqueta para lectores de pantalla
   y se respeta «reducir movimiento». Falta revisar contraste en los estados
   de color, tamaño de letra del sistema y que el mapa de ajuste no dependa
   solo del color (ya hay texto en los medidores, no en el 3D).
5. **Categorías que faltan.** Calzado, ropa interior, sujetadores (contorno y
   copa), ropa infantil y premamá, tallas grandes específicas.
6. **Cuerpos.** Solo dos formas de partida (femenina y masculina). El modelo
   admite más variación de la que ofrece la interfaz.

## Dudas abiertas

Decisiones que no puedo tomar yo:

1. **Nombre y marca** definitivos.
2. **Modelo de negocio**: afiliación, de pago, o gratis sin más.
3. **Publicación**: hace falta cuenta de desarrollador de Apple (99 USD al
   año) y de Google (25 USD una vez), y un `EXPO_TOKEN` para compilar.
4. **Calibración**: medidas reales de 5 a 10 personas y cómo les quedan
   prendas conocidas (`calibracion.md`).
5. **Revisión legal** de condiciones de uso, privacidad y uso de nombres de
   marcas antes de publicar.
6. **Quién revisa** las prendas que envían los usuarios.
