// Ícones próprios em traço simples (sem bibliotecas externas).
const PATHS = {
  home: 'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  friends: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 6',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-1.5 1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.6.9L15 20h-4l-.5-1.7a7 7 0 0 1-1.6-.9l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-1.9L4.9 10.4l2-3.4 1.9.7a7 7 0 0 1 1.6-.9L11 5h4l.5 1.7a7 7 0 0 1 1.6.9l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 1.9Z',
  window: 'M3 5h18v14H3V5Zm0 4h18',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z',
  lock: 'M6 11h12v9H6v-9Zm2 0V8a4 4 0 0 1 8 0v3',
  eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
