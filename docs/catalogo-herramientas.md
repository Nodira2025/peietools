# Catálogo de herramientas

El inventario se navega por **categoría principal → subcategoría → herramienta**. Por ejemplo: Escalera → 2 peldaños. La categoría Escalera muestra esa subcategoría incluso cuando no tiene unidades. Los demás grupos se forman con el inventario y las entradas registradas del catálogo.

Los nombres principales se unifican en singular y las medidas se ordenan numéricamente. Los códigos, nombres originales, marcas, modelos, estados, ubicaciones e historial se conservan. «Escalera 3» no significa automáticamente tres peldaños; las especificaciones no confirmadas quedan señaladas.

## Uso

- **Alta y edición:** elegir categoría principal y después una subcategoría de esa categoría. Cambiar la categoría reinicia la subcategoría. Las sugerencias asistidas se revisan antes de guardar.
- **Administrar catálogo:** disponible para Administración y Logística. Permite agregar categorías o variantes, y modificar entradas personalizadas. Los nombres del catálogo estándar se mantienen uniformes. Para eliminar una entrada debe estar libre de herramientas y subcategorías.
- **Excel:** exportar las columnas Categoría principal y Subcategoría, editar y cargar el archivo. La previsualización valida códigos, duplicados y pertenencia de cada subcategoría. También acepta la plantilla anterior con NUEVA CATEGORÍA. La aplicación no muestra éxito si una escritura es rechazada o queda incompleta.
- **Búsqueda y pedidos:** buscar por nombre original, nombre uniforme, marca, modelo, código o medida. «2 peldaños» no incluye herramientas de 12 peldaños y «7 pulgadas» no se deduce de una potencia de 750 W.
- **Regreso a la lista:** se conservan categoría, subcategoría, filtros y modo de vista. Las fotos se solicitan al mostrar las unidades, no al navegar categorías.

## Compatibilidad con los datos existentes

La clasificación compartida está en `src/lib/toolTaxonomy.ts`. Reconoce las etiquetas históricas y ofrece un único catálogo para los formularios, búsquedas, pedidos, mapa operativo y reportes.

Para incorporar la jerarquía con el esquema actual, las nuevas asignaciones se guardan en el campo existente `herramientas.category` como `Escalera › 2 peldaños`. Las variantes personalizadas usan el mismo formato en `categorias_herramientas.name`, conservando sus identificadores de registro. Ambos niveles se presentan en campos separados en la interfaz y las exportaciones. La pertenencia se valida en la aplicación; no se agregaron columnas ni restricciones nuevas a la base de datos.

Las etiquetas antiguas se interpretan al leerlas y no requieren una actualización masiva. Una asignación explícita guardada prevalece sobre las deducciones por nombre. Los cambios por Excel comprueban también la categoría anterior para evitar sobrescribir silenciosamente una clasificación modificada por otra persona.

La clasificación se contrastó con los 83 registros usados en la propuesta: las correspondencias coinciden. Esta verificación fue de lectura; las pruebas de altas, ediciones e importaciones utilizan datos ficticios y solicitudes interceptadas.

## Verificación

- `node tests/tool-taxonomy.mjs`: clasificación, medidas, búsquedas, orden y validaciones de Excel.
- `node tests/tool-catalog-regression.mjs`: navegación a 1280 y 390 px, filtros, recarga, alta, edición, importación aceptada/rechazada, variantes personalizadas y pedidos.
- `node tests/tool-edit-regression.mjs`: guardado confirmado, rechazo de permisos y error de red.
- `npm run build -- --outDir scratch/performance-dist --manifest` y `node tests/inventory-performance.mjs`: compilación, fotos diferidas y carga inicial del acceso.

Las pruebas de navegador requieren Playwright y Chrome. La comprobación general de TypeScript conserva errores anteriores del proyecto; los archivos nuevos y la navegación del catálogo se verifican también con ESLint y pruebas funcionales.
