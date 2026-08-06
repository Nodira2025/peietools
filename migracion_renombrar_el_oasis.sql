-- Migración para renombrar la obra "Shell Oasis" / "Oasis" a "El Oasis"
UPDATE public.obras 
SET name = 'El Oasis' 
WHERE name ILIKE '%Oasis%';
