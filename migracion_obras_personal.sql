-- ============================================================
-- MIGRACION: Vincular Obras ↔ Encargados ↔ Empleados
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna encargado_name a obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS encargado_name TEXT;

-- 2. Agregar columna obra_id a empleados para vincularlos
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES obras(id);

-- 3. Agregar obra AEROPUERTO que no existia
INSERT INTO obras (name, address) VALUES ('Aeropuerto', 'Av. Santiago Gallo 4117 (SMT)')
ON CONFLICT DO NOTHING;

-- 4. Actualizar direcciones y encargados de cada obra
UPDATE obras SET address = 'Junin esq. Santa Fe (SMT)', encargado_name = 'Martin' WHERE name = 'Quality Barrio Norte';
UPDATE obras SET address = 'Salta 560 (SMT)', encargado_name = 'Martin' WHERE name = 'One Boulevard';
UPDATE obras SET address = 'Av. Mate de Luna y Thames (SMT)', encargado_name = 'Christian' WHERE name = 'Torre Duo - Link';
UPDATE obras SET address = 'Boulevard 9 de Julio 1265 (Yerba Buena)', encargado_name = 'Franco' WHERE name = 'Domus';
UPDATE obras SET address = 'Diagonal Lechesi (Tafi Viejo)', encargado_name = 'Franco' WHERE name = 'Country Cantares';
UPDATE obras SET address = 'Alberdi 185 (SMT)' WHERE name = 'Alberdi 152';
UPDATE obras SET address = 'Av Solano Vera RP339 Km 5 (San Pablo)' WHERE name = 'San Pablo';
UPDATE obras SET address = 'Anzorena y Cariola (Yerba Buena)' WHERE name = 'Bamboo';
UPDATE obras SET address = 'Av. Peron 480 (Yerba Buena)', encargado_name = 'Christian' WHERE name = '#300 - Link';
UPDATE obras SET address = 'Av. Santiago Gallo 4117 (SMT)', encargado_name = 'Martin' WHERE name = 'Aeropuerto';
UPDATE obras SET address = 'Ex Ruta 9 Km 1288 (Banda del Rio Sali)', encargado_name = 'Franco' WHERE name = 'Shell Oasis';

-- 5. Vincular empleados a obras
-- QUALITY BN
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Quality Barrio Norte' LIMIT 1) WHERE full_name IN ('Torres, Jorge Manuel', 'Ledesma, Marcos German');

-- ONE BOULEVARD
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'One Boulevard' LIMIT 1) WHERE full_name IN ('Aguirresarobe, Marcelo', 'De la Rosa, Christian');

-- DUO
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Torre Duo - Link' LIMIT 1) WHERE full_name IN ('Catan, David Nazareno', 'Rojas, Carlos Daniel', 'Lopez, Ramon Edgardo', 'Lobos, Eduardo Marcelo', 'Alvarez, Carlos Antonio', 'Medina, Franco Daniel', 'Ale, Hector Antonio');

-- DOMUS
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Domus' LIMIT 1) WHERE full_name IN ('Cruz, Gustavo Manuel', 'Blanco Medina, Yonatan Gabriel', 'Espinoza, Facundo');

-- CANTARES
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Country Cantares' LIMIT 1) WHERE full_name IN ('Lucena, Enzo Emanuel', 'Blanco Medina, Juan Jose', 'Altamiranda, Esteban German', 'Catan, Cristian Alejandro', 'Mendoza, Rene Nestor');

-- BAMBOO
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Bamboo' LIMIT 1) WHERE full_name IN ('Rivero, Leandro Nicolas', 'Olivera, Cristhian Gaston');

-- #300
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = '#300 - Link' LIMIT 1) WHERE full_name IN ('Lopez, Nicolas Eduardo', 'Lizarraga, Gustavo Matias', 'Jimenez, Santiago Emanuel', 'Castro, Gustavo Mauricio', 'Lopez, Leonardo Andres');

-- AEROPUERTO
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Aeropuerto' LIMIT 1) WHERE full_name IN ('Ybanez, Leonardo Dario', 'Carrizo, Luis Fabian', 'Martinez, Guillermo Ariel', 'Paz, Jorge Gaston', 'Ybanez, Pablo Alejandro');

-- OASIS
UPDATE empleados SET obra_id = (SELECT id FROM obras WHERE name = 'Shell Oasis' LIMIT 1) WHERE full_name IN ('Flores, Hector Alexis', 'Ibanez, Manuel Enrique');

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT o.name as obra, o.encargado_name as encargado, e.full_name as empleado
-- FROM obras o
-- LEFT JOIN empleados e ON e.obra_id = o.id
-- WHERE o.encargado_name IS NOT NULL
-- ORDER BY o.name, e.full_name;
