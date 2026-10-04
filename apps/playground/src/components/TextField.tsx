import { useId } from 'react';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TextFieldProps = Omit<React.ComponentProps<typeof Input>, 'onChange'> & {
  label: string;
  description?: string;
  onValueChange: (value: string) => void;
  fieldClassName?: string;
};

export function TextField({ label, description, onValueChange, fieldClassName, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <Field className={cn('min-w-0', fieldClassName)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} onChange={(event) => onValueChange(event.target.value)} {...props} />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
