-- ============================================================
-- Droit à la portabilité des données (RGPD, art. 20)
-- ============================================================
-- Jusqu'ici, un utilisateur pouvait supprimer ses données (delete_my_account,
-- migration antérieure) mais pas les récupérer dans un format structuré.
-- Cette fonction agrège l'ensemble des données personnelles de l'utilisateur
-- connecté en un unique objet JSON, téléchargeable depuis /profil.
-- SECURITY DEFINER + auth.uid() : chacun ne peut exporter que ses propres
-- données, jamais celles d'un tiers.

create or replace function export_my_data()
returns jsonb
language plpgsql
security definer
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
    'vaccins', coalesce((
      select jsonb_agg(to_jsonb(v)) from public.vaccines v
      join public.animals a on a.id = v.animal_id where a.owner_id = auth.uid()
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

    'disponibilites', coalesce((
      select jsonb_agg(to_jsonb(av)) from public.availabilities av
      where my_doctor_id is not null and av.doctor_id = my_doctor_id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function export_my_data() to authenticated;
