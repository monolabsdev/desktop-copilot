import type { ChatMessage } from "./types";

export function appendScreenshotMessage(
  prev: ChatMessage[],
  message: ChatMessage,
  maxScreenshots = 3,
) {
  const next = [...prev, message];
  const screenshotIndexes = next
    .map((item, index) => {
      const withImage = item as ChatMessage & {
        images?: string[];
        imagePath?: string;
      };
      return withImage.images?.length || withImage.imagePath ? index : -1;
    })
    .filter((index) => index >= 0);
  if (screenshotIndexes.length <= maxScreenshots) return next;
  const toRemove = new Set(
    screenshotIndexes.slice(0, screenshotIndexes.length - maxScreenshots),
  );
  return next.filter((_, index) => !toRemove.has(index));
}
