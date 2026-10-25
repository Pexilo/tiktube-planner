import React from "react";
import { Composition, Folder, Still } from "remotion";
import { buildTimeline, FORMATS, FPS, videoId } from "../shared/timeline.mjs";
import type { AppContent, Lang, VideoProps, VoiceTrack } from "./lib/types";
import { Video } from "./compositions/Video";
import { Thumbnail } from "./compositions/Thumbnail";
import { KeynoteVideo } from "./keynote/Keynote";
import { taleTimeline } from "../shared/tales.mjs";
import { makeTaleVideo } from "./tales/TaleVideo";
import type { StoryProps, Tale } from "./tales/types";
// Toutes les apps de content/apps/*.json sont chargées automatiquement (ajouter un fichier = nouvelles vidéos).
const appFiles = require.context("../content/apps", false, /\.json$/);
const ORDER = ["hyrox", "sociaflow", "beautyflow", "mrrkit", "decido", "revenuepilot"];
const APPS = appFiles
  .keys()
  .filter((k) => k.startsWith("./"))
  .map((k) => appFiles(k) as AppContent)
  .sort((a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99));
const LANGS: Lang[] = ["fr", "en"];
// Voix off (générée par scripts/gen-voice.mjs) : facultative.
const voiceFiles = require.context("../content", false, /^\.\/voices\.json$/);
const VOICES = (voiceFiles.keys().length ? voiceFiles(voiceFiles.keys()[0]) : {}) as Record<string, VoiceTrack>;
// Stories crypto : content/tales/<slug>.json + visuels src/tales/stories/<slug>.tsx (écrits par Claude, cf. src/tales/KIT.md).
// Les brouillons (src/tales/drafts) ne sont jamais chargés ici : un brouillon cassé ne casse pas le rendu.
const taleFiles = require.context("../content/tales", false, /\.json$/);
const storyFiles = require.context("./tales/stories", false, /\.tsx$/);
const TALE_APP = APPS.find((a) => a.slug === "wheredgainsgo");
const TALES = TALE_APP
  ? taleFiles
      .keys()
      .filter((k) => k.startsWith("./"))
      .map((k) => taleFiles(k) as Tale)
      .filter((t) => storyFiles.keys().includes(`./${t.slug}.tsx`))
      .map((tale) => ({
        tale,
        frames: (tale.timeline ?? taleTimeline(tale.beats, tale.voice?.segments)).totalFrames,
        component: makeTaleVideo((storyFiles(`./${tale.slug}.tsx`) as { Story: React.FC<StoryProps> }).Story),
      }))
  : [];

export const Root: React.FC = () => (
  <>
    {APPS.map((app) => (
      <Folder key={app.slug} name={app.slug}>
        {LANGS.map((lang) => (
          <React.Fragment key={lang}>
            {app.shorts.map((_, i) => {
              const props: VideoProps = { app, lang, kind: "short", shortIndex: i };
              return (
                <Composition
                  key={i}
                  id={videoId(app.slug, "short", lang, i)}
                  component={Video}
                  durationInFrames={buildTimeline(app, "short", i).totalFrames}
                  fps={FPS}
                  {...FORMATS.short}
                  defaultProps={props}
                />
              );
            })}
            {(app.stories ?? []).map((_, i) => {
              const id = videoId(app.slug, "story", lang, i);
              const voice = VOICES[id] ?? null;
              const props: VideoProps = { app, lang, kind: "story", shortIndex: i, voice };
              return (
                <Composition
                  key={`v${i}`}
                  id={id}
                  component={Video}
                  durationInFrames={buildTimeline(app, "story", i, voice).totalFrames}
                  fps={FPS}
                  {...FORMATS.short}
                  defaultProps={props}
                />
              );
            })}
            <Composition
              id={videoId(app.slug, "long", lang)}
              component={Video}
              durationInFrames={buildTimeline(app, "long").totalFrames}
              fps={FPS}
              {...FORMATS.long}
              defaultProps={{ app, lang, kind: "long", shortIndex: 0 } satisfies VideoProps}
            />
            {(app.keynote?.videos ?? []).map((k, i) => (
              <Composition
                key={`k${i}`}
                id={videoId(app.slug, "keynote", lang, i)}
                component={KeynoteVideo}
                durationInFrames={buildTimeline(app, "keynote", i).totalFrames}
                fps={FPS}
                {...(k.format === "long" ? FORMATS.long : FORMATS.short)}
                defaultProps={{ app, lang, kind: "keynote", shortIndex: i } satisfies VideoProps}
              />
            ))}
            <Still
              id={`${app.slug}-thumb-${lang}`}
              component={Thumbnail}
              {...FORMATS.thumb}
              defaultProps={{ app, lang, kind: "long", shortIndex: 0 } satisfies VideoProps}
            />
          </React.Fragment>
        ))}
      </Folder>
    ))}
    {TALE_APP && TALES.length ? (
      <Folder name="tales">
        {TALES.map(({ tale, frames, component }) => (
          <Composition key={tale.id} id={tale.id} component={component} durationInFrames={frames} fps={FPS} {...FORMATS.short} defaultProps={{ tale, app: TALE_APP }} />
        ))}
      </Folder>
    ) : null}
  </>
);
