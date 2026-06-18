import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none'

    const variants = {
      primary: 'bg-primary text-background hover:bg-primary-hover active:scale-95',
      secondary: 'bg-surface-2 text-text-primary hover:bg-border active:scale-95',
      ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
      danger: 'bg-error/10 text-error hover:bg-error/20 active:scale-95',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Spinner className="w-4 h-4" />}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
