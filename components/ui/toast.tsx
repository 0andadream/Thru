'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const icons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="size-5 text-primary" />,
  success: <CheckCircle2 className="size-5 text-success" />,
  error: <XCircle className="size-5 text-destructive" />,
  warning: <TriangleAlert className="size-5 text-warning" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'default', duration = 4500 }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur',
                t.variant === 'success' && 'border-success/30',
                t.variant === 'error' && 'border-destructive/30',
                t.variant === 'warning' && 'border-warning/30',
                t.variant === 'default' && 'border-border',
              )}
            >
              <div className="mt-0.5 shrink-0">{icons[t.variant]}</div>
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
