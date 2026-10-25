// Alias webpack posés par scripts/tale-check.mjs (brouillon à vérifier + son JSON).
declare module "@tale-story" {
  import type React from "react";
  import type { StoryProps } from "../types";
  export const Story: React.FC<StoryProps>;
}
declare module "@tale-json" {
  import type { Tale } from "../types";
  const tale: Tale;
  export default tale;
}
