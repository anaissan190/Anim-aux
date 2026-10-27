-- ============================================================
-- ANIMÉAUX — Phase de pré-lancement praticiens (26/10/2026)
-- ============================================================
-- Avant l'ouverture aux propriétaires d'animaux, les praticiens créent un vrai compte
-- et indiquent la formule qui les intéresse, SANS paiement : on compte ainsi les
-- praticiens au fil de l'eau pour décider de l'ouverture (ou d'un report).
--
--   * app_settings : réglages globaux modifiables par l'admin. Les dates ne sont jamais
--     codées en dur (elles étaient fictives à la mise en place) :
--       launch_phase          'open' (comportement actuel, par défaut) | 'prelaunch'
--       public_launch_date    'AAAA-MM-JJ' ou '' (aucune date affichée)
--       prelaunch_threshold   entier ou '' (seuil de praticiens, lisible par l'admin seul)
--     Lecture publique des deux premiers ; tout le reste réservé à l'admin.
--   * doctor_intended_plans : la formule souhaitée par chaque praticien (intention, pas un
--     achat). Table à part plutôt qu'une colonne de doctors, dont les lignes sont lisibles
--     par tous ; ici le praticien ne lit que la sienne et l'admin tout.
--   * admin_set_setting / admin_prelaunch_stats / admin_prelaunch_list : voies réservées à
--     l'admin pour régler la phase, lire les compteurs et exporter la liste.
--   * prelaunch_excluded : comptes de démonstration (Gary, Lina) à ne pas compter parmi les
--     praticiens. Table réservée au serveur (aucune policy), lue par les fonctions admin.
--   * handle_new_user reprend la formule choisie à l'inscription (métadonnée intended_plan).
--
-- Retour arrière : drop table public.doctor_intended_plans, public.app_settings, public.prelaunch_excluded cascade ;
-- drop function public.admin_set_setting(text, text), public.admin_prelaunch_stats(),
-- public.admin_prelaunch_list(), public.set_my_intended_plan(text) ; puis recréer
-- handle_new_user depuis la migration 107.
-- ============================================================

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

drop policy if exists "app_settings: lecture" on public.app_settings;
create policy "app_settings: lecture" on public.app_settings for select using (
  key in ('launch_phase', 'public_launch_date') or is_admin()
);
-- Aucune policy d'écriture : seule admin_set_setting() écrit.

insert into public.app_settings (key, value) values
  ('launch_phase', 'open'),
  ('public_launch_date', ''),
  ('prelaunch_threshold', '')
on conflict (key) do nothing;

create or replace function public.admin_set_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  if p_key = 'launch_phase' then
    if p_value not in ('open', 'prelaunch') then raise exception 'Phase inconnue'; end if;
  elsif p_key = 'public_launch_date' then
    if p_value <> '' and p_value !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Date invalide'; end if;
  elsif p_key = 'prelaunch_threshold' then
    if p_value <> '' and p_value !~ '^\d{1,5}$' then raise exception 'Seuil invalide'; end if;
  else
    raise exception 'Réglage inconnu';
  end if;

  insert into public.app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into public.admin_actions_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_setting', 'setting', null, jsonb_build_object('key', p_key, 'value', p_value));
end;
$$;
grant execute on function public.admin_set_setting(text, text) to authenticated;

create table if not exists public.doctor_intended_plans (
  user_id uuid primary key references public.users(id) on delete cascade,
  intended_plan text not null check (intended_plan in ('free', 'pro', 'cabinet')),
  chosen_at timestamptz not null default now()
);
alter table public.doctor_intended_plans enable row level security;

drop policy if exists "doctor_intended_plans: le praticien lit la sienne" on public.doctor_intended_plans;
create policy "doctor_intended_plans: le praticien lit la sienne" on public.doctor_intended_plans
  for select using (user_id = auth.uid() or is_admin());
-- Aucune policy d'écriture : set_my_intended_plan() et handle_new_user() écrivent.

create or replace function public.set_my_intended_plan(p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plan not in ('free', 'pro', 'cabinet') then
    raise exception 'Formule inconnue';
  end if;
  if not exists (select 1 from public.doctors where user_id = auth.uid()) then
    raise exception 'Réservé aux praticiens';
  end if;
  insert into public.doctor_intended_plans (user_id, intended_plan, chosen_at)
  values (auth.uid(), p_plan, now())
  on conflict (user_id) do update set intended_plan = excluded.intended_plan, chosen_at = now();
end;
$$;
grant execute on function public.set_my_intended_plan(text) to authenticated;

-- ── handle_new_user : reprend la formule souhaitée (copie de la migration 107 + 1 bloc) ──
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role_val public.user_role;
  specialties_val text[];
  intended_plan_val text;
begin
  user_role_val := coalesce((NEW.raw_user_meta_data->>'role')::public.user_role, 'patient');

  insert into public.users (id, email, role, terms_accepted_at)
  values (
    NEW.id,
    NEW.email,
    user_role_val,
    case when (NEW.raw_user_meta_data->>'terms_accepted')::boolean is true then now() else null end
  )
  on conflict (id) do nothing;

  insert into public.profiles (user_id, first_name, last_name)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'first_name', ''),
    coalesce(NEW.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do nothing;

  if user_role_val = 'doctor' then
    if NEW.raw_user_meta_data->'specialties' is not null then
      select array_agg(value) into specialties_val
      from jsonb_array_elements_text(NEW.raw_user_meta_data->'specialties');
    else
      specialties_val := case
        when coalesce(NEW.raw_user_meta_data->>'specialty', '') = '' then '{}'::text[]
        else array[NEW.raw_user_meta_data->>'specialty']
      end;
    end if;

    insert into public.doctors (user_id, specialties, ethics_charter_accepted_at)
    values (
      NEW.id,
      coalesce(specialties_val, '{}'::text[]),
      case when (NEW.raw_user_meta_data->>'ethics_charter_accepted')::boolean is true then now() else null end
    )
    on conflict (user_id) do nothing;

    -- Valeur inconnue ou absente : aucune intention enregistrée, l'inscription n'échoue jamais pour ça.
    intended_plan_val := NEW.raw_user_meta_data->>'intended_plan';
    if intended_plan_val in ('free', 'pro', 'cabinet') then
      insert into public.doctor_intended_plans (user_id, intended_plan)
      values (NEW.id, intended_plan_val)
      on conflict (user_id) do nothing;
    end if;
  end if;

  return NEW;
end;
$$;

-- ── Comptes exclus du comptage (démonstration) ──
create table if not exists public.prelaunch_excluded (
  user_id uuid primary key references public.users(id) on delete cascade,
  note text
);
alter table public.prelaunch_excluded enable row level security;
-- Aucune policy : seules les fonctions SECURITY DEFINER ci-dessous et le SQL Editor y accèdent.

-- Gary et Lina (praticiens de démonstration, identifiants connus par leur début). Un compte déjà
-- supprimé n'est simplement pas trouvé. Ajouter un autre compte plus tard :
--   insert into public.prelaunch_excluded (user_id, note) values ('<id utilisateur>', 'test');
insert into public.prelaunch_excluded (user_id, note)
select d.user_id, 'compte de démonstration'
from public.doctors d
where d.id::text like '01e29b5f%' or d.user_id::text like '01e29b5f%'
   or d.id::text like 'ea2b9bdb%' or d.user_id::text like 'ea2b9bdb%'
on conflict (user_id) do nothing;

-- ── Compteurs admin (les comptes administrateurs et les comptes exclus ne comptent pas) ──
create or replace function public.admin_prelaunch_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  with base as (
    select d.id, d.user_id, d.specialties, d.verification_status, d.created_at, ip.intended_plan
    from public.doctors d
    join public.users u on u.id = d.user_id and not u.is_admin
    left join public.doctor_intended_plans ip on ip.user_id = d.user_id
    where not exists (select 1 from public.prelaunch_excluded x where x.user_id = d.user_id)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'verified', (select count(*) from base where verification_status = 'verified'),
    'pending', (select count(*) from base where verification_status = 'pending'),
    'rejected', (select count(*) from base where verification_status = 'rejected'),
    'last_7_days', (select count(*) from base where created_at >= now() - interval '7 days'),
    'by_plan', jsonb_build_object(
      'free', (select count(*) from base where intended_plan = 'free'),
      'pro', (select count(*) from base where intended_plan = 'pro'),
      'cabinet', (select count(*) from base where intended_plan = 'cabinet'),
      'none', (select count(*) from base where intended_plan is null)
    ),
    'by_specialty', coalesce((
      select jsonb_agg(jsonb_build_object('name', s.name, 'count', s.n) order by s.n desc, s.name)
      from (select sp as name, count(*) as n from base, unnest(base.specialties) as sp group by sp) s
    ), '[]'::jsonb),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object('week_start', w.week_start, 'count', w.n) order by w.week_start)
      from (
        select g.week_start, (select count(*) from base b where date_trunc('week', b.created_at) = g.week_start) as n
        from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as g(week_start)
      ) w
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
grant execute on function public.admin_prelaunch_stats() to authenticated;

create or replace function public.admin_prelaunch_list()
returns table (
  first_name text, last_name text, email text, specialties text[], city text,
  verification_status text, intended_plan text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return query
    select p.first_name::text, p.last_name::text, u.email::text, d.specialties, d.city::text,
           d.verification_status::text, ip.intended_plan, d.created_at
    from public.doctors d
    join public.users u on u.id = d.user_id and not u.is_admin
    left join public.profiles p on p.user_id = d.user_id
    left join public.doctor_intended_plans ip on ip.user_id = d.user_id
    where not exists (select 1 from public.prelaunch_excluded x where x.user_id = d.user_id)
    order by d.created_at desc;
end;
$$;
grant execute on function public.admin_prelaunch_list() to authenticated;

-- Dernier résultat affiché par le SQL Editor : les comptes effectivement exclus du comptage.
select p.first_name, p.last_name, u.email, x.note
from public.prelaunch_excluded x
join public.users u on u.id = x.user_id
left join public.profiles p on p.user_id = x.user_id;
