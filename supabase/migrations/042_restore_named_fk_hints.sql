-- ============================================================
-- ANIMÉAUX — Restaure deux contraintes de clé étrangère nommées,
-- utilisées comme "hint" d'embed PostgREST par le code
-- (`profiles!doctors_user_id_profiles_fkey(...)` et
-- `profiles!reviews_patient_id_profiles_fkey(...)`), absentes des
-- migrations committées (ajoutées à l'origine directement dans
-- Supabase) et donc perdues avec le reste lors de l'incident.
-- ============================================================

alter table public.doctors
  add constraint doctors_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(user_id);

alter table public.reviews
  add constraint reviews_patient_id_profiles_fkey
  foreign key (patient_id) references public.profiles(user_id);

notify pgrst, 'reload schema';
