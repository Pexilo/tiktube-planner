// Entrée Remotion isolée pour scripts/tale-check.mjs : une seule composition "tale-preview",
// avec le brouillon et le JSON fournis par alias webpack (@tale-story, @tale-json). Jamais chargée par le rendu normal.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Story } from "@tale-story";
import json from "@tale-json";
import app from "../../../content/apps/wheredgainsgo.json";
import { FORMATS, FPS } from "../../../shared/timeline.mjs";
import { renderedTale, taleTimeline } from "../../../shared/tales.mjs";
import type { AppContent } from "../../lib/types";
import type { TaleLang } from "../types";
import { makeTaleVideo } from "../TaleVideo";

// tale-check --lang=fr : la story telle que rendue dans la traduction (JSON préparé par le script, champ `previewLang`).
const tale = renderedTale(json, (json as { previewLang?: TaleLang }).previewLang ?? "en")!;
const Video = makeTaleVideo(Story);
const frames = (tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments)).totalFrames;

const PreviewRoot: React.FC = () => (
  <Composition id="tale-preview" component={Video} durationInFrames={frames} fps={FPS} {...FORMATS.short} defaultProps={{ tale, app: app as unknown as AppContent }} />
);

registerRoot(PreviewRoot);
