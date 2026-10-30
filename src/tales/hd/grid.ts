// Grille HD des stories : 180 × 320 cellules de 6 px pour l'image 1080 × 1920, deux fois plus fine que la grille
// historique (P = 12, 90 × 160). Le texte bitmap du kit tombe pile dessus : une lettre = 5 × 7 cellules.
export const P = 6;
export const COLS = 180;
export const ROWS = 320;
/** Ligne du sol par défaut (même proportion que l'ancienne grille : 105 / 160). */
export const GROUND = 210;
/** Zone des sous-titres : rien d'essentiel sous cette ligne. */
export const CAPTION_ROW = 246;
