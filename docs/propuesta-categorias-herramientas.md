# Propuesta de categorías y subcategorías de herramientas

Propuesta inicial incorporada al proyecto. El funcionamiento y la compatibilidad de los datos están documentados en [Catálogo de herramientas](catalogo-herramientas.md).

Fuente: consulta de solo lectura a herramientas de Supabase (2026-09-11T21:00:46.158Z). Se recibieron 83 registros y 20 etiquetas distintas de categoría; 22 registros están en Otros. El alcance es lo visible para la conexión disponible.

## Recorrido

Herramientas → categoría principal → subcategoría → unidades identificadas por su código. Ejemplo: Escalera → 8 peldaños → ESC-10, ESC-12, ESC-8P-01, ESC01.

Escalera → 2 peldaños se muestra como ejemplo solicitado con 0 unidades confirmadas. No se deduce la medida de un identificador. En la planilla DDBB - 06-2026 (1).xlsx, RELEVAMIENTO DE HERRAMIENTAS AL!D13:F17 contiene Escalera 1 a 5 con Cant peldaños como detalle; no prueba su altura. Los datos actuales de la aplicación tienen prioridad sobre esa planilla histórica.

## Estructura propuesta a partir de los 83 registros

| Categoría principal | Unidades | Subcategorías (unidades) |
| --- | ---: | --- |
| Amoladora | 12 | 4 1/2 pulgadas (6); 7 pulgadas (6) |
| Andamio | 3 | Cuerpo (3) |
| Arnés | 2 | Tipo por confirmar (1); Completo (1) |
| Cable | 1 | Tipo y sección por confirmar (1) |
| Cajón de herramientas | 6 | Material por confirmar (4); Metálico (2) |
| Chocla | 1 | Sin variante registrada (1) |
| Cortacables | 1 | A criquet (1) |
| Escalera | 14 | Extensible (1); 11 peldaños (1); 8 peldaños (4); 10 peldaños (2); 6 peldaños (1); 5 peldaños (2); Peldaños por confirmar (1); 7 peldaños (2) |
| Escoba | 1 | De obra (1) |
| Garrafa | 2 | 3 kg (1); 2 kg (1) |
| Mecha | 2 | Copa (1); Pala (1) |
| Pala | 1 | De punta (1) |
| Pinza de indentar | 3 | Capacidad por confirmar (2); 16–120 mm² (1) |
| Pistola de calor | 2 | Potencia por confirmar (1); 2000 W (1) |
| Por clasificar | 3 | Retro · confirmar herramienta (3) |
| Resorte | 3 | 25 mm (1); 22 mm (1); 20 mm (1) |
| Rotomartillo | 7 | SDS Plus (2); Percutor (1); Demoledor (1); Tipo por confirmar (3) |
| Rotuladora | 1 | Sin variante registrada (1) |
| Soldador | 1 | De estaño · 60 W (1) |
| Sunchadora | 1 | Sin variante registrada (1) |
| Taladro | 8 | Inalámbrico (1); Tipo por confirmar (3); Percutor (4) |
| Tijera | 4 | Pelacables (2); De aviación (2) |
| Vaselina | 4 | Sólida (4) |

Por clasificar es una bandeja de revisión. Retro sin nombre técnico completo requiere confirmar el tipo: ROT02, TRP-01 y TRP-02. Retro Total SDS Plus sí se puede reunir con Rotomartillo por el nombre explícito. Sin variante registrada no supone una especificación técnica.

## Reglas uniformes

- Nombre principal en singular y escritura normal: Escalera, Amoladora, Taladro. Quitar espacios duplicados y unificar mayúsculas y tildes al comparar.
- Subcategorías por una característica útil para elegir dentro de cada familia: peldaños, diámetro, capacidad, tipo o variante. Las especificaciones faltantes quedan por confirmar.
- Escalera 8p y Escalera 8 peldaños se reúnen en Escalera / 8 peldaños. Pinza de identar se sugiere como alias de Pinza de indentar.
- Orden alfabético de familias y orden numérico de medidas: 2, 5, 6, 7, 8, 10, 11. Las opciones por confirmar quedan al final.
- Mantener marca, modelo, potencia, material, estado y ubicación como campos de la unidad; una dimensión puede alimentar su subcategoría cuando corresponda. Conservar códigos e historial.
- No convertir 750 W en un diámetro de 7 pulgadas; no asignar 13 mm o SDS Plus a equipos que no lo indican.
- Revisar marcas que contienen medidas, colores o descripciones: Cant peldaños, 6 pel, 5pel, Amarillo, Negra, Roja e Indentadora Manual. NC y Genérica no identifican un fabricante.
- Los nombres Pote 1/4 a Pote 4/4 no se convierten a capacidad; esa notación puede enumerar unidades. Vaselina sólida es la clasificación confirmada.
- Buscar también por nombre original, alias, código, marca y modelo. Mostrar conteos por subcategoría y filtros por estado y obra.

## Alcance planteado en la propuesta inicial

- Datos: catálogo con identificadores estables de categoría y subcategoría, relación obligatoria entre ambos, nombres únicos normalizados y asignación por herramienta. Preparar revisión de correspondencias y migración sin perder códigos ni historial.
- Herramientas.tsx: sustituir la agrupación opcional inferida por navegación de categorías y subcategorías, con ruta de regreso y conteos consistentes con los filtros.
- useCategories.ts y ModalGestionCategorias.tsx: administrar jerarquía y alias en un catálogo compartido; no volver a crear duplicados desde textos antiguos.
- NuevaHerramienta.tsx y HerramientaDetail.tsx: elegir categoría y luego una subcategoría dependiente. La extracción asistida debe sugerir valores válidos sin inventar especificaciones.
- ModalImportarCategoriasExcel.tsx y exportaciones: columnas separadas para Categoría principal y Subcategoría, validación del par, coincidencia por código y previsualización por registro.
- NuevaSolicitud.tsx, ToolAvailabilityAssistant.tsx y tipos de operaciones: utilizar la misma clasificación y alias para encontrar y solicitar herramientas.
- Verificación: búsqueda y navegación móvil, conservación de filtros al volver, importación sin duplicados, pertenencia de cada subcategoría a su categoría y carga de fotos solo al abrir unidades.

La clasificación propuesta está incorporada en la aplicación. Las especificaciones físicas dudosas continúan señaladas para su revisión. La implementación utiliza los campos existentes, como se explica en la guía del catálogo.
