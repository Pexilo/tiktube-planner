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
2. Copie le token et colle-le dans `data/instagram-config.json` (ignoré par git, voir `instagram-config.example.json`) :

```json
{
  "appId": "ID d'app Instagram",
  "accessToken": "IGAA…"
}
```

Le token dure 60 jours : la plateforme le renouvelle chaque semaine tant qu'elle tourne. Si elle reste éteinte plus de 60 jours, régénère-le à l'étape 4.

Les étapes **webhooks**, **connexion professionnelle Instagram** et **contrôle app** de la page Meta ne servent pas ici.

## 5. Activer

**Réglages → Instagram** : vérifie que le compte est « Connecté », choisis **Stories** ou **Tout** et les langues, puis active **Publier les Reels (auto)**. Seuls les posts prévus après l'activation partent ; pour un post plus ancien, utilise « Publier sur Instagram » sur sa carte dans l'onglet TikTok.

Limite Meta : 100 publications par 24 h via l'API.
