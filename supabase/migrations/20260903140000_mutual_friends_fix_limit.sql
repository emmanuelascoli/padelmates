-- Correction : augmente la limite des amis en commun retournés
-- (l'UI affiche jusqu'à 3 avatars mais le compteur doit être exact)
CREATE OR REPLACE FUNCTION public.get_mutual_friends(viewer_id uuid, target_id uuid)
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH viewer_friends AS (
    SELECT
      CASE WHEN requester_id = viewer_id THEN addressee_id ELSE requester_id END AS friend_id
    FROM friendships
    WHERE status = 'accepted'
      AND (requester_id = viewer_id OR addressee_id = viewer_id)
  ),
  target_friends AS (
    SELECT
      CASE WHEN requester_id = target_id THEN addressee_id ELSE requester_id END AS friend_id
    FROM friendships
    WHERE status = 'accepted'
      AND (requester_id = target_id OR addressee_id = target_id)
  )
  SELECT p.id, p.name, p.avatar_url
  FROM profiles p
  INNER JOIN viewer_friends vf ON p.id = vf.friend_id
  INNER JOIN target_friends tf ON p.id = tf.friend_id
  WHERE p.id <> viewer_id
    AND p.id <> target_id;
$$;
