'use client'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: ToastKind; message: string }

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info }
const COLORS: Record<ToastKind, string> = {
  success: '#10b981',
  error: '#ef4444',
  info: '#3b82f6',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, kind, message }])
      // Errors linger; successes get out of the way quickly.
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500)
    },
    [dismiss]
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind]
          const color = COLORS[toast.kind]
          return (
            <div
              key={toast.id}
              className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 font-mono text-xs leading-relaxed backdrop-blur"
              style={{
                background: 'rgba(15,21,36,0.96)',
                borderColor: `${color}55`,
                color: 'var(--color-ink)',
              }}
            >
              <Icon size={14} color={color} className="mt-px shrink-0" />
              <span className="flex-1 break-words">{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 cursor-pointer opacity-50 transition-opacity hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
