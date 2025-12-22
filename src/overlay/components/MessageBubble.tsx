import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "ollama";

interface Props {
  message: Message;
}
export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%] space-y-1">
        <div
          className={
            isUser
              ? "rounded-md bg-white/15 text-white px-3 py-2 text-sm"
              : "rounded-md bg-black/40 text-white px-3 py-2 text-sm"
          }
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, ...props }) => (
                <a
                  {...props}
                  className="underline text-sky-200"
                  rel="noreferrer"
                  target="_blank"
                >
                  {children}
                </a>
              ),
              code: ({ children, className }) => (
                <code className={`rounded bg-black/40 px-1 ${className ?? ""}`}>
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="overflow-x-auto rounded bg-black/50 p-3">
                  {children}
                </pre>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
