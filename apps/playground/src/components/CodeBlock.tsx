import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

export function CodeBlock({ code, language, className }: { code: string; language: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={cn('relative min-w-0 rounded-lg bg-muted', className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-1.5 right-1.5"
        onClick={copy}
        aria-label="Copy code"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <pre className="overflow-x-auto p-3 pr-10 font-mono text-xs leading-relaxed">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js escapes the code it highlights. */}
        <code dangerouslySetInnerHTML={{ __html: highlight(code, language) }} />
      </pre>
    </div>
  );
}
