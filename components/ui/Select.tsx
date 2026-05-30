import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
}

const fieldBase =
  'w-full h-10 pl-3 pr-8 text-sm rounded-md border bg-bg-card text-text-primary ' +
  'appearance-none outline-none ' +
  'transition-colors duration-150 ' +
  'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted'

const ChevronIcon = () => (
  <svg
    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = Boolean(error)

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              fieldBase,
              hasError ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20' : 'border-border',
              className
            )}
            aria-invalid={hasError}
            aria-describedby={
              hasError ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
            }
            {...props}
          >
            {children}
          </select>
          <ChevronIcon />
        </div>
        {hasError && (
          <p id={`${selectId}-error`} className="text-xs text-error-500">
            {error}
          </p>
        )}
        {!hasError && helperText && (
          <p id={`${selectId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
