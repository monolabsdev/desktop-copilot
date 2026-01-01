import type { DocPage, NavGroup } from "../lib/docs-types";
import { backendApiPage } from "./backend-api";
import { configShortcutsPage } from "./config-shortcuts";
import { installationPage } from "./installation";
import { introductionPage } from "./introduction";
import { promptsCommandsPage } from "./prompts-commands";
import { quickStartPage } from "./quick-start";
import { toolsAiPage } from "./tools-ai";

export const DOC_PAGES: DocPage[] = [
  introductionPage,
  installationPage,
  quickStartPage,
  toolsAiPage,
  configShortcutsPage,
  promptsCommandsPage,
  backendApiPage,
];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { label: "Introduction", href: "/docs/introduction", icon: "book" },
      { label: "Installation", href: "/docs/installation", icon: "zap" },
      { label: "Quick Start", href: "/docs/quick-start", icon: "code" },
    ],
  },
  {
    title: "Core Systems",
    items: [
      { label: "Tools & AI", href: "/docs/tools-ai", icon: "code" },
      {
        label: "Config & Shortcuts",
        href: "/docs/config-shortcuts",
        icon: "settings",
      },
      {
        label: "Prompts & Commands",
        href: "/docs/prompts-commands",
        icon: "shield",
      },
    ],
  },
  {
    title: "UI + Backend",
    items: [{ label: "Backend APIs", href: "/docs/backend-api" }],
  },
];
