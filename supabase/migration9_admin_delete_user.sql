-- migration9_admin_delete_user.sql
-- Permet à un admin de supprimer le compte d'un autre utilisateur.
-- À exécuter dans Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION admin_delete_user(target_uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seuls les admins peuvent appeler cette fonction
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission refusée — réservé aux admins';
  END IF;

  -- Empêcher la suppression de son propre compte via cette fonction
  IF target_uid = auth.uid() THEN
    RAISE EXCEPTION 'Utilisez "Supprimer mon compte" pour supprimer votre propre compte';
  END IF;

  -- 1. Retirer de toutes les listes d'attente
  DELETE FROM session_waitlist WHERE user_id = target_uid;

  -- 2. Retirer de toutes les participations
  DELETE FROM session_participants WHERE user_id = target_uid;

  -- 3. Annuler les parties organisées encore ouvertes
  UPDATE sessions
    SET status = 'cancelled'
  WHERE organizer_id = target_uid
    AND status = 'open'
    AND date >= CURRENT_DATE;

  -- 4. Supprimer les demandes d'amitié
  DELETE FROM friendships
  WHERE requester_id = target_uid OR addressee_id = target_uid;

  -- 5. Supprimer le profil
  DELETE FROM profiles WHERE id = target_uid;

  -- 6. Supprimer le compte auth
  DELETE FROM auth.users WHERE id = target_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
