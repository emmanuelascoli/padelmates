# Guide de déploiement — PadelMates

Ce guide te permet de mettre l'application en ligne en ~30 minutes, **gratuitement** (hormis le nom de domaine).

---

## Ce dont tu as besoin

- Un compte **Supabase** (gratuit) → https://supabase.com
- Un compte **Vercel** (gratuit) → https://vercel.com
- Un compte **GitHub** (gratuit) → https://github.com
- Node.js installé sur ton ordinateur → https://nodejs.org (version 18+)
- Un nom de domaine (ex. padelmates.ch), ~15 CHF/an

---

## Étape 1 — Configurer Supabase (base de données)

1. Crée un compte sur https://supabase.com
2. Clique sur **"New project"**, choisis un nom (ex. `padelmates`) et un mot de passe fort
miwpo2-datkyJ-hufhij

3. Sélectionne la région **West EU (Frankfurt)** pour la Suisse
4. Attends que le projet se lance (~2 minutes)
5. Va dans **SQL Editor** (menu de gauche)
6. Clique **"New query"** et copie-colle tout le contenu du fichier `supabase/schema.sql`
7. Clique **"Run"** — tu verras les tables créées dans l'onglet **Table Editor**

### Récupérer tes clés API

1. Va dans **Settings → API** (menu de gauche)
2. Note ces deux valeurs :
   - **Project URL** (ex. `https://abcdefgh.supabase.co`)



   - **anon public key** (la clé longue qui commence par `eyJ...`)

---

## Étape 2 — Préparer le projet localement

1. Ouvre le dossier `paddle-app` dans ton terminal
2. Installe les dépendances :
   ```bash
   npm install
   ```
3. Crée un fichier `.env` à la racine du dossier (copie `.env.example`) :
   ```
   VITE_SUPABASE_URL=https://TON_PROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=ton_anon_key_ici
   ```
4. Lance en local pour tester :
   ```bash
   npm run dev
   ```
   → Ouvre http://localhost:5173 dans ton navigateur

---

## Étape 3 — Mettre le code sur GitHub

1. Crée un nouveau dépôt sur https://github.com/new (nomme-le `padelmates`, **privé** de préférence)
2. Dans ton terminal dans le dossier `paddle-app` :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TON_USERNAME/padelmates.git
   git push -u origin main
   ```

---

## Étape 4 — Déployer sur Vercel

1. Connecte-toi sur https://vercel.com avec ton compte GitHub
2. Clique **"Add New Project"**
3. Sélectionne ton dépôt `padelmates`
4. Dans **"Environment Variables"**, ajoute :
   - `VITE_SUPABASE_URL` → ta Project URL Supabase
   - `VITE_SUPABASE_ANON_KEY` → ta anon key Supabase
5. Clique **"Deploy"** — Vercel build et déploie automatiquement (~2 minutes)
6. Tu obtiendras une URL du type `https://padelmates.vercel.app`

---

## Étape 5 — Connecter ton nom de domaine

1. Achète un domaine (ex. sur Infomaniak pour la Suisse : https://www.infomaniak.com)
2. Dans Vercel → ton projet → **Settings → Domains**
3. Entre ton nom de domaine (ex. `padelmates.ch`)
4. Suis les instructions pour configurer les DNS chez ton registrar
5. Vercel gère automatiquement le certificat SSL (HTTPS)

---

## Étape 6 — Configurer l'authentification Supabase

Par défaut, Supabase envoie un email de confirmation lors de l'inscription.

**Pour désactiver la confirmation email** (plus pratique pour un petit groupe) :
1. Supabase → **Authentication → Settings**
2. Désactive **"Enable email confirmations"**

**Pour autoriser ton domaine** :
1. Supabase → **Authentication → URL Configuration**
2. Dans **"Site URL"**, entre ton URL Vercel ou ton domaine (ex. `https://padelmates.ch`)
3. Dans **"Redirect URLs"**, ajoute la même URL

---

## Personnalisation

### Changer le nom de l'app

Cherche et remplace `PadelMates` dans ces fichiers :
- `index.html` (titre de l'onglet)
- `src/components/Navbar.jsx`
- `src/pages/Auth.jsx`
- `src/pages/Home.jsx`

### Changer les couleurs

Les couleurs principales sont `emerald` (vert). Pour les changer, modifie toutes les occurrences de `emerald` dans les fichiers `.jsx` par une autre couleur Tailwind (ex. `blue`, `violet`, `orange`).

---

## Mises à jour futures

À chaque fois que tu modifies le code et que tu fais un `git push`, Vercel redéploie automatiquement. C'est magique !

```bash
git add .
git commit -m "Description de la modif"
git push
```

---

## Questions fréquentes

**Les emails de confirmation ne partent pas ?**
→ Désactive la confirmation email dans Supabase (voir Étape 6)

**L'app est lente au premier chargement ?**
→ C'est normal avec Vercel gratuit (cold start). Ça s'améliore avec l'usage.

**Comment inviter les membres ?**
→ Partage simplement l'URL du site. Ils s'inscrivent eux-mêmes.

**Comment sauvegarder les données ?**
→ Supabase (plan gratuit) garde tes données en permanence. Tu peux aussi exporter depuis le Table Editor.
