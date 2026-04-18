-- ────────────────────────────────────────────────────────────────
-- migration5_delete_account.sql
-- Fonction SECURITY DEFINER permettant à un utilisateur authentifié
-- de supprimer son propre compte (données + auth.users).
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  -- S'assurer que l'appelant est authentifié
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Retirer de toutes les listes d'attente
  DELETE FROM session_waitlist WHERE user_id = uid;

  -- 2. Retirer de toutes les participations
  DELETE FROM session_participants WHERE user_id = uid;

  -- 3. Annuler les parties organisées qui ne sont pas encore passées
  UPDATE sessions
    SET status = 'cancelled'
  WHERE organizer_id = uid
    AND status = 'open'
    AND date >= CURRENT_DATE;

  -- 4. Supprimer les demandes d'amitié
  DELETE FROM friendships
  WHERE requester_id = uid OR addressee_id = uid;

  -- 5. Supprimer le profil (les FK en CASCADE s'occupent du reste)
  DELETE FROM profiles WHERE id = uid;

  -- 6. Supprimer le compte auth (SECURITY DEFINER donne accès à auth.users)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Autoriser les utilisateurs connectés à appeler cette fonction
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
