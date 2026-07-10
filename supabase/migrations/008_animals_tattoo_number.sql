-- Ajoute le numéro de tatouage comme alternative facultative au numéro de puce
-- électronique (certains animaux ne sont identifiés que par tatouage).
alter table public.animals
  add column if not exists tattoo_number text;
