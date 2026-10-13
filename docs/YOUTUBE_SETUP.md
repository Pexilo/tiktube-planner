# Connecter YouTube (≈ 10 minutes, une seule fois)

La plateforme envoie tes vidéos avec l'API officielle **YouTube Data API v3**, en **privé programmé** (`publishAt`).
C'est YouTube qui les publie à l'heure prévue : ton Mac peut être éteint à ce moment-là.

## 1. Créer le projet Google Cloud

1. Va sur <https://console.cloud.google.com/> avec le compte Google **propriétaire de ta chaîne**.
2. En haut à gauche : **Sélectionner un projet → Nouveau projet** → nom : `Studio YouTube` → **Créer**.
3. Menu **API et services → Bibliothèque** → cherche **YouTube Data API v3** → **Activer**.

## 2. Écran de consentement OAuth

1. Menu **API et services → Écran de consentement OAuth** (ou **Google Auth Platform**) → **Commencer**.
2. Nom de l'application : `Studio YouTube` · e-mail d'assistance : ton e-mail → **Suivant**.
3. Audience : **Externe** → **Suivant** → coordonnées : ton e-mail → **Créer**.
4. Onglet **Audience** → **Utilisateurs test** → **Ajouter** ton adresse Gmail.
5. ⚠️ Toujours dans **Audience** : clique **Publier l'application** (statut « En production »).
   En mode « Test », Google fait expirer la connexion tous les 7 jours. En production (même non validée),
   elle reste valable. Au moment de te connecter tu verras « Google n'a pas validé cette application » :
   clique **Paramètres avancés → Accéder à Studio YouTube (non sécurisé)** — c'est normal, c'est ta propre app.

## 3. Créer l'identifiant

1. **API et services → Identifiants → Créer des identifiants → ID client OAuth**.
2. Type d'application : **Application de bureau** · nom : `Studio YouTube Mac` → **Créer**.
3. **Télécharger le JSON**, renomme-le **`client_secret.json`** et place-le ici :
   à la racine du projet (`client_secret.json`) — ou plus simple : glisse-le dans le guide d'installation (http://localhost:4321/setup.html), étape YouTube.

## 4. Connecter la chaîne

1. `npm start` (le dashboard s'ouvre sur <http://localhost:4321>).
2. Clique **Connecter YouTube** → choisis ta chaîne → accepte.
3. Le nom de ta chaîne apparaît en haut à droite ✅

## 5. ⚠️ Important : l'audit YouTube (à demander tout de suite)

Google impose une règle pour **tous** les projets API récents : tant que le projet n'a pas passé
l'**audit de conformité YouTube**, les vidéos envoyées par l'API restent **bloquées en privé**
(la date de publication programmée ne s'applique pas).

→ Remplis le formulaire gratuit : <https://support.google.com/youtube/contact/yt_api_form>
  - Choisis « YouTube API Services – Audit and Quota Extension ».
  - Usage : « Outil interne pour publier les vidéos de ma propre chaîne ».
  - Délai constaté : quelques jours à quelques semaines.

**En attendant l'audit**, tout le reste fonctionne : la plateforme rend toutes les vidéos, et pour chaque vidéo le
lecteur du dashboard propose **📋 Copier titre + description** et **📂 Afficher dans le Finder**
pour la programmer à la main dans YouTube Studio (glisser-déposer + « Programmer »), en 30 secondes par vidéo.

## Quota

Le quota gratuit est de 10 000 unités/jour. Un upload coûte ~1 600 unités, soit **6 vidéos par jour**.
La plateforme s'arrête d'elle-même au quota (réglable dans Réglages) et reprend le lendemain.
Avec l'autopilote et un horizon de 14 jours, c'est largement suffisant pour 1 Short/jour + 1 vidéo/semaine.

## Miniatures personnalisées

Les miniatures des vidéos 16:9 sont envoyées automatiquement **si ta chaîne est vérifiée par téléphone**
(<https://www.youtube.com/verify>). Sinon YouTube choisit une image et la plateforme l'indique.
