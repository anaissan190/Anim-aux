-- 119_fix_export_my_data.sql
-- Audit du 05/10/2026 : export_my_data() (droit à la portabilité, RGPD art. 20 —
-- bouton "Télécharger mes données" du profil) lisait encore `public.vaccines`,
-- table renommée `care_items` par la migration 100 le 23/09/2026 : l'export
-- échouait donc pour TOUS les utilisateurs depuis cette date ("relation
-- vaccines does not exist") — même bug que delete_my_account (corrigé en 103),
-- manqué lors de la recherche de l'ancien nom parce que cette fonction vit
-- dans un fichier de juillet. Corrigé, et complété avec les données ajoutées
-- depuis la première version (partages de dossier, liste d'attente, favoris,
-- prestations personnelles, cabinet créé) qui manquaient à l'export.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  my_doctor_id uuid;
begin
  select id into my_doctor_id from public.doctors where user_id = auth.uid();

  select jsonb_build_object(
    'exporte_le', now(),

    'compte', (select to_jsonb(u) from public.users u where u.id = auth.uid()),
    'profil', (select to_jsonb(p) from public.profiles p where p.user_id = auth.uid()),
    'profil_praticien', (select to_jsonb(d) from public.doctors d where d.user_id = auth.uid()),

    'animaux', coalesce((
      select jsonb_agg(to_jsonb(a)) from public.animals a where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'suivis_sante', coalesce((
      select jsonb_agg(to_jsonb(c)) from public.care_items c
      join public.animals a on a.id = c.animal_id where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'suivi_poids', coalesce((
      select jsonb_agg(to_jsonb(w)) from public.weight_tracking w
      join public.animals a on a.id = w.animal_id where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'dossiers_medicaux', coalesce((
      select jsonb_agg(to_jsonb(h)) from public.health_records h
      join public.animals a on a.id = h.animal_id where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'documents_animaux', coalesce((
      select jsonb_agg(to_jsonb(doc)) from public.animal_documents doc
      join public.animals a on a.id = doc.animal_id where a.owner_id = auth.uid()
    ), '[]'::jsonb),
    'partages_de_dossier', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.animal_referrals r
      where r.owner_id = auth.uid()
         or (my_doctor_id is not null and (r.referring_doctor_id = my_doctor_id or r.target_doctor_id = my_doctor_id))
    ), '[]'::jsonb),

    'rendez_vous_en_tant_que_patient', coalesce((
      select jsonb_agg(to_jsonb(ap)) from public.appointments ap where ap.patient_id = auth.uid()
    ), '[]'::jsonb),
    'rendez_vous_en_tant_que_praticien', coalesce((
      select jsonb_agg(to_jsonb(ap)) from public.appointments ap
      where my_doctor_id is not null and ap.doctor_id = my_doctor_id
    ), '[]'::jsonb),

    'avis_laisses', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r where r.patient_id = auth.uid()
    ), '[]'::jsonb),
    'avis_recus', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r
      where my_doctor_id is not null and r.doctor_id = my_doctor_id
    ), '[]'::jsonb),

    'messages_envoyes', coalesce((
      select jsonb_agg(to_jsonb(m)) from public.messages m where m.sender_id = auth.uid()
    ), '[]'::jsonb),
    'messages_recus', coalesce((
      select jsonb_agg(to_jsonb(m)) from public.messages m where m.receiver_id = auth.uid()
    ), '[]'::jsonb),

    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n)) from public.notifications n where n.user_id = auth.uid()
    ), '[]'::jsonb),

    'favoris', coalesce((
      select jsonb_agg(to_jsonb(f)) from public.favorites f where f.patient_id = auth.uid()
    ), '[]'::jsonb),
    'liste_attente', coalesce((
      select jsonb_agg(to_jsonb(w)) from public.waitlist_entries w where w.patient_id = auth.uid()
    ), '[]'::jsonb),

    'disponibilites', coalesce((
      select jsonb_agg(to_jsonb(av)) from public.availabilities av
      where my_doctor_id is not null and av.doctor_id = my_doctor_id
    ), '[]'::jsonb),
    'prestations', coalesce((
      select jsonb_agg(to_jsonb(s)) from public.clinic_services s
      where my_doctor_id is not null and s.doctor_id = my_doctor_id
    ), '[]'::jsonb),
    'cabinet_cree', coalesce((
      select jsonb_agg(to_jsonb(c)) from public.clinics c where c.owner_id = auth.uid()
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.export_my_data() to authenticated;
