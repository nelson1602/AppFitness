import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-text-secondary',
  primary: 'bg-primary-muted text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
}

export const Badge = ({ className, variant = 'default', children, ...props }: BadgeProps) => (
  <span
    className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}
    {...props}
  >
    {children}
  </span>
)
