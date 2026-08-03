type LogoMarkProps = {
  className?: string;
  gradientId?: string;
};

export default function LogoMark({
  className = "logo-mark",
  gradientId = "scaleupp-mark",
}: LogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M20 3c-6.2 0-11 3.4-11 8.2 0 3.4 2.4 5.8 6.4 7.4l6.6 2.6c2.6 1 4 2.2 4 4.2 0 2.6-2.6 4.4-6 4.4-3.8 0-6.4-1.8-7.4-4.6l-5.2 1.8C9.2 32.8 13.6 37 20 37c7 0 12-3.8 12-9 0-3.8-2.4-6.4-7-8.2l-6.4-2.5c-2.4-.9-3.6-2-3.6-3.8 0-2.2 2.2-3.8 5-3.8 3 0 5.2 1.4 6.2 3.8l5-1.8C29.8 7.2 25.6 3 20 3z"
      />
    </svg>
  );
}
