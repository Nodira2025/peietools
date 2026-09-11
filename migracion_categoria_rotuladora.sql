-- Registrar la sección sin crear equipos ni asignar códigos o ubicaciones.
INSERT INTO public.categorias_herramientas (name, description, icon_name, color)
VALUES ('Rotuladora', 'Rotuladoras e impresoras de etiquetas para identificar cables y equipos', 'Tag', '#f59e0b')
ON CONFLICT (name) DO NOTHING;
