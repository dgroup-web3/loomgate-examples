import { CodeBlock } from '@/components/CodeBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Snippet } from '@/lib/snippets';

export function CodeTabs({ snippets }: { snippets: Snippet[] }) {
  const first = snippets[0];
  if (!first) return null;
  if (snippets.length === 1) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{first.label}</span>
        <CodeBlock code={first.code} language={first.language} />
      </div>
    );
  }
  return (
    <Tabs defaultValue={first.label} className="min-w-0">
      <TabsList>
        {snippets.map((snippet) => (
          <TabsTrigger key={snippet.label} value={snippet.label}>
            {snippet.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {snippets.map((snippet) => (
        <TabsContent key={snippet.label} value={snippet.label}>
          <CodeBlock code={snippet.code} language={snippet.language} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
