import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, type ComponentPropsWithoutRef } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { Loader } from "@/components/ui/loader";
import type { Message } from "ollama";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Disclosure } from "@/components/ui/disclosure";

type MessageWithImages = Message & {
  thinking?: string;
  thinkingDurationMs?: number;
  imageMime?: string;
  imagePath?: string;
  imagePreviewBase64?: string;
  imagePreviewMime?: string;
};

interface Props {
  message: MessageWithImages;
  showThinking: boolean;
}

const markdownComponents = {
  a: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a
      {...props}
      className="underline text-white/70"
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  code: ({ children, className }: ComponentPropsWithoutRef<"code">) => {
    const isBlock = className?.includes("language-");
    return (
      <code
        className={
          isBlock
            ? `block font-mono text-[12px] leading-relaxed ${className ?? ""}`
            : `rounded bg-white/10 px-1.5 py-0.5 text-[12px] ${className ?? ""}`
        }
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre
      data-no-drag
      className="overflow-x-auto rounded-md border border-white/10 bg-white/5 p-3"
    >
      {children}
    </pre>
  ),
  h1: ({ children }: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="text-base font-semibold text-white/90">{children}</h1>
  ),
  h2: ({ children }: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="text-sm font-semibold text-white/85">{children}</h2>
  ),
  h3: ({ children }: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="text-sm font-medium text-white/80">{children}</h3>
  ),
  ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc pl-5">{children}</ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal pl-5">{children}</ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="border-l-2 border-white/20 pl-3 text-white/70">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-0 border-t border-white/10" />,
  table: ({ children }: ComponentPropsWithoutRef<"table">) => (
    <table
      data-no-drag
      className="block w-full overflow-x-auto border-collapse text-xs"
    >
      {children}
    </table>
  ),
  img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => (
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      data-no-drag
      className="mt-2 w-full rounded-md border border-white/10"
    />
  ),
  th: ({ children }: ComponentPropsWithoutRef<"th">) => (
    <th className="border border-white/10 bg-white/5 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: ComponentPropsWithoutRef<"td">) => (
    <td className="border border-white/10 px-2 py-1 align-top">
      {children}
    </td>
  ),
};

function formatDuration(ms: number) {
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function MessageBubble({ message, showThinking }: Props) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "AI";
  const thinking =
    !isUser && showThinking ? message.thinking?.trim() : undefined;
  const toolActivity = !isUser ? message.toolActivity?.trim() : undefined;
  const thinkingDurationMs = !isUser ? message.thinkingDurationMs : undefined;
  const content = message.content?.trim() ?? "";
  const isStreaming =
    typeof (message as { streamId?: number }).streamId === "number";
  const showThinkingRow = !isUser && showThinking && !!thinking;
  const showToolRow = !isUser && !!toolActivity;
  const showContent = isUser || content.length > 0;
  const images = message.images ?? [];
  const imageMime = message.imageMime ?? "image/png";
  const imagePath = message.imagePath;
  const imagePreviewBase64 = message.imagePreviewBase64;
  const imagePreviewMime = message.imagePreviewMime ?? "image/png";
  const imageUrl = useMemo(() => {
    if (!imagePath) return null;
    try {
      return convertFileSrc(imagePath);
    } catch {
      return null;
    }
  }, [imagePath]);
  const thinkingDurationLabel =
    thinkingDurationMs && thinkingDurationMs > 0
      ? formatDuration(thinkingDurationMs)
      : null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] tracking-[0.12em] text-white/35">{label}</div>
      {showToolRow && (
        <Disclosure
          trigger={
            <div className="text-[11px] tracking-[0.12em] text-white/40">
              Tool activity
            </div>
          }
          defaultOpen
          autoCloseMs={4000}
        >
          <div className="leading-relaxed text-white/65">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
              className="markdown-body"
            >
              {toolActivity}
            </ReactMarkdown>
          </div>
        </Disclosure>
      )}
      {showThinkingRow && (
        <Disclosure
          trigger={
            isStreaming ? (
              <TextShimmer
                className="font-mono text-sm [--base-color:#cbd5f5] [--base-gradient-color:#ffffff]"
                duration={1}
              >
                Thinking...
              </TextShimmer>
            ) : (
              <div className="text-[11px] tracking-[0.12em] text-white/40">
                {thinkingDurationLabel
                  ? `Thought for ${thinkingDurationLabel}.`
                  : "Thought."}
              </div>
            )
          }
          defaultOpen
          autoCloseMs={isStreaming ? undefined : 5000}
        >
          {thinking && (
            <div className="leading-relaxed text-white/70">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
                className="markdown-body"
              >
                {thinking}
              </ReactMarkdown>
            </div>
          )}
        </Disclosure>
      )}
      {showContent && (
        <div className="text-sm text-white/85 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
            className="markdown-body"
          >
            {content}
          </ReactMarkdown>
          {(imagePreviewBase64 || imageUrl || images.length > 0) && (
            <Disclosure
              trigger={
                <div className="text-[11px] tracking-[0.12em] text-white/45">
                  Screenshot
                </div>
              }
              autoCloseMs={4000}
            >
              <div className="space-y-2">
                {imagePreviewBase64 && (
                  <img
                    src={`data:${imagePreviewMime};base64,${imagePreviewBase64}`}
                    alt="Screenshot"
                    loading="lazy"
                    data-no-drag
                    className="w-full rounded-md border border-white/10"
                  />
                )}
                {!imagePreviewBase64 && imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Screenshot"
                    loading="lazy"
                    data-no-drag
                    className="w-full rounded-md border border-white/10"
                  />
                )}
                {!imagePreviewBase64 &&
                  !imageUrl &&
                  images.map((image, index) => (
                    <img
                      key={`${label}-image-${index}`}
                      src={`data:${imageMime};base64,${image}`}
                      alt="Screenshot"
                      loading="lazy"
                      data-no-drag
                      className="w-full rounded-md border border-white/10"
                    />
                  ))}
              </div>
            </Disclosure>
          )}
          {isStreaming && (
            <span className="ml-1 inline-flex items-center align-middle">
              <Loader
                variant="pulse-dot"
                size="md"
                className="bg-white animate-[pulse-dot_0.7s_ease-in-out_infinite]"
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
