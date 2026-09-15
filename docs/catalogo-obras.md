# Exportación de Mis obras

En el detalle de cada obra, **Exportar obra** y **Exportar todas las obras** aparecen juntos. La lista principal también permite exportar todas. La exportación conjunta usa todas las obras accesibles que cargó Mis obras, incluidas las inactivas, sin aplicar el buscador, los filtros ni el límite de tarjetas visibles.

El diálogo permite generar PDF o JPEG. El PDF reúne las páginas de las obras; JPEG ofrece una descarga por página. Cuando el navegador admite compartir archivos, aparece **Compartir archivos**, que abre el selector del dispositivo para elegir WhatsApp u otra aplicación.

Cada obra tiene páginas de trabajadores y herramientas, con logo y colores PEIE, nombre, ubicación, responsable, estado, fecha de generación y totales. El personal incluye foto, nombre y el rol registrado en `specialty`; las herramientas incluyen foto, nombre, código, marca y estado. Los trabajadores son los activos asignados y las herramientas se consultan por su ubicación actual.

Las consultas se realizan de nuevo al generar, paginadas en bloques de 500. Un error de consulta impide ofrecer una exportación parcial. Las fotos ausentes muestran «Sin foto»; si una URL falla, el diálogo lo informa y permite regenerar. Las imágenes necesitan permitir lectura CORS. No se guardan archivos ni se modifican asignaciones en la base de datos.

El diseño usa ocho tarjetas por página y se dibuja una página a la vez para limitar el uso de memoria del celular. PDF y JPEG comparten el mismo diseño; el PDF contiene las páginas como imágenes. Textos excepcionalmente largos se abrevian al alcanzar el espacio de su tarjeta.

Verificación: `node tests/obra-catalog.mjs` prueba la vista móvil, filtros y recarga, páginas JPEG, PDF individual/conjunto, obras vacías/inactivas, fotos fallidas y errores de datos, con datos ficticios y llamadas externas interceptadas. Las muestras se guardan en `scratch/obra-catalog`.
