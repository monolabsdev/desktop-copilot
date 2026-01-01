"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

import { common, createStarryNight } from "@wooorm/starry-night";
import { toHtml } from "hast-util-to-html";

type CodeBlockProps = {
  code: string;
  language?: string;
  className?: string;
};

let starryNightPromise: ReturnType<typeof createStarryNight> | null = null;

async function getStarryNight() {
  if (!starryNightPromise) {
    starryNightPromise = createStarryNight(common);
  }
  return starryNightPromise;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      const starryNight = await getStarryNight();

      const scope = language ? starryNight.flagToScope(language) : undefined;

      if (!scope) {
        setHtml(code);
        return;
      }

      const tree = starryNight.highlight(code, scope);
      const rendered = toHtml(tree);

      if (!cancelled) {
        setHtml(rendered);
      }
    }

    highlight();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-7 px-2 text-xs"
        aria-live="polite"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-current" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 text-current" />
            Copy
          </>
        )}
      </Button>

      <pre className="rounded-md bg-secondary p-3 text-sm overflow-x-auto">
        <code
          className={language ? `language-${language}` : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}
