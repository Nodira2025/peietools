# Legales · EDET y obras de PEIE

Página informativa interna en `/legales`, accesible mediante el menú de escritorio y «Más» en celular. Reutiliza la autenticación existente. No registra presentaciones, no genera certificados y no cambia la base de datos.

## Contenido y mantenimiento

Fecha de consulta: 11/09/2026. Fuentes, documentos, inspecciones y certificados se mantienen en `src/data/legales.ts`; la presentación está en `src/pages/Legales.tsx`. La fecha indica consulta de fuentes, no certificación de vigencia integral ni revisión automática.

Se diferencian requisitos publicados, requisitos sujetos a las condiciones de la obra y recomendaciones para preparar la carpeta técnica. Los enlaces oficiales aparecen en cada ficha aplicable y en la biblioteca final.

## Hallazgos que condicionan la información

- Usar EDET de Tucumán. No trasladar procedimientos de EDESA, EDESE, Edenor o de otras jurisdicciones.
- La página oficial de alta describe uso general y mantiene la denominación AFIP; verificar la constancia actual aceptada al presentar.
- El reglamento enlazado desde EDET contempla suministro provisorio de obra, garantía, conformidad para aumentos de potencia y transformación cuando la red sea insuficiente. Se referencia el texto legible publicado actualmente en el pie del sitio, sin declararlo una consolidación integral de modificaciones.
- La normativa de acometidas publicada limita sus planos a 10 kW. No extrapolar dimensiones, cables o esquemas a grandes demandas.
- Las preguntas frecuentes mencionan T2, T4 y T6 para grandes clientes y FP de 0,92. No asignar una tarifa o nivel de tensión automáticamente a partir de ello.
- No se encontró una lista pública exhaustiva de carpeta, inspecciones o certificado eléctrico único para todas las grandes obras consumidoras de EDET. No utilizar el formulario de generación distribuida como solicitud general de suministro.
- Los requisitos laborales, ART, IERIC y municipales tienen alcances propios. Un protocolo de medición no equivale a una habilitación eléctrica o final municipal.

## Pendientes por expediente

Completar ubicación/municipio, titular y representación, responsables con incumbencias y matrícula, cuadro de cargas por etapas, potencia solicitada y autorizada, respuesta técnica de EDET, tensión y medición, obras de red, visados, permisos, hitos de inspección, certificados, vigencias y pliego contractual. No se incorporaron potencias ni estados de cumplimiento inventados de obras de PEIE.

## Verificación realizada

- Compilación de producción correcta.
- Revisión de código de los dos archivos nuevos sin errores.
- Navegación de la aplicación y menú «Más» comprobados con sesión simulada, sin leer ni escribir datos reales.
- Vista de 1440 px y 390 px revisada; sin desbordamiento horizontal ni errores de ejecución. Enlaces internos y 13 accesos oficiales presentes.

Implementación preparada en el proyecto local; no publicada desde esta tarea.
