import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold', className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="thru-g" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#thru-g)" />
        <path
          d="M8 12h16M16 12v12"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg tracking-tight">
        Thru<span className="text-primary"> Onboard</span>
      </span>
    </span>
  );
}
