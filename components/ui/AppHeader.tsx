'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from './Button'
import { useToast } from './Toast'
import { cn } from '@/lib/utils'

export interface AppHeaderProps {
  actions?: ReactNode
  className?: string
}

export function AppHeader({ actions, className }: AppHeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(Boolean(session?.user))
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Disconnesso')
      router.push('/')
    } catch {
      // best-effort: session already invalidated server-side
    }
  }

  const hasRight = Boolean(actions) || isLoggedIn

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

      {hasRight && (
        <div className="flex items-center gap-2">
          {actions}
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-4 w-4" />}
              onClick={handleLogout}
            >
              <span className="hidden sm:inline">Esci</span>
            </Button>
          )}
        </div>
      )}
    </header>
  )
}
