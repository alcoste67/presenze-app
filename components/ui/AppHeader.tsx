import Image from 'next/image'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AppHeaderProps {
  actions?: ReactNode
  className?: string
}

export function AppHeader({ actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between h-14 px-4',
        'bg-bg-card border-b border-border',
        className
      )}
    >
      <Link
        href="/"
        className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Image
          src="/a2c-logo-arancio.png"
          alt="A2C"
          width={120}
          height={34}
          style={{ height: '34px', width: 'auto' }}
          priority
        />
      </Link>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
