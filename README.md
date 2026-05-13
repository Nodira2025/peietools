# PEIE Tools - App de Trazabilidad de Herramientas

PEIE Tools es una Aplicación Web Progresiva (PWA) diseñada con enfoque "mobile-first" para gestionar, rastrear y organizar el traslado de herramientas entre diferentes obras y depósitos.

## Características Principales
- **Sistema tipo Uber**: Los usuarios pueden solicitar herramientas, y el equipo de logística acepta y realiza los traslados confirmando el retiro y la entrega.
- **PWA (Progressive Web App)**: Instalable en dispositivos móviles iOS y Android.
- **Lectura de códigos QR**: Permite identificar herramientas rápidamente abriendo la cámara del dispositivo.
- **Mensajería Automatizada**: Integración con enlaces directos (`wa.me`) para enviar alertas vía WhatsApp.
- **Roles y Permisos**: Roles definidos para Administradores, Logística y Solicitantes.

## Tecnologías Utilizadas
- **Frontend**: React + Vite (TypeScript).
- **Estilos y UI**: Tailwind CSS y componentes de shadcn/ui.
- **Backend y Base de Datos**: Supabase (PostgreSQL y Auth).
- **PWA**: `vite-plugin-pwa`.

## Configuración y Variables de Entorno

Para ejecutar esta aplicación localmente o hacer el deploy, debes crear un archivo `.env` en la raíz del proyecto basado en el archivo `.env.example`:

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

## Base de Datos (Supabase)

En el archivo `supabase_schema.sql` (ubicado en la raíz del proyecto) se encuentran todas las instrucciones SQL necesarias para inicializar la base de datos en tu proyecto de Supabase.

**Instrucciones:**
1. Ve al "SQL Editor" en el panel de tu proyecto de Supabase.
2. Crea un nuevo script (Query).
3. Copia y pega todo el contenido de `supabase_schema.sql`.
4. Ejecuta el script. Esto creará las tablas, las políticas de seguridad (Row Level Security - RLS) y los datos iniciales de prueba.

## Scripts Disponibles

En el directorio del proyecto, puedes ejecutar:

- `npm install`: Instala las dependencias del proyecto.
- `npm run dev`: Inicia el servidor de desarrollo local.
- `npm run build`: Construye la aplicación para producción (necesario para probar la PWA localmente).
- `npm run preview`: Inicia un servidor local para previsualizar el build de producción.

## Despliegue (Deploy) a Netlify

Esta aplicación está lista para ser desplegada en Netlify u otras plataformas modernas:

1. Asegúrate de que el código esté subido a un repositorio de **GitHub**.
2. Entra a tu cuenta de **Netlify** y selecciona "Add new site" > "Import an existing project".
3. Conecta tu cuenta de GitHub y selecciona el repositorio de `PEIE Tools`.
4. Netlify debería detectar automáticamente que es un proyecto Vite y configurar:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Antes de darle a "Deploy site", haz clic en **"Show advanced"** y agrega las **Environment Variables**:
   - `VITE_SUPABASE_URL` = (tu URL de Supabase)
   - `VITE_SUPABASE_ANON_KEY` = (tu anon key de Supabase)
6. Haz clic en "Deploy site".

### Notas sobre Netlify (SPA Routing)
Vite genera una Single Page Application (SPA). Para que el enrutamiento funcione correctamente si un usuario recarga una página que no sea la raíz, debes asegurarte de crear un archivo `public/_redirects` con el siguiente contenido (ya está incluido en muchos flujos, pero es bueno verificarlo si obtienes errores 404 al recargar):
```
/*    /index.html   200
```
*(Nota: Este proyecto maneja la redirección usando configuraciones estándar de Vite, pero si encuentras problemas en Netlify, puedes añadir este archivo a la carpeta `public`).*
