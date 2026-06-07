'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from './Button'
import { useToast } from './Toast'
import { cn } from '@/lib/utils'
import { APP_ROUTES } from '@/constants/routes'

export interface AppHeaderProps {
  actions?: ReactNode
  className?: string
}

export function AppHeader({ actions, className }: AppHeaderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [azienda, setAzienda] = useState<{ nome: string; logo_url: string | null; colori: { primary: string; secondary: string } | null } | null>(null)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(Boolean(session?.user))
        if (session?.user) {
          supabase
            .from('dipendenti')
            .select('aziende(nome, logo_url, colori)')
            .eq('auth_user_id', session.user.id)
            .eq('attivo', true)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.aziende) {
                const az = data.aziende as unknown as { nome: string; logo_url: string | null; colori: { primary: string; secondary: string } | null }
                setAzienda(az)
                if (az.colori?.primary) {
                  document.documentElement.style.setProperty('--color-brand-500', az.colori.primary)
                }
              }
            })
        } else {
          setAzienda(null)
        }
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
        {azienda?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={azienda.logo_url}
            alt={azienda.nome}
            className="h-8 w-auto object-contain"
          />
        ) : (
          <span className="font-heading font-semibold text-text-primary">
            {azienda?.nome ?? 'Cantivo'}
          </span>
        )}
      </Link>

      {hasRight && (
        <div className="flex items-center gap-2">
          {actions}
          {isLoggedIn && (
            <Link
              href={APP_ROUTES.IMPOSTAZIONI}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-base hover:text-text-primary"
              aria-label="Impostazioni"
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
          {isLoggedIn && (
            <Button
              variant="secondary"
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
