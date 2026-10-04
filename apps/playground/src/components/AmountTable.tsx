import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { formatAmount } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface AmountRow {
  label: string;
  /** Minor units, or text such as "merchant". */
  value: number | string;
  hint?: string;
  strong?: boolean;
}

export function AmountTable({ rows, currency, label }: { rows: AmountRow[]; currency: string; label: string }) {
  return (
    <Table label={label}>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label} className={cn(row.strong && 'font-semibold')}>
            <TableCell className="whitespace-normal">
              {row.label}
              {row.hint && <span className="block text-xs font-normal text-muted-foreground">{row.hint}</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {typeof row.value === 'number' ? formatAmount(row.value, currency) : row.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
