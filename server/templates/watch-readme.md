# Dossier TikTok — mode d'emploi / how it works

Dépose ici un dossier par « lot » (ex. `MonApp-2026-10-20`). Studio l'analyse toutes les 2 minutes,
programme chaque carrousel / vidéo avec sa légende, puis range le lot dans `Programmés/`.
Drop one folder per batch here. Studio scans every 2 minutes, schedules each carousel / video
with its caption, then moves the batch into `Programmés/`.

```
MonApp-2026-10-20/
  LEGENDES.md              ← une légende par carrousel, FR + EN (format libre)
  fr/01-accroche/01.png …  ← un dossier d'images = un carrousel (1080×1920)
  en/01-hook/01.png …
  teaser.mp4               ← chaque vidéo = un post vidéo
```

- Pas de légende ? Claude en écrit une à partir du texte des slides.
- Les aperçus (`apercu*`, `previews/`, planches contact) sont ignorés.
- Les fichiers à la racine (comme celui-ci) sont ignorés : seuls les dossiers comptent.

## Demander à Claude de remplir ce dossier

> Crée 3 carrousels TikTok pour mon app <NOM> (6 slides 1080×1920 chacun, en français et en anglais)
> et dépose-les dans ~/Desktop/Tiktok/<NOM>-<DATE>/ : un sous-dossier par carrousel dans fr/ et en/
> (01.png, 02.png…), plus un fichier LEGENDES.md avec, pour chaque carrousel, le titre et la légende
> FR / EN (texte + hashtags).
