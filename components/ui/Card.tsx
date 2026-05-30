import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type CardProps = HTMLAttributes<HTMLDivElement>

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('bg-bg-card border border-border rounded-lg', className)}
    {...props}
  >
    {children}
  </div>
))
Card.displayName = 'Card'

export { Card }
