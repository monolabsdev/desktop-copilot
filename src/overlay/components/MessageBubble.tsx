import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "ollama";

interface Props {
  message: Message;
}
export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "AI";

  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className="text-sm text-white/90 leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a
                {...props}
                className="underline text-white/70"
                rel="noreferrer"
                target="_blank"
              >
                {children}
              </a>
            ),
            code: ({ children, className }) => (
              <code className={`rounded bg-white/10 px-1 ${className ?? ""}`}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="overflow-x-auto rounded bg-white/10 p-3">
                {children}
              </pre>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
