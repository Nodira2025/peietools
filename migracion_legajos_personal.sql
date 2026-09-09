-- Legajos privados de empleados
-- Mantiene la información sensible separada de public.empleados, que también
-- se utiliza en pantallas operativas y formularios públicos.

CREATE TABLE IF NOT EXISTS public.empleados_legajos (
  empleado_id UUID PRIMARY KEY REFERENCES public.empleados(id) ON DELETE CASCADE,
  dni TEXT,
  cuil TEXT,
  fecha_nacimiento DATE,
  nacionalidad TEXT,
  email TEXT,
  telefono_alternativo TEXT,
  domicilio TEXT,
  localidad TEXT,
  provincia TEXT,
  legajo TEXT,
  fecha_ingreso DATE,
  tipo_contrato TEXT,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_parentesco TEXT,
  contacto_emergencia_telefono TEXT,
  talle_ropa TEXT,
  talle_calzado TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empleados_legajos IS 'Información personal y laboral privada de cada empleado.';
COMMENT ON COLUMN public.empleados_legajos.observaciones IS 'Notas internas laborales; no almacenar diagnósticos médicos ni datos bancarios.';

CREATE UNIQUE INDEX IF NOT EXISTS empleados_legajos_dni_unique
  ON public.empleados_legajos (dni)
  WHERE dni IS NOT NULL AND btrim(dni) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS empleados_legajos_cuil_unique
  ON public.empleados_legajos (cuil)
  WHERE cuil IS NOT NULL AND btrim(cuil) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS empleados_legajos_numero_unique
  ON public.empleados_legajos (lower(legajo))
  WHERE legajo IS NOT NULL AND btrim(legajo) <> '';

CREATE OR REPLACE FUNCTION public.set_empleados_legajos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empleados_legajos_set_updated_at ON public.empleados_legajos;
CREATE TRIGGER empleados_legajos_set_updated_at
  BEFORE UPDATE ON public.empleados_legajos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empleados_legajos_updated_at();

ALTER TABLE public.empleados_legajos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Legajos visibles para administracion" ON public.empleados_legajos;
CREATE POLICY "Legajos visibles para administracion"
  ON public.empleados_legajos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'logistica')
    )
  );

DROP POLICY IF EXISTS "Legajos insertables por administracion" ON public.empleados_legajos;
CREATE POLICY "Legajos insertables por administracion"
  ON public.empleados_legajos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'logistica')
    )
  );

DROP POLICY IF EXISTS "Legajos actualizables por administracion" ON public.empleados_legajos;
CREATE POLICY "Legajos actualizables por administracion"
  ON public.empleados_legajos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'logistica')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'logistica')
    )
  );

DROP POLICY IF EXISTS "Legajos eliminables por administracion" ON public.empleados_legajos;
CREATE POLICY "Legajos eliminables por administracion"
  ON public.empleados_legajos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'logistica')
    )
  );

REVOKE ALL ON TABLE public.empleados_legajos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.empleados_legajos TO authenticated;
GRANT ALL ON TABLE public.empleados_legajos TO service_role;

