import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language: string;
  /** Shown in the toolbar, next to the copy button. */
  title?: string;
  className?: string;
}

export function CodeBlock({ code, language, title, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={cn('min-w-0 overflow-hidden rounded-lg bg-muted', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1 pr-1 pl-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy code">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js escapes the code it highlights. */}
        <code dangerouslySetInnerHTML={{ __html: highlight(code, language) }} />
      </pre>
    </div>
  );
}
