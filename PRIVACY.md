# Privacy Policy — TikTube Planner

*Last updated: 25 October 2026* · [Version française plus bas](#politique-de-confidentialité)

TikTube Planner ("the App") is a private desktop tool that runs on its owner's own computer. Its owner uses it to render marketing videos for their own apps and to schedule them on their own YouTube channel and TikTok account. The App is not offered as a service to the public: it has no servers, no user accounts and no analytics.

## 1. Information the App accesses

**YouTube (Google).** When the owner connects their channel with Google OAuth, the App requests only:

- `youtube.upload`: upload the owner's videos to the owner's channel as private, scheduled videos, and set their thumbnails.
- `youtube.readonly`: read the channel's name and the status of the videos the App uploaded, to show them in the dashboard.

**TikTok.** When the owner connects their account with TikTok Login Kit, the App requests only:

- `user.info.basic`: open ID, display name and avatar, to show which account is connected.
- `video.upload`: send videos and photos to the account's TikTok inbox as drafts. Nothing is published automatically.

The App also stores the OAuth access and refresh tokens issued by Google and TikTok. It does not access subscribers, followers, comments, messages, analytics, contacts or any other data.

## 2. How information is used

Information is used only to connect the owner's own accounts and to publish the owner's own content at the scheduled time. It is not used for advertising, profiling, model training or any other purpose.

The App's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## 3. Storage and security

Tokens and account details are stored only on the owner's computer, in the App's local `data/` folder. They are never sent to the App's author or to any third-party server. Data is exchanged only with Google and TikTok, through their official APIs, to perform the actions above.

## 4. Sharing

No data is sold, rented or shared with third parties.

## 5. Retention and deletion

Data is kept only while an account stays connected. Access can be revoked at any time:

- Google: [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
- TikTok: Settings and privacy → Security → Apps and services permissions

Deleting the App's `data/` folder removes every stored token.

## 6. Children

The App is not intended for, and does not knowingly collect data from, anyone under 18.

## 7. Contact

This policy may be updated; the date above reflects the latest version. For any question, open an issue on [github.com/Pexilo/tiktube-planner](https://github.com/Pexilo/tiktube-planner/issues).

---

## Politique de confidentialité

*Dernière mise à jour : 25 octobre 2026*

TikTube Planner (« l'App ») est un outil de bureau privé qui tourne sur l'ordinateur de son propriétaire. Celui-ci l'utilise pour créer des vidéos promotionnelles de ses propres apps et les programmer sur sa propre chaîne YouTube et son propre compte TikTok. L'App n'est pas un service proposé au public : pas de serveur, pas de compte utilisateur, pas de mesure d'audience.

**Données consultées.** YouTube : `youtube.upload` (envoi des vidéos du propriétaire en privé programmé, miniatures) et `youtube.readonly` (nom de la chaîne, état des vidéos envoyées). TikTok : `user.info.basic` (identifiant, nom, photo du compte connecté) et `video.upload` (envoi en brouillon, rien n'est publié automatiquement). Ainsi que les jetons OAuth délivrés par Google et TikTok. Aucune autre donnée n'est consultée.

**Utilisation.** Uniquement pour connecter les comptes du propriétaire et publier son propre contenu à l'heure prévue. L'utilisation des données issues des API Google respecte la [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), y compris les exigences d'utilisation limitée.

**Stockage, partage, suppression.** Les jetons restent sur l'ordinateur du propriétaire (dossier `data/`) et ne sont jamais envoyés à l'auteur de l'App ni à un tiers. Aucune donnée n'est vendue ni partagée. L'accès peut être révoqué à tout moment sur [myaccount.google.com/permissions](https://myaccount.google.com/permissions) et dans TikTok (Paramètres et confidentialité → Sécurité → Autorisations des apps et services) ; supprimer le dossier `data/` efface tous les jetons.

**Contact.** Ouvre une issue sur [github.com/Pexilo/tiktube-planner](https://github.com/Pexilo/tiktube-planner/issues).
