import type { ReactNode } from 'react';
import { CodeTabs } from '@/components/CodeTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Snippet } from '@/lib/snippets';
import { cn } from '@/lib/utils';

interface StepProps {
  number: number;
  title: string;
  description: ReactNode;
  snippets: Snippet[];
  /** Greys the step out until the previous ones are done. */
  inactive?: boolean;
  children: ReactNode;
}

/** One step: what to do on the left, the matching code on the right. */
export function Step({ number, title, description, snippets, inactive, children }: StepProps) {
  return (
    <Card className={cn('[--card-spacing:--spacing(5)]', inactive && 'opacity-60')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {number}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <CodeTabs snippets={snippets} />
      </CardContent>
    </Card>
  );
}
