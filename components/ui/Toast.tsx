'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: Variant
}

type AddToast = (message: string, variant: Variant, duration?: number) => void

const ToastContext = createContext<AddToast | null>(null)

const ICON = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
} as const

const ICON_CLASS: Record<Variant, string> = {
  success: 'text-success-500',
  error: 'text-error-500',
  info: 'text-info-500',
}

function ToastCard({ message, variant }: Omit<ToastItem, 'id'>) {
  const Icon = ICON[variant]
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 bg-bg-card border border-border rounded-lg shadow-[0_4px_16px_rgb(0_0_0/0.10)] px-4 py-3 max-w-sm animate-toast-in"
    >
      <Icon
        className={cn('h-4 w-4 mt-0.5 shrink-0', ICON_CLASS[variant])}
        aria-hidden
      />
      <p className="text-sm text-text-primary">{message}</p>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback<AddToast>((message, variant, duration = 2500) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      duration
    )
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} message={t.message} variant={t.variant} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const addToast = useContext(ToastContext)
  if (!addToast) throw new Error('useToast must be used within ToastProvider')
  return {
    success: (msg: string, duration?: number) => addToast(msg, 'success', duration),
    error: (msg: string, duration?: number) => addToast(msg, 'error', duration),
    info: (msg: string, duration?: number) => addToast(msg, 'info', duration),
  }
}
