-- Corrección puntual: el punto anterior estaba a unos 8 km del aeropuerto.
-- Referencia ORSNA para TUC (no representa una entrada específica a la obra).
-- https://qa2-back.argentina.gob.ar/sites/default/files/2023/05/iet-tuc_2013.pdf
-- Solo corrige el valor conocido erróneo o una ubicación todavía sin completar.
UPDATE public.obras
SET address = 'Delfín Gallo s/n, Cevil Pozo, Tucumán',
    latitude = -26.835503,
    longitude = -65.102254
WHERE upper(trim(name)) = 'AEROPUERTO'
  AND (
    latitude IS NULL OR longitude IS NULL
    OR (abs(latitude::double precision + 26.82184) < 0.000001
        AND abs(longitude::double precision + 65.18377) < 0.000001)
  )
RETURNING id, name, address, latitude, longitude;
