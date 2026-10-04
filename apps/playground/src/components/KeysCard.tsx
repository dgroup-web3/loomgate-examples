import { KeyRoundIcon } from 'lucide-react';
import { useId } from 'react';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { EMPTY_KEYS, forgetKeys, type Keys } from '@/lib/keys';

export function keysProblem(keys: Keys): string | null {
  if (!keys.publishableKey.trim() || !keys.secretKey.trim()) return 'Enter both keys to start.';
  if (!keys.publishableKey.trim().startsWith('pk_')) return 'The publishable key starts with pk_.';
  if (!keys.secretKey.trim().startsWith('sk_')) return 'The secret key starts with sk_.';
  return null;
}

export function KeysCard({ keys, onChange }: { keys: Keys; onChange: (keys: Keys) => void }) {
  const rememberId = useId();
  const problem = keysProblem(keys);
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRoundIcon className="size-4" />
          Your API keys
        </CardTitle>
        <CardDescription>
          From your merchant dashboard → API keys. Payments go to that merchant account. When you are done, roll the
          secret key in the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Publishable key"
          placeholder="pk_live_…"
          autoComplete="off"
          spellCheck={false}
          value={keys.publishableKey}
          onValueChange={(publishableKey) => onChange({ ...keys, publishableKey })}
          description="Used by the card form in this page."
        />
        <TextField
          label="Secret key"
          type="password"
          placeholder="sk_live_…"
          autoComplete="off"
          spellCheck={false}
          value={keys.secretKey}
          onValueChange={(secretKey) => onChange({ ...keys, secretKey })}
          description="Sent with each request to this site's server, which calls Loomgate with it. Never stored there."
        />
        <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id={rememberId}
              checked={keys.remember}
              onCheckedChange={(remember) => onChange({ ...keys, remember: remember === true })}
            />
            <FieldLabel htmlFor={rememberId} className="font-normal">
              Remember on this device (otherwise forgotten when you close the tab)
            </FieldLabel>
          </Field>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              forgetKeys();
              onChange(EMPTY_KEYS);
            }}
          >
            Forget keys
          </Button>
        </div>
        {problem && <p className="text-sm text-muted-foreground md:col-span-2">{problem}</p>}
      </CardContent>
    </Card>
  );
}
