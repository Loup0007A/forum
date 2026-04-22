# 🔐 Forum Privé Sécurisé

Forum privé entre amis — sécurisé, temps réel, complet.

---

## ✨ Fonctionnalités

### Sécurité
- 🔑 Authentification obligatoire — aucune page accessible sans connexion
- 🔒 Mots de passe hashés avec **Argon2id** (salt unique, coût élevé)
- 🛡️ 3 tentatives de connexion max → ban automatique IP + fingerprint + session
- 🤖 CAPTCHA (hCaptcha) après 2 échecs
- 🚫 JavaScript obligatoire (vérification client + serveur)
- 📝 Logs complets : IP, pays, navigateur, OS, actions, horodatage
- 🔐 JWT + sessions en base de données
- 🍪 Cookie HTTP-only sécurisé

### Forum
- 📂 Catégories → Forums → Sous-forums → Threads → Messages
- 🏷️ Tags, fil d'Ariane, recherche avancée
- ✏️ Éditeur avec Markdown, citations, pièces jointes
- 📊 Sondages (anonymes ou non)
- 💾 Brouillons auto-sauvegardés
- ⭐ Meilleure réponse (Q&R)
- 😄 Réactions par emoji

### Social
- 👤 Profils avec avatar, bio, signature, badges
- 👥 Suivre/ne plus suivre, liste noire
- ✉️ Messages privés
- 🔔 @mentions et notifications

### Gamification
- 🎖️ Rangs automatiques : Nouveau → Actif → Confirmé → Expert → Légende
- 🏅 Badges attribuables par l'admin
- 🏆 Points de réputation

### Chat temps réel
- 💬 Chat public via WebSocket (Socket.io)
- 🔒 Chat privé entre membres
- ✍️ Indicateur "en train d'écrire..."

### Administration
- 📊 Dashboard avec statistiques complètes
- ✅ Validation manuelle des inscriptions
- 🚫 Ban utilisateur / IP / fingerprint (temporaire ou permanent)
- 🛡️ Gestion des modérateurs
- 📋 Journal d'administration complet
- 🚩 Système de signalement

### Technique
- 🌐 PWA (installable sur mobile)
- 🌙 Thème sombre exclusif
- 🔒 Conformité RGPD (suppression de compte)
- 🚀 Prêt pour la production (Docker)

---

## 🚀 Installation rapide

### Prérequis
- Node.js 20+
- PostgreSQL 14+
- npm ou pnpm

### 1. Cloner et configurer

```bash
# Backend
cd backend
cp .env.example .env
# Éditer .env avec vos valeurs (DATABASE_URL, JWT_SECRET, SMTP_*, etc.)

# Frontend
cd ../frontend
cp .env.example .env
# Éditer .env si vous avez une clé hCaptcha
```

### 2. Backend

```bash
cd backend
npm install

# Pousser le schéma en base de données
npm run db:push

# Créer le compte admin initial
npm run db:seed

# Démarrer en développement
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend sera accessible sur **http://localhost:5173**
Le backend tourne sur **http://localhost:3001**

---

## 🐳 Déploiement avec Docker

### 1. Configurer les variables

```bash
cp backend/.env.example .env
# Remplir toutes les variables dans .env
```

### 2. Lancer

```bash
docker-compose up -d
```

Le forum sera accessible sur le **port 80**.

### Variables d'environnement essentielles

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@localhost:5432/forum_db` |
| `JWT_SECRET` | Clé secrète JWT (32+ chars) | `super-secret-key-change-this` |
| `ADMIN_EMAIL` | Email de l'admin | `admin@example.com` |
| `ADMIN_PASSWORD` | Mot de passe admin initial | `ChangeMe!2024` |
| `NOTIFY_EMAIL` | Email de notification inscriptions | `lr000000007@gmail.com` |
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` |
| `SMTP_USER` | Utilisateur SMTP | `your@gmail.com` |
| `SMTP_PASS` | Mot de passe SMTP / App password | `xxxx xxxx xxxx xxxx` |
| `VITE_HCAPTCHA_SITE_KEY` | Clé hCaptcha (frontend) | `10000000-ffff-ffff-...` |
| `CAPTCHA_SECRET_KEY` | Secret hCaptcha (backend) | `0x0000...` |

---

## 🔑 Première connexion

1. Allez sur **http://localhost:5173** (ou votre domaine)
2. Connectez-vous avec :
   - Email : celui configuré dans `ADMIN_EMAIL`
   - Mot de passe : celui configuré dans `ADMIN_PASSWORD`
3. **Changez immédiatement le mot de passe** dans Profil → Paramètres

---

## 📋 Flux d'inscription

1. Un utilisateur remplit le formulaire d'inscription
2. Son compte est créé avec le statut **PENDING**
3. Un email est envoyé automatiquement à `lr000000007@gmail.com`
4. L'admin se connecte → Admin → Utilisateurs → valide le compte
5. L'utilisateur reçoit un email de bienvenue et peut se connecter

---

## 🛡️ Sécurité en production

### Checklist obligatoire

- [ ] Changer `JWT_SECRET` (minimum 32 caractères aléatoires)
- [ ] Changer `SESSION_SECRET`
- [ ] Changer `ADMIN_PASSWORD` immédiatement après la première connexion
- [ ] Configurer HTTPS (Let's Encrypt / Cloudflare)
- [ ] Configurer hCaptcha (site key + secret key)
- [ ] Configurer SMTP pour les notifications
- [ ] Mettre `NODE_ENV=production`
- [ ] Mettre le forum derrière un reverse proxy (nginx/Cloudflare)
- [ ] Activer les backups PostgreSQL automatiques

### Générer des secrets sécurisés

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📁 Structure du projet

```
forum/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Schéma base de données (28 modèles)
│   │   └── seed.ts            # Initialisation admin + badges
│   ├── src/
│   │   ├── controllers/       # Logique métier
│   │   │   ├── auth.ts        # Login, register, logout + sécurité
│   │   │   ├── forum.ts       # Catégories et forums
│   │   │   ├── thread.ts      # Sujets + modération
│   │   │   ├── post.ts        # Messages + réactions
│   │   │   ├── user.ts        # Profils + MP + RGPD
│   │   │   └── admin.ts       # Dashboard + bans + stats
│   │   ├── middleware/
│   │   │   ├── auth.ts        # JWT + session + ban check
│   │   │   ├── requireJs.ts   # Blocage sans JS
│   │   │   └── logger.ts      # Logging des requêtes
│   │   ├── routes/            # Routeurs Express
│   │   ├── services/
│   │   │   └── socket.ts      # Socket.io (chat + notifications)
│   │   ├── utils/
│   │   │   ├── jwt.ts         # Gestion tokens et sessions
│   │   │   ├── geo.ts         # GeoIP + fingerprint
│   │   │   ├── email.ts       # Notifications email
│   │   │   └── logger.ts      # Winston
│   │   └── index.ts           # Point d'entrée Express + Socket.io
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # Page de connexion (terminal aesthetic)
│   │   │   ├── RegisterPage.tsx    # Inscription en 2 étapes
│   │   │   ├── ForumHome.tsx       # Accueil du forum
│   │   │   ├── ForumPage.tsx       # Liste des threads d'un forum
│   │   │   ├── ThreadPage.tsx      # Vue d'un thread avec posts
│   │   │   ├── NewThreadPage.tsx   # Création de sujet
│   │   │   ├── ProfilePage.tsx     # Profil utilisateur
│   │   │   ├── MessagesPage.tsx    # Messagerie privée
│   │   │   ├── SearchPage.tsx      # Recherche avancée
│   │   │   └── AdminPage.tsx       # Dashboard admin complet
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Structure principale
│   │   │   ├── Navbar.tsx          # Barre de navigation
│   │   │   ├── Sidebar.tsx         # Navigation latérale
│   │   │   ├── ChatPanel.tsx       # Chat temps réel
│   │   │   └── LoadingScreen.tsx   # Écran de chargement
│   │   ├── hooks/
│   │   │   ├── useAuth.ts          # Store Zustand auth
│   │   │   └── useSocket.ts        # Connexion Socket.io
│   │   ├── utils/
│   │   │   └── api.ts              # Client Axios + fingerprint
│   │   ├── styles/
│   │   │   └── globals.css         # Design system complet
│   │   ├── App.tsx                 # Routing principal
│   │   └── main.tsx                # Point d'entrée React
│   ├── nginx.conf
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## 🎖️ Système de rangs

| Rang | Points requis | Couleur |
|------|:---:|---|
| Nouveau | 0 | Gris |
| Actif | 50 | Vert |
| Confirmé | 300 | Bleu |
| Expert | 1 000 | Ambre |
| Légende | 5 000 | Rouge |

**Gains de points :**
- Créer un thread : +10 pts
- Publier un message : +5 pts

---

## 📜 Licence

Usage privé — forum entre amis. Ne pas distribuer publiquement.
