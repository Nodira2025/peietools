# Bienvenida móvil de PEIE

La entrada `/` y el login conducen a `/bienvenida`. En celulares (o modo móvil elegido al ingresar), se muestra la nueva portada. En escritorio se redirige a `/dashboard`. “Iniciar” abre el dashboard original. El menú inferior conserva Mis Obras, Herramientas, Personal y Más; Mi perfil se encuentra en la portada y en Más, y también en la barra lateral de escritorio.

## Perfil y ubicación

`/perfil` permite elegir JPG, PNG o WebP de hasta 10 MB, previsualizar y guardar. La imagen se recorta al centro, se reduce a 384 × 384 y se guarda como JPEG en el campo existente `profiles.photo_url`, reemplazando la foto anterior mediante una actualización limitada al usuario autenticado. Reutiliza las políticas de acceso existentes. No requiere migración ni bucket adicional.

GPS se obtiene solo al pulsar Registrar/Actualizar ubicación. Guarda coordenadas, precisión y fecha en `user_metadata.peie_location` de la cuenta autenticada. Es información de ubicación declarada, nunca una prueba de asistencia, identidad o autorización. No realiza seguimiento continuo. El perfil permite actualizarla y ver su antigüedad. No se han añadido otros usos indefinidos de la ubicación.

El clima consulta Open-Meteo usando esa ubicación registrada; puede corresponder a un lugar anterior si la persona se trasladó y todavía no actualizó su GPS. La cotización se etiqueta como dólar oficial (DolarApi), no como BNA. Incluye fecha de actualización. Los servicios fallidos muestran falta de datos, nunca números de ejemplo.

## Redes verificadas el 21/09/2026

- Instagram: https://www.instagram.com/peie.tucuman/
- LinkedIn: https://ar.linkedin.com/company/peie-proyectos-e-instalaciones-el%C3%A9ctricas
- El perfil empresarial de LinkedIn enlaza a ese Instagram. No se pudo verificar un WhatsApp público ni una web independiente, por lo que no se inventaron enlaces.
- Clima: https://open-meteo.com/en/docs
- Cotización: https://dolarapi.com/docs/argentina/

## Fondo

Asset: `public/img/peie-welcome-background.png`. Generado con la herramienta integrada de imagegen, usando la referencia adjunta. Es una ilustración fotográfica generada; no representa un registro real de personal ni de una obra de PEIE.

Prompt utilizado:

> Create a photorealistic vertical 9:16 background photograph for PEIE electrical installations employee mobile app, inspired by the attached reference. ONLY background photograph, absolutely NO UI, no buttons, no portraits in circles, no text overlays or lettering. Bright blue sky in upper 45%, softly defocused electrical utility poles and cables on right, white service pickup truck on bottom left with blue accent panel, electrical technician viewed from behind on bottom right wearing navy uniform and white hardhat. Argentina urban neighborhood, daylight, soft editorial photography, pale light central negative space suitable for dark text overlay. Match the background scene of the reference closely. Save image for use in app.

## Verificación

`npm run build` y ESLint focalizado en los nuevos módulos. Pruebas de navegador con `node tests/logistics-qa-server.mjs` y `node tests/mobile-welcome.mjs`: entrada móvil, navegación al panel, GPS y clima, reemplazo de foto, ancho de 320 px, escritorio, permiso denegado y acceso sin servicios externos. Capturas en `scratch/welcome-qa`.

Las pruebas usan backend y respuestas externas simulados. No escriben cuentas reales ni acreditan despliegue en producción.
