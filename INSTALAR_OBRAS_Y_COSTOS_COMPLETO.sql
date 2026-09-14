-- VERSION COMPLETA 2026-09-14: ejecutar TODO el archivo en una consulta nueva.
-- Requiere las tablas base obras, empleados y herramientas.
-- Crea fases y liquidaciones si faltan, sin insertar avances ni sueldos de muestra.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.obra_fases') IS NULL THEN
    CREATE TABLE public.obra_fases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
      name text NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL,
      progress integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      status text DEFAULT 'Pendiente',
      responsable_name text,
      order_index integer DEFAULT 0,
      notes text,
      color text,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_obra_fases_obra_id ON public.obra_fases(obra_id);
    CREATE INDEX idx_obra_fases_dates ON public.obra_fases(start_date, end_date);
    ALTER TABLE public.obra_fases ENABLE ROW LEVEL SECURITY;
    CREATE POLICY obra_fases_authenticated ON public.obra_fases
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_fases TO authenticated;
  END IF;

  IF to_regclass('public.liquidaciones_sueldos') IS NULL THEN
    CREATE TABLE public.liquidaciones_sueldos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      empleado_id uuid REFERENCES public.empleados(id) ON DELETE CASCADE,
      empleado_nombre text NOT NULL,
      periodo_mes text NOT NULL,
      periodo_quincena text NOT NULL,
      fecha_desde date NOT NULL,
      fecha_hasta date NOT NULL,
      horas_trabajadas numeric NOT NULL DEFAULT 0,
      horas_ausente numeric DEFAULT 0,
      valor_hora numeric NOT NULL DEFAULT 0,
      sueldo_bruto numeric NOT NULL DEFAULT 0,
      bono_presentismo numeric DEFAULT 0,
      adelantos_descuentos numeric DEFAULT 0,
      total_neto numeric NOT NULL DEFAULT 0,
      estado text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'APROBADO', 'PAGADO')),
      observaciones text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.liquidaciones_sueldos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY liquidaciones_authenticated ON public.liquidaciones_sueldos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.liquidaciones_sueldos TO authenticated;
  END IF;
END $$;
ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS valor_hora numeric DEFAULT 0;
ALTER TABLE public.empleados ADD COLUMN IF NOT EXISTS valor_hora_extra numeric DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS obra_fases_id_obra_unique ON public.obra_fases(id, obra_id);
CREATE TABLE IF NOT EXISTS public.obra_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  fase_id uuid NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (fase_id, obra_id) REFERENCES public.obra_fases(id, obra_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS public.obra_tarea_personal (
  tarea_id uuid NOT NULL REFERENCES public.obra_tareas(id) ON DELETE CASCADE,
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE RESTRICT,
  categoria text NOT NULL DEFAULT '',
  horas numeric(12,2) NOT NULL CHECK (horas >= 0 AND horas < 'Infinity'::numeric),
  valor_hora numeric(16,2) NOT NULL CHECK (valor_hora >= 0 AND valor_hora < 'Infinity'::numeric),
  liquidacion_id uuid REFERENCES public.liquidaciones_sueldos(id) ON DELETE RESTRICT,
  PRIMARY KEY (tarea_id, empleado_id)
);
CREATE TABLE IF NOT EXISTS public.obra_tarea_herramientas (
  tarea_id uuid NOT NULL REFERENCES public.obra_tareas(id) ON DELETE CASCADE,
  herramienta_id uuid NOT NULL REFERENCES public.herramientas(id) ON DELETE RESTRICT,
  concepto text NOT NULL CHECK (btrim(concepto) <> ''),
  cantidad numeric(12,2) NOT NULL CHECK (cantidad > 0 AND cantidad < 'Infinity'::numeric),
  costo_unitario numeric(16,2) NOT NULL CHECK (costo_unitario >= 0 AND costo_unitario < 'Infinity'::numeric),
  PRIMARY KEY (tarea_id, herramienta_id)
);
CREATE INDEX IF NOT EXISTS obra_tareas_obra ON public.obra_tareas(obra_id);
CREATE INDEX IF NOT EXISTS obra_tareas_fase ON public.obra_tareas(fase_id);
CREATE INDEX IF NOT EXISTS obra_tarea_personal_liquidacion ON public.obra_tarea_personal(liquidacion_id);

ALTER TABLE public.obra_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_tarea_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_tarea_herramientas ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['obra_tareas','obra_tarea_personal','obra_tarea_herramientas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tareas_authenticated ON public.%I', tabla);
    EXECUTE format('CREATE POLICY tareas_authenticated ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tabla);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tabla);
  END LOOP;
END $$;

-- Valida incluso escrituras directas y serializa imputaciones de una liquidación.
CREATE OR REPLACE FUNCTION public.validar_imputacion_sueldo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE liquidacion public.liquidaciones_sueldos; usadas numeric;
BEGIN
  IF NEW.liquidacion_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO liquidacion FROM public.liquidaciones_sueldos WHERE id = NEW.liquidacion_id FOR UPDATE;
  IF NOT FOUND OR liquidacion.empleado_id <> NEW.empleado_id OR liquidacion.estado NOT IN ('APROBADO','PAGADO') OR liquidacion.horas_trabajadas <= 0 THEN
    RAISE EXCEPTION 'La liquidación debe estar aprobada o pagada, tener horas y pertenecer al electricista.';
  END IF;
  SELECT coalesce(sum(horas), 0) INTO usadas FROM public.obra_tarea_personal
    WHERE liquidacion_id = NEW.liquidacion_id AND (tarea_id, empleado_id) <> (NEW.tarea_id, NEW.empleado_id);
  IF usadas + NEW.horas > liquidacion.horas_trabajadas THEN
    RAISE EXCEPTION 'Las horas imputadas superan las horas de la liquidación. Disponibles: %', liquidacion.horas_trabajadas - usadas;
  END IF;
  NEW.valor_hora := round((liquidacion.sueldo_bruto + coalesce(liquidacion.bono_presentismo,0)) / liquidacion.horas_trabajadas, 2);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_imputacion_sueldo ON public.obra_tarea_personal;
CREATE TRIGGER validar_imputacion_sueldo BEFORE INSERT OR UPDATE ON public.obra_tarea_personal
  FOR EACH ROW EXECUTE FUNCTION public.validar_imputacion_sueldo();

CREATE OR REPLACE FUNCTION public.guardar_obra_tarea(tarea jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE tarea_uuid uuid := (tarea->>'id')::uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para guardar tareas.'; END IF;
  -- La transacción completa se revierte ante cualquier error de recursos o costos.
  INSERT INTO public.obra_tareas(id, obra_id, fase_id, name, progress)
    VALUES(tarea_uuid, (tarea->>'obra_id')::uuid, (tarea->>'fase_id')::uuid, tarea->>'name', (tarea->>'progress')::integer)
    ON CONFLICT(id) DO UPDATE SET fase_id = EXCLUDED.fase_id, name = EXCLUDED.name, progress = EXCLUDED.progress;
  DELETE FROM public.obra_tarea_personal WHERE tarea_id = tarea_uuid;
  DELETE FROM public.obra_tarea_herramientas WHERE tarea_id = tarea_uuid;
  INSERT INTO public.obra_tarea_personal(tarea_id, empleado_id, categoria, horas, valor_hora, liquidacion_id)
    SELECT tarea_uuid, empleado_id, categoria, horas, valor_hora, liquidacion_id
    FROM jsonb_to_recordset(tarea->'mano_obra') AS r(empleado_id uuid, categoria text, horas numeric, valor_hora numeric, liquidacion_id uuid)
    ORDER BY liquidacion_id, empleado_id;
  INSERT INTO public.obra_tarea_herramientas(tarea_id, herramienta_id, concepto, cantidad, costo_unitario)
    SELECT tarea_uuid, herramienta_id, concepto, cantidad, costo_unitario
    FROM jsonb_to_recordset(tarea->'herramientas') AS r(herramienta_id uuid, concepto text, cantidad numeric, costo_unitario numeric);
  RETURN tarea_uuid;
END $$;
REVOKE ALL ON FUNCTION public.guardar_obra_tarea(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_obra_tarea(jsonb) TO authenticated;
COMMIT;
SELECT 'Migración de tareas y costos completada' AS resultado,
  to_regclass('public.obra_fases') AS fases,
  to_regclass('public.liquidaciones_sueldos') AS liquidaciones,
  to_regclass('public.obra_tareas') AS tareas;
