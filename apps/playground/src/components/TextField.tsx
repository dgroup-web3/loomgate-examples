import { useId } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TextFieldProps = Omit<React.ComponentProps<typeof Input>, 'onChange'> & {
  label: string;
  description?: string;
  /** Shown under the field, which is marked invalid. */
  error?: string;
  onValueChange: (value: string) => void;
  fieldClassName?: string;
};

export function TextField({ label, description, error, onValueChange, fieldClassName, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <Field className={cn('min-w-0', fieldClassName)} data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
