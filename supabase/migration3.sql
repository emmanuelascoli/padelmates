-- Migration 3 : Table des amis (friendships)

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Voir ses propres demandes et celles reçues
CREATE POLICY "Voir ses amis" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Envoyer une demande d'ami
CREATE POLICY "Envoyer demande ami" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Accepter une demande reçue
CREATE POLICY "Accepter demande ami" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

-- Supprimer une amitié (les deux peuvent)
CREATE POLICY "Supprimer ami" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
