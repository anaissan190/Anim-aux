-- Permet au praticien de donner un nom personnalisé à chaque document
-- justificatif déposé (ex. "Diplôme ENVA 2019"), en plus du type
-- (Diplôme/Kbis/...) et du nom de fichier d'origine — demandé par Anaïs
-- le 22/09/2026 pour retrouver ses documents plus facilement dans la
-- liste, surtout quand le nom de fichier d'origine n'est pas parlant
-- (ex. "scan001.pdf").
alter table public.doctor_verification_documents
  add column if not exists document_label text;
