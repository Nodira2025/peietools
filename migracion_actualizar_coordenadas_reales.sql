-- ==============================================================================
-- MIGRACIÓN: Coordenadas y Direcciones Reales Verificadas de Obras en Tucumán
-- ==============================================================================

-- 1. QUALITY BN (Junin esq Santa Fe, SMT)
UPDATE public.obras
SET address = 'Junín esq. Santa Fe, San Miguel de Tucumán',
    latitude = -26.81880,
    longitude = -65.20732
WHERE name ILIKE '%QUALITY%';

-- 2. ONE RESIDENCE (Av. Mate de Luna y Thames, SMT)
UPDATE public.obras
SET address = 'Av. Mate de Luna y Thames, San Miguel de Tucumán',
    latitude = -26.82635,
    longitude = -65.22850
WHERE name ILIKE '%ONE RESIDENCE%';

-- 3. DOMUS (Boulevard 9 de Julio 1265, Yerba Buena)
UPDATE public.obras
SET address = 'Boulevard 9 de Julio 1265, Yerba Buena',
    latitude = -26.82045,
    longitude = -65.28450
WHERE name ILIKE '%DOMUS%';

-- 4. CANTARES (Diagonal Raúl Leccese RP 314 km 4.1, Tafí Viejo)
UPDATE public.obras
SET address = 'Diagonal Raúl Leccese (RP 314) km 4.1, Tafí Viejo',
    latitude = -26.77850,
    longitude = -65.23800
WHERE name ILIKE '%CANTARES%';

-- 5. COUNTRY SAN PABLO (Av. Solano Vera, RP339 Km 5, San Pablo)
UPDATE public.obras
SET address = 'Country San Pablo, Av. Solano Vera RP 339 Km 5, San Pablo',
    latitude = -26.85258,
    longitude = -65.31881
WHERE name ILIKE '%SAN PABLO%';

-- 6. BAMBOO (Anzorena y Cariola, Yerba Buena)
UPDATE public.obras
SET address = 'Anzorena y Cariola, Yerba Buena',
    latitude = -26.81820,
    longitude = -65.29050
WHERE name ILIKE '%BAMBOO%';

-- 7. #300 (Av. Presidente Perón 480, Yerba Buena)
UPDATE public.obras
SET address = 'Av. Presidente Perón 480, Yerba Buena',
    latitude = -26.80500,
    longitude = -65.27050
WHERE name ILIKE '%#300%';

-- 8. AEROPUERTO (Teniente Benjamín Matienzo, referencia oficial ORSNA)
-- Fuente: https://qa2-back.argentina.gob.ar/sites/default/files/2023/05/iet-tuc_2013.pdf
UPDATE public.obras
SET address = 'Delfín Gallo s/n, Cevil Pozo, Tucumán',
    latitude = -26.835503,
    longitude = -65.102254
WHERE name ILIKE 'AEROPUERTO';

-- 9. OASIS (Ex Ruta 9 Km 1288, Banda del Río Salí)
UPDATE public.obras
SET address = 'Ruta Nacional 9 km 1288, Banda del Río Salí',
    latitude = -26.85018,
    longitude = -65.16777
WHERE name ILIKE '%OASIS%';

-- 10. ARQUITECTOS Y ASOCIADOS (Catamarca y Corrientes, SMT)
UPDATE public.obras
SET address = 'Catamarca y Corrientes, San Miguel de Tucumán',
    latitude = -26.82150,
    longitude = -65.21100
WHERE name ILIKE '%ARQUITECTOS Y ASOCIADOS%';

-- 11. DITINIS (Pedro de Villalba y Moreno, Yerba Buena)
UPDATE public.obras
SET address = 'Pedro de Villalba y Moreno, Yerba Buena',
    latitude = -26.81350,
    longitude = -65.29570
WHERE name ILIKE '%DITINIS%';

-- 12. GHO (Moreno 262, Yerba Buena)
UPDATE public.obras
SET address = 'Moreno 262, Yerba Buena',
    latitude = -26.80717,
    longitude = -65.29570
WHERE name ILIKE '%GHO%';

-- 13. KANTAROSKY – LOPEZ (Sarmiento y Florida, Yerba Buena)
UPDATE public.obras
SET address = 'Sarmiento y Florida, Yerba Buena',
    latitude = -26.81500,
    longitude = -65.30350
WHERE name ILIKE '%KANTAROSKY%';

-- 14. LIVE (Boulevard 9 de Julio 1170, Yerba Buena)
UPDATE public.obras
SET address = 'Boulevard 9 de Julio 1170, Yerba Buena',
    latitude = -26.82036,
    longitude = -65.28428
WHERE name ILIKE '%LIVE%';
