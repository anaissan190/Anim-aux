-- ============================================================
-- Durcissement préventif : search_path explicite sur toutes les fonctions
-- SECURITY DEFINER ajoutées le 21 juillet 2026
-- ============================================================
-- Suite au bug critique corrigé en migration 052 (handle_new_user cassé
-- par un search_path manquant), on applique la même protection aux autres
-- fonctions SECURITY DEFINER ajoutées aujourd'hui, par prévention plutôt
-- qu'attendre qu'elles cassent au même titre.

alter function export_my_data() set search_path = public;
alter function prevent_self_verification() set search_path = public;
alter function admin_list_pending_doctors() set search_path = public;
alter function admin_review_doctor(uuid, boolean, text) set search_path = public;
alter function admin_pending_doctors_count() set search_path = public;
