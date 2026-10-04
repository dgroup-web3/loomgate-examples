import { CodeBlock } from '@/components/CodeBlock';
import { Badge } from '@/components/ui/badge';
import type { Exchange } from '@/lib/api';

/** The raw request and response of the last call, as Loomgate saw them. */
export function ExchangeView({ exchange }: { exchange: Exchange | null }) {
  if (!exchange) return null;
  const ok = exchange.status >= 200 && exchange.status < 300;
  return (
    <details className="group rounded-lg border p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2">
        <code className="font-mono text-xs">{exchange.request}</code>
        <Badge variant={ok ? 'success' : 'destructive'}>{exchange.status || 'no answer'}</Badge>
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show JSON</span>
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {exchange.requestBody !== undefined && (
          <>
            <span className="text-xs font-medium text-muted-foreground">Request body</span>
            <CodeBlock code={JSON.stringify(exchange.requestBody, null, 2)} language="json" />
          </>
        )}
        <span className="text-xs font-medium text-muted-foreground">Response</span>
        <CodeBlock code={JSON.stringify(exchange.responseBody, null, 2)} language="json" />
      </div>
    </details>
  );
}
