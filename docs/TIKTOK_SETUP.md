# Connecter TikTok (≈ 15 minutes, une seule fois)

Le module TikTok envoie tes posts (vidéos + carrousels photo) en **brouillon dans ta boîte TikTok** à l'heure prévue.
Tu reçois une notification TikTok sur ton téléphone, tu ajoutes un son tendance et tu publies en 2 taps.
Ton Mac affiche une alerte et **copie la légende** dans le presse-papiers au même moment.

> Pourquoi pas la publication 100 % automatique ? Sans « audit » TikTok (réservé aux apps grand public),
> les posts directs sont forcés en privé et ton compte devrait être privé. Le brouillon contourne ça proprement
> et te permet d'ajouter un son tendance — ce que tes LEGENDES.md recommandent de toute façon.

## 1. Créer l'app TikTok

1. Va sur <https://developers.tiktok.com/> → connecte-toi avec ton compte TikTok → **Manage apps → Connect an app**.
2. Nom : `Studio YouTube`, catégorie : *Productivity*. Plateforme : **Desktop**.
3. **Add products** : ajoute **Login Kit** et **Content Posting API**.
   - Dans Content Posting API, active **Upload** (pas besoin de « Direct Post »).
4. **Scopes** : coche `user.info.basic` et `video.upload`.
5. **Login Kit → Redirect URI (Desktop)** : `http://localhost:4321/tiktok/callback/`
6. Note le **Client key** et le **Client secret**.
7. Mode **Sandbox** : ajoute ton compte TikTok dans *Target users* pour tester tout de suite.
   Pour sortir du sandbox, clique **Submit for review** (explique : « outil personnel pour envoyer mes propres
   contenus en brouillon dans ma boîte TikTok »).

## 2. Vérifier le domaine des images (carrousels)

TikTok ne reçoit pas les images directement : il les **télécharge depuis une adresse web à toi**.
La plateforme les dépose donc d'abord sur ton site (`https://monsite.com/tiktok/…`).

1. Dans le portail TikTok : **URL properties → Add URL property → URL prefix** → `https://monsite.com/tiktok/`.
2. TikTok te donne un petit fichier de vérification (`tiktokXXXX.txt`) : dépose-le dans le dossier `/www/tiktok/`
   de ton hébergement (FileZilla, ou le gestionnaire de fichiers OVH), puis clique **Verify**.

## 3. Remplir la config

Copie `tiktok-config.example.json` vers **`data/tiktok-config.json`** et remplis :
- `clientKey` / `clientSecret` (étape 1),
- `hosting` : les accès FTP/SFTP de ton hébergement (OVH : Espace client → Hébergements → FTP-SSH).
  `protocol` = `sftp` (recommandé) ou `ftp`. `remoteDir` = dossier où déposer les images,
  `publicBaseUrl` = l'adresse publique correspondante.

Ce fichier reste sur ton Mac (`data/` est exclu de git).

## 4. Connecter ton compte

Dashboard → onglet **TikTok** → **Connecter mon TikTok** → accepte.

## Import intelligent (le plus simple)

Glisse dans la zone ✨ **un dossier entier**, ou des `.md` + des images **en vrac** :
1. le texte de chaque image est lu en local (Vision d'Apple, rien ne sort du Mac) ;
2. les images sont regroupées en carrousels et remises dans l'ordre (noms `fr-D1…`, sous-dossiers, compteurs « 1/6 ») ;
3. chaque carrousel est associé à sa légende (repère D/E/F, langue, mots communs, nombre de slides) ;
4. au moindre doute, **Claude** (via le `claude` installé sur ton Mac, ton abonnement) reconstitue tout par le sens ;
5. des images sans légende ? Claude en écrit une propre (titre + description + hashtags) dans la langue des slides.

Chaque carrousel affiche un badge : ✅ association sûre · 🟡 à jeter un œil · ⚠️ à vérifier.
Le bouton **📅 Programmer tous les brouillons** les étale (1/jour à l'heure choisie) dans l'ordre conseillé par ton `.md`.

## Utilisation

- **Glisse un `.md`** : chaque section `##` devient un post (titre = la section ou `Titre :`,
  description = `Description :` / `Légende :` / les lignes en citation `>`, + `Hashtags :`).
- **Carrousel** : glisse jusqu'à 35 images sur la carte (la 1re = couverture). Elles sont converties en JPEG 1080×1920 max.
- **Vidéo** : choisis une vidéo rendue du catalogue (légende pré-remplie depuis le SEO YouTube).
- Mets une **date** → le post passe en « Programmé ». À l'heure dite, il part dans ta boîte TikTok.
- Le Mac doit être allumé et la plateforme lancée (icône ▶) à l'heure prévue.

Limites TikTok : titre 90 caractères, description 4 000, 35 images, ~15 posts/jour par compte.

## Dossier surveillé (~/Desktop/Tiktok)

Dépose un dossier (un « lot ») dans `~/Desktop/Tiktok` :

```
Tiktok/
  MonApp-2026-10-12/
    LEGENDES.md            ← légendes (n'importe quel format lisible), facultatif
    fr/01-sujet/01.png …   ← un dossier d'images = un carrousel (langue n'importe où dans le chemin)
    en/01-topic/01.png …
    video-teaser.mp4       ← chaque vidéo = un post vidéo
```

Toutes les 2 minutes (ou bouton « Analyser maintenant » dans l'onglet TikTok), la plateforme :
1. attend que la copie soit finie (aucun fichier modifié depuis 1 min) ;
2. lit les 3 premières slides de chaque carrousel (OCR) et demande à Claude d'associer chaque carrousel à sa légende,
   recopiée mot pour mot (sinon Claude en écrit une, marquée « À jeter un œil ») ;
3. ignore les aperçus (`apercu*`, `apercus/`, planches contact) ;
4. programme tout sur les créneaux libres — FR 12:30 · 19:00, EN 15:00 par défaut (Réglages → TikTok) —
   en alternant les apps ;
5. range le dossier dans `Tiktok/Programmés/`.

Si TikTok refuse un envoi parce que trop de brouillons attendent dans ta boîte (`spam_risk_too_many_pending_share`,
~5 max), le post n'est pas perdu : nouvel essai automatique toutes les 2 h. Un créneau manqué (Mac éteint) part
dès que la plateforme tourne à nouveau.

## Un compte TikTok FR et un compte EN

La plateforme gère **un compte par langue** avec la même app TikTok : chaque post part dans la boîte du compte
de sa langue.

1. Ajoute les deux comptes dans **Sandbox settings → Target users**.
2. TikTok connecte le compte **ouvert dans ton navigateur** : ouvre le compte FR sur tiktok.com, puis
   **Réglages → TikTok → Connecter le compte FR**.
3. Change de compte sur tiktok.com, puis **Connecter le compte EN**.

Un seul compte ? Connecte-le sur une langue : il reçoit aussi l'autre. Les jetons sont dans
`data/tiktok-token-fr.json` et `data/tiktok-token-en.json` (l'ancien `tiktok-token.json` devient le compte EN).
