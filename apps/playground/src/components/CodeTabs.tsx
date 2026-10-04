import { CodeBlock } from '@/components/CodeBlock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Snippet } from '@/lib/snippets';

export function CodeTabs({ snippets }: { snippets: Snippet[] }) {
  const first = snippets[0];
  if (!first) return null;
  if (snippets.length === 1) {
    return <CodeBlock code={first.code} language={first.language} title={first.label} />;
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
