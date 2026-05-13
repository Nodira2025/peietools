-- ============================================================
-- MIGRACION COMPLETA DESDE GOOGLE FORMS → PEIE TOOLS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. LIMPIAR DATOS DE PRUEBA (opcional, descomentar si queres empezar de cero)
-- DELETE FROM movimientos;
-- DELETE FROM solicitudes;
-- DELETE FROM herramientas;
-- DELETE FROM obras;

-- ============================================================
-- 2. INSERTAR TODAS LAS OBRAS (23)
-- ============================================================
INSERT INTO obras (name, address) VALUES
  ('One Boulevard', 'Salta 565'),
  ('Alberdi 152', 'Alberdi 152'),
  ('Domus', 'Boulevard 9 de Julio'),
  ('AltaVista', 'AltaVista'),
  ('San Pablo', 'San Pablo'),
  ('Quality Barrio Norte', 'Barrio Norte'),
  ('AlterPoint', 'AlterPoint'),
  ('Rioja 856', 'Rioja 856'),
  ('Las Piedras 1668', 'Las Piedras 1668'),
  ('YPF Banda del Rio Sali', 'Banda del Rio Sali'),
  ('Torre Duo - Link', 'Link'),
  ('Country Cantares', 'Country Cantares'),
  ('One Residence', 'Thames Norte'),
  ('Ituzaingo y Ruben Dario', 'Yerba Buena'),
  ('Shell Oasis', 'Banda del Rio Sali'),
  ('Oficina Nueva - Edificio Isaura', 'Edificio Isaura'),
  ('Casa Pringles', 'San Martin y Pringles'),
  ('#300 - Link', 'Link'),
  ('Bamboo', 'Bamboo'),
  ('Arquitectos y Asociados', 'Catamarca'),
  ('Coletti - Waldhaus', 'Waldhaus'),
  ('DEPOSITO PEIE', 'Deposito Central'),
  ('MANTENIMIENTO', 'Taller de Mantenimiento')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. INSERTAR TODAS LAS HERRAMIENTAS (30)
--    Asociadas al DEPOSITO PEIE por defecto
-- ============================================================
INSERT INTO herramientas (code, name, brand, model, status, current_obra_id)
SELECT code, name, brand, model, 'Disponible', deposito.id
FROM (VALUES
  ('A-41/2-01', 'Amoladora 4 1/2"', 'Hamilton', '4 1/2"'),
  ('A-41/2-02', 'Amoladora 4 1/2"', 'Skil', '4 1/2"'),
  ('A-41/2-03', 'Amoladora 4 1/2"', 'Hamilton', '4 1/2"'),
  ('A-41/2-04', 'Amoladora 4 1/2"', 'Black&Decker', '4 1/2"'),
  ('A-7-01', 'Amoladora 7"', 'Total', '7"'),
  ('A-7-02', 'Amoladora 7"', 'Total', '7"'),
  ('ANC-01', 'Cuerpo Andamio 1', NULL, NULL),
  ('ANC-02', 'Cuerpo Andamio 2', NULL, NULL),
  ('ANC-03', 'Cuerpo Andamio 3', NULL, NULL),
  ('ARN-01', 'Arnes', 'Amarillo', NULL),
  ('ESC-01', 'Escalera 1', NULL, NULL),
  ('ESC-02', 'Escalera 2', NULL, NULL),
  ('ESC-03', 'Escalera 3', NULL, NULL),
  ('ESC-04', 'Escalera 4', NULL, NULL),
  ('ESC-05', 'Escalera 5', NULL, NULL),
  ('GA-01', 'Garrafa', 'Negra', NULL),
  ('GA-02', 'Garrafa', 'Roja', NULL),
  ('PI-01', 'Pinza de identar', NULL, NULL),
  ('PI-02', 'Pinza de identar', NULL, NULL),
  ('RES-20-01', 'Resorte 20mm (3/4")', NULL, '20mm'),
  ('RES-22-01', 'Resorte 22mm (7/8")', NULL, '22mm'),
  ('RES-25-01', 'Resorte 25mm (1")', NULL, '25mm'),
  ('RTD01', 'Rotomartillo demoledor', 'Barovo', NULL),
  ('RTP-01', 'Rotomartillo percutor', 'Barovo', NULL),
  ('TCC-01', 'Tijera corta cable', NULL, NULL),
  ('TCC-02', 'Tijera corta cable', NULL, NULL),
  ('TP-01', 'Taladro percutor', 'Total', NULL),
  ('TP-02', 'Taladro chico', 'Barovo', NULL),
  ('TRP-01', 'Taladro rotopercutor', 'Dewalt', NULL),
  ('TRP-02', 'Taladro rotopercutor', 'Barovo', NULL)
) AS t(code, name, brand, model),
(SELECT id FROM obras WHERE name = 'DEPOSITO PEIE' LIMIT 1) AS deposito
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. INSERTAR PERSONAL (35 empleados)
--    Se crean como perfiles con rol 'encargado'
--    Creamos una tabla 'empleados' para el personal de campo
--    que aparece en los formularios (no necesitan login)
-- ============================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'operario',
    whatsapp TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS y dar acceso
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empleados_read" ON empleados;
CREATE POLICY "empleados_read" ON empleados FOR SELECT USING (true);
DROP POLICY IF EXISTS "empleados_write" ON empleados;
CREATE POLICY "empleados_write" ON empleados FOR ALL USING (true) WITH CHECK (true);

INSERT INTO empleados (full_name) VALUES
  ('Aguirresarobe, Marcelo'),
  ('Ale, Hector Antonio'),
  ('Altamiranda, Esteban German'),
  ('Alvarez, Carlos Antonio'),
  ('Blanco Medina, Juan Jose'),
  ('Blanco Medina, Yonatan Gabriel'),
  ('Carrizo, Luis Fabian'),
  ('Castro, Gustavo Mauricio'),
  ('Catan, David Nazareno'),
  ('Catan, Cristian Alejandro'),
  ('Cruz, Gustavo Manuel'),
  ('De la Rosa, Christian'),
  ('Espinoza, Facundo'),
  ('Flores, Hector Alexis'),
  ('Ibanez, Manuel Enrique'),
  ('Jimenez, Santiago Emanuel'),
  ('Juarez, Edgar Maximiliano'),
  ('Ledesma, Marcos German'),
  ('Lizarraga, Gustavo Matias'),
  ('Lobos, Eduardo Marcelo'),
  ('Lopez, Ramon Edgardo'),
  ('Lopez, Nicolas Eduardo'),
  ('Lopez, Leonardo Andres'),
  ('Lucena, Enzo Emanuel'),
  ('Martinez, Guillermo Ariel'),
  ('Medina, Franco Daniel'),
  ('Mendoza, Rene Nestor'),
  ('Olivera, Cristhian Gaston'),
  ('Paz, Jorge Gaston'),
  ('Rivero, Leandro Nicolas'),
  ('Rojas, Carlos Daniel'),
  ('Torres, Jorge Manuel'),
  ('Ybanez, Leonardo Dario'),
  ('Ybanez, Pablo Alejandro'),
  ('Moreno, Santiago')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACION (descomentar para verificar)
-- ============================================================
-- SELECT 'Obras' as tabla, count(*) as total FROM obras
-- UNION ALL
-- SELECT 'Herramientas', count(*) FROM herramientas
-- UNION ALL
-- SELECT 'Empleados', count(*) FROM empleados;

