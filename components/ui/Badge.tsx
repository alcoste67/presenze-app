import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'muted'
type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const base = 'inline-flex items-center font-medium uppercase tracking-wide rounded-sm'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-bg-subtle text-text-secondary',
  brand:   'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-500',
  warning: 'bg-warning-50 text-warning-500',
  error:   'bg-error-50 text-error-500',
  info:    'bg-info-50 text-info-500',
  muted:   'bg-bg-subtle text-text-muted',
}

const sizes: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
}

function Badge({ variant = 'default', size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </span>
  )
}

export { Badge }
