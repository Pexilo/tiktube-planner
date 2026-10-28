# Instagram : publication automatique des Reels

Chaque post **vidéo** TikTok concerné (les stories, ou tout, selon les Réglages) est aussi publié en **Reel** sur Instagram, à la même heure. Contrairement à TikTok, l'API Instagram publie directement : pas de brouillon à finir dans l'app.

L'API ne programme pas les posts : c'est la plateforme qui publie à l'heure prévue, elle doit donc tourner à ce moment-là. Les carrousels photo restent sur TikTok (Instagram exige des images hébergées sur une URL publique, au format 4:5 à 1,91:1).

## 1. Compte Instagram Pro

Dans l'app Instagram : **Paramètres → Type de compte et outils → Passer à un compte professionnel → Créateur**. Pas besoin de page Facebook.

## 2. App Meta

1. Sur [developers.facebook.com](https://developers.facebook.com), connecte-toi avec un **compte Facebook** (ton perso convient : il sert seulement à gérer l'app, rien n'apparaît dessus). Inscris-toi comme développeur si c'est demandé.
2. **Mes apps → Créer une app**, cas d'usage **« Gérer les messages et le contenu sur Instagram »**, sans portfolio business.
3. Dans l'app : **API Instagram → Configuration de l'API avec la connexion Instagram**.
   - Clique **Add all required permissions**.
   - Dans **Autorisations et fonctionnalités**, ajoute aussi **`instagram_business_content_publish`** (c'est elle qui permet de publier).

## 3. Ton compte comme testeur

1. **Rôles de l'app → Rôles → Ajouter des personnes → Testeur Instagram** → ton nom d'utilisateur Instagram.
2. Sur instagram.com : **Paramètres → Apps et sites web → Invitations de testeur → Accepter**.

L'app peut rester en mode développement : pas de contrôle app (App Review) pour publier sur ton propre compte testeur.

## 4. Token

1. Retour sur **Configuration de l'API avec la connexion Instagram**, étape **Générez des tokens d'accès → Ajouter un compte**, connecte ton Instagram et autorise.
2. Copie le token et colle-le dans le **guide d'installation → étape Instagram**, en choisissant la langue du compte : il est vérifié auprès d'Instagram puis enregistré dans `data/instagram-config.json` (ignoré par git, voir `instagram-config.example.json`) :

```json
{
  "appId": "ID d'app Instagram",
  "accounts": {
    "fr": { "accessToken": "IGAA…" },
    "en": { "accessToken": "IGAA…" }
  }
}
```

L'ancien format (`"accessToken"` à la racine) est converti tout seul en compte EN.

Le token dure 60 jours : la plateforme le renouvelle chaque semaine tant qu'elle tourne. Si elle reste éteinte plus de 60 jours, régénère-le à l'étape 4.

Les étapes **webhooks**, **connexion professionnelle Instagram** et **contrôle app** de la page Meta ne servent pas ici.

## 5. Activer

**Réglages → Instagram** : vérifie que le compte est « Connecté », choisis **Stories** ou **Tout** et les langues, puis active **Publier les Reels (auto)**. Seuls les posts prévus après l'activation partent ; pour un post plus ancien, utilise « Publier sur Instagram » sur sa carte dans l'onglet TikTok.

Limite Meta : 100 publications par 24 h via l'API (par compte).

## cloudflared (obligatoire)

Avec la connexion Instagram, l'API n'accepte pas l'envoi direct du fichier : elle télécharge la vidéo depuis une URL publique. Au moment de publier, la plateforme sert la vidéo à une adresse aléatoire via un tunnel Cloudflare rapide (sans compte), refermé dès qu'Instagram a fini de la traiter. Installe-le une fois :

- Windows : `winget install Cloudflare.cloudflared`
- macOS : `brew install cloudflared`

## Un compte Instagram FR et un compte EN

Chaque Reel part sur le compte de la langue de son post. Une langue sans compte ne publie rien ; un seul compte pour les deux langues ? Active **« Le compte … publie aussi le … »** dans Réglages → Instagram.

1. Passe les deux comptes en **Créateur** (étape 1).
2. Invite-les tous les deux comme **Testeur Instagram** dans la même app Meta, et accepte chaque invitation (étape 3).
3. Génère un token pour chacun : **Ajouter un compte** une 2e fois (étape 4), connecte l'autre compte Instagram.
4. Dans le guide d'installation, colle chaque token avec sa langue (FR ou EN).

Les comptes connectés apparaissent dans la barre latérale avec leur langue, et dans **Réglages → Instagram** (Retirer un compte : plus rien ne part dans sa langue, sauf compte partagé).
