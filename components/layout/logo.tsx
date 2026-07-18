import { cn } from '@/lib/utils';

export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5 font-semibold', className)}>
      {/* Red disc mark with a stylized bird/thru glyph */}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 14c4.5 1 8-1.5 10.5-6C12.5 10 15 12 20 11c-3 4-7.5 6-12 5.5L5 20l-2-6z"
            fill="currentColor"
          />
          <circle cx="16.5" cy="8" r="1" fill="hsl(var(--primary))" />
        </svg>
      </span>
      {showWord && (
        <span className="font-mono text-xl font-bold italic tracking-tight">thru</span>
      )}
    </span>
  );
}
