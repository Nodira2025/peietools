-- ============================================================
-- AGREGAR CATEGORIA A HERRAMIENTAS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE herramientas ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Otros';

-- Auto-categorizar segun nombre
UPDATE herramientas SET category = 'Amoladoras' WHERE name ILIKE '%amoladora%';
UPDATE herramientas SET category = 'Taladros y Rotomartillos' WHERE name ILIKE '%taladro%' OR name ILIKE '%rotomartillo%';
UPDATE herramientas SET category = 'Corte' WHERE name ILIKE '%tijera%';
UPDATE herramientas SET category = 'Seguridad' WHERE name ILIKE '%arnes%' OR name ILIKE '%arnés%';
UPDATE herramientas SET category = 'Andamios y Escaleras' WHERE name ILIKE '%andamio%' OR name ILIKE '%escalera%';
UPDATE herramientas SET category = 'Gas' WHERE name ILIKE '%garrafa%';
UPDATE herramientas SET category = 'Electricidad' WHERE name ILIKE '%pinza%' OR name ILIKE '%resorte%';
