import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(null);
// Carte graphique (ANGLE) : rendus et Studio ~7 fois plus rapides sur les stories (cf. shared/platform.mjs, CHROMIUM).
Config.setChromiumOpenGlRenderer("angle");
