-- ============================================================
-- Vérification des praticiens par documents justificatifs
-- ============================================================
-- Un praticien peut utiliser l'application immédiatement après son
-- inscription (pas d'attente bloquante), mais n'apparaît dans les
-- résultats de recherche ni sur sa fiche publique qu'une fois son
-- dossier de documents justificatifs validé par un administrateur.

alter type notification_type add value if not exists 'doctor_verified';
alter type notification_type add value if not exists 'doctor_rejected';

alter table public.doctors
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected'));
alter table public.doctors add column if not exists verification_rejected_reason text;

-- is_verified existait déjà dans le schéma mais n'était lu par aucune UI
-- jusqu'ici (aucune fonctionnalité de vérification n'était implémentée) ;
-- on aligne verification_status dessus pour ne pas casser les comptes
-- praticiens déjà en production.
update public.doctors
set verification_status = case when is_verified then 'verified' else 'pending' end;

-- ============================================================
-- TABLE: documents justificatifs déposés par le praticien
-- ============================================================
create table if not exists public.doctor_verification_documents (
  id uuid default uuid_generate_v4() primary key,
  doctor_id uuid references public.doctors(id) on delete cascade not null,
  file_url text not null,
  file_name text not null,
  document_type text,
  created_at timestamptz default now()
);

alter table public.doctor_verification_documents enable row level security;

drop policy if exists "doctor manages own verification documents" on public.doctor_verification_documents;
create policy "doctor manages own verification documents"
on public.doctor_verification_documents for all
using (doctor_id in (select id from public.doctors where user_id = auth.uid()))
with check (doctor_id in (select id from public.doctors where user_id = auth.uid()));

drop policy if exists "admin reads all verification documents" on public.doctor_verification_documents;
create policy "admin reads all verification documents"
on public.doctor_verification_documents for select
using (is_admin());

-- ============================================================
-- Empêche un praticien de s'auto-valider (contournement d'un update
-- direct sur doctors, en dehors de tout formulaire de l'application)
-- ============================================================
create or replace function prevent_self_verification()
returns trigger as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verification_rejected_reason is distinct from old.verification_rejected_reason)
     and not is_admin() then
    new.verification_status := old.verification_status;
    new.verification_rejected_reason := old.verification_rejected_reason;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists doctors_prevent_self_verification on public.doctors;
create trigger doctors_prevent_self_verification
before update on public.doctors
for each row execute function prevent_self_verification();

-- ============================================================
-- RPC : liste des praticiens en attente + leurs documents (admin uniquement)
-- ============================================================
create or replace function admin_list_pending_doctors()
returns jsonb
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'doctor_id', d.id,
      'user_id', d.user_id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'specialty', d.specialty,
      'email', u.email,
      'created_at', d.created_at,
      'documents', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', doc.id, 'file_url', doc.file_url, 'file_name', doc.file_name,
          'document_type', doc.document_type, 'created_at', doc.created_at
        ) order by doc.created_at asc), '[]'::jsonb)
        from public.doctor_verification_documents doc where doc.doctor_id = d.id
      )
    ) order by d.created_at asc)
    from public.doctors d
    join public.profiles p on p.user_id = d.user_id
    join public.users u on u.id = d.user_id
    where d.verification_status = 'pending'
  ), '[]'::jsonb);
end;
$$;

grant execute on function admin_list_pending_doctors() to authenticated;

-- ============================================================
-- RPC : décision admin (valider/rejeter) + notification au praticien
-- ============================================================
create or replace function admin_review_doctor(p_doctor_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  select user_id into target_user_id from public.doctors where id = p_doctor_id;
  if target_user_id is null then
    raise exception 'Praticien introuvable';
  end if;

  update public.doctors
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verification_rejected_reason = case when p_approve then null else p_reason end,
      is_verified = p_approve
  where id = p_doctor_id;

  insert into public.notifications (user_id, type, title, body)
  values (
    target_user_id,
    case when p_approve then 'doctor_verified' else 'doctor_rejected' end,
    case when p_approve then 'Profil vérifié ✓' else 'Documents non validés' end,
    case when p_approve
      then 'Votre profil praticien a été vérifié. Vous apparaissez désormais dans les résultats de recherche.'
      else coalesce('Vos documents n''ont pas pu être validés : ' || p_reason, 'Vos documents n''ont pas pu être validés. Merci de les redéposer depuis votre tableau de bord.')
    end
  );
end;
$$;

grant execute on function admin_review_doctor(uuid, boolean, text) to authenticated;

-- ============================================================
-- RPC : nombre de praticiens en attente (badge tableau de bord admin)
-- ============================================================
create or replace function admin_pending_doctors_count()
returns integer
language sql
security definer
as $$
  select case when is_admin() then (select count(*)::int from public.doctors where verification_status = 'pending') else 0 end;
$$;

grant execute on function admin_pending_doctors_count() to authenticated;

-- ============================================================
-- STOCKAGE : bucket privé pour les documents justificatifs
-- ============================================================
-- Privé (contrairement à "avatars"/"documents") : diplômes et pièces
-- d'identité ne doivent pas être accessibles via une URL publique
-- devinable. Le client génère une URL signée à l'upload (voir
-- useUploadVerificationDocument, valable 1 an) plutôt que getPublicUrl.

insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

drop policy if exists "doctor uploads own verification documents" on storage.objects;
create policy "doctor uploads own verification documents"
on storage.objects for insert
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = auth.uid())
);

drop policy if exists "doctor reads own verification documents" on storage.objects;
create policy "doctor reads own verification documents"
on storage.objects for select
using (
  bucket_id = 'verification-documents'
  and (
    (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = auth.uid())
    or is_admin()
  )
);

drop policy if exists "doctor deletes own verification documents" on storage.objects;
create policy "doctor deletes own verification documents"
on storage.objects for delete
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] in (select id::text from public.doctors where user_id = auth.uid())
);
