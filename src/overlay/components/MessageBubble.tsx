import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentPropsWithoutRef } from "react";
import type { Message } from "ollama";

interface Props {
  message: Message & { thinking?: string };
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
  code: ({ children, className }: ComponentPropsWithoutRef<"code">) => (
    <code className={`rounded bg-white/10 px-1 ${className ?? ""}`}>
      {children}
    </code>
  ),
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre className="overflow-x-auto rounded bg-white/10 p-3">
      {children}
    </pre>
  ),
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "AI";
  const thinking = !isUser ? message.thinking?.trim() : undefined;
  const content = message.content?.trim() ?? "";
  const showContent = isUser || content.length > 0;

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      {thinking && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/70">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Thinking
          </div>
          <div className="mt-2 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {thinking}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {showContent && (
        <div className="text-sm text-white/90 leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
