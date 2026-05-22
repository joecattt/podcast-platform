import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-muted text-foreground hover:bg-accent',
  destructive: 'bg-destructive text-white hover:opacity-90',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
};

export function Button({ variant = 'primary', className, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none',
        styles[variant],
        className,
      )}
    />
  );
}
