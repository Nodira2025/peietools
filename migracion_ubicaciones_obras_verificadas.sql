-- Ubicaciones verificadas mediante direcciones públicas y mapas oficiales.
-- No incluye obras ambiguas ni depósitos privados.

UPDATE public.obras
SET address = 'Av. Presidente Perón 300, Yerba Buena, Tucumán',
    latitude = -26.8050487,
    longitude = -65.2692353
WHERE name ILIKE '#300 - LINK';

UPDATE public.obras
SET address = 'Delfín Gallo s/n, Cevil Pozo, Tucumán',
    latitude = -26.835503,
    longitude = -65.102254
WHERE name ILIKE 'AEROPUERTO';

UPDATE public.obras
SET address = '9 de Julio 279, San Miguel de Tucumán, Tucumán',
    latitude = -26.8344083,
    longitude = -65.2057405
WHERE name ILIKE 'CLINICA MAYO';

UPDATE public.obras
SET address = 'La Rioja 846, San Miguel de Tucumán, Tucumán',
    latitude = -26.8409268,
    longitude = -65.2151625
WHERE name ILIKE 'LA RIOJA 846';

UPDATE public.obras
SET address = 'Boulevard 9 de Julio 1170, Yerba Buena, Tucumán',
    latitude = -26.8203598,
    longitude = -65.2842826
WHERE name ILIKE 'LIVE';

UPDATE public.obras
SET address = 'Av. Salta 560, San Miguel de Tucumán, Tucumán',
    latitude = -26.8221449,
    longitude = -65.2090723
WHERE name ILIKE 'ONE BOULEVARD';

UPDATE public.obras
SET address = 'Las Piedras 1668, San Miguel de Tucumán, Tucumán',
    latitude = -26.8314889,
    longitude = -65.2237528
WHERE name ILIKE 'PIEDRAS 1668';

UPDATE public.obras
SET address = 'Ruta Nacional 9 km 1288, Banda del Río Salí, Tucumán',
    latitude = -26.8501833,
    longitude = -65.1677722
WHERE name ILIKE 'SHELL OASIS';

UPDATE public.obras
SET address = 'Juan Bautista Alberdi 152, San Miguel de Tucumán, Tucumán',
    latitude = -26.8311300,
    longitude = -65.2143956
WHERE name ILIKE 'ALBERDI 152';
