const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

type ParsedKeybinding = {
  key: string | null;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  cmdOrCtrl: boolean;
};

const normalizeKeyToken = (token: string) => {
  const lower = token.trim().toLowerCase();
  if (!lower) return null;
  if (lower === "space" || lower === "spacebar") return " ";
  if (lower === "esc" || lower === "escape") return "escape";
  if (lower === "enter" || lower === "return") return "enter";
  if (lower === "tab") return "tab";
  if (lower === "up") return "arrowup";
  if (lower === "down") return "arrowdown";
  if (lower === "left") return "arrowleft";
  if (lower === "right") return "arrowright";
  return lower.length === 1 ? lower : lower;
};

const normalizeEventKey = (key: string) => {
  if (key === " ") return " ";
  return key.toLowerCase();
};

const normalizeDisplayKey = (key: string) => {
  if (key === " ") return "Space";
  if (key === "Escape") return "Esc";
  if (key === "Enter") return "Enter";
  if (key === "Tab") return "Tab";
  if (key.startsWith("Arrow")) return key.replace("Arrow", "");
  if (key.length === 1) return key.toUpperCase();
  return key;
};

const parseKeybinding = (binding: string | undefined | null): ParsedKeybinding => {
  const initial: ParsedKeybinding = {
    key: null,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    cmdOrCtrl: false,
  };
  if (!binding) return initial;

  return binding
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const lower = part.toLowerCase();
      if (["cmdorctrl", "cmdorcontrol", "commandorcontrol"].includes(lower)) {
        acc.cmdOrCtrl = true;
        return acc;
      }
      if (["cmd", "command", "meta", "super"].includes(lower)) {
        acc.meta = true;
        return acc;
      }
      if (["ctrl", "control"].includes(lower)) {
        acc.ctrl = true;
        return acc;
      }
      if (["alt", "option"].includes(lower)) {
        acc.alt = true;
        return acc;
      }
      if (lower === "shift") {
        acc.shift = true;
        return acc;
      }
      acc.key = normalizeKeyToken(part);
      return acc;
    }, initial);
};

export const keybindingFromEvent = (event: KeyboardEvent) => {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.metaKey) parts.push("Cmd");
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(normalizeDisplayKey(event.key));
  return parts.join("+");
};

export const matchesKeybinding = (
  event: KeyboardEvent,
  binding: string | undefined | null,
) => {
  const parsed = parseKeybinding(binding);
  if (!parsed.key) return false;

  if (parsed.cmdOrCtrl) {
    if (!event.ctrlKey && !event.metaKey) return false;
  } else {
    if (parsed.ctrl !== event.ctrlKey) return false;
    if (parsed.meta !== event.metaKey) return false;
  }

  if (parsed.alt !== event.altKey) return false;
  if (parsed.shift !== event.shiftKey) return false;

  const key = normalizeEventKey(event.key);
  return key === parsed.key;
};
