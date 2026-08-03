/** Barras CODE_39 (sin deps). Escaneable por html5-qrcode / pistolas. */

const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

type Props = {
  value: string;
  height?: number;
  className?: string;
};

export default function Code39Barcode({
  value,
  height = 64,
  className,
}: Props) {
  const raw = value.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "");
  const text = `*${raw}*`;
  const narrow = 1.6;
  const wide = narrow * 2.4;
  const gap = narrow;

  const rects: { x: number; w: number; bar: boolean }[] = [];
  let x = 0;
  for (let i = 0; i < text.length; i += 1) {
    const pattern = PATTERNS[text[i]];
    if (!pattern) continue;
    for (let j = 0; j < pattern.length; j += 1) {
      const w = pattern[j] === "w" ? wide : narrow;
      rects.push({ x, w, bar: j % 2 === 0 });
      x += w;
    }
    if (i < text.length - 1) {
      x += gap;
    }
  }

  const width = Math.max(x, 1);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Código de barras ${raw}`}
        preserveAspectRatio="none"
      >
        <rect x={0} y={0} width={width} height={height} fill="#fff" />
        {rects
          .filter((r) => r.bar)
          .map((r, idx) => (
            <rect
              key={idx}
              x={r.x}
              y={0}
              width={r.w}
              height={height}
              fill="#111"
            />
          ))}
      </svg>
      <p className="barcode-value">{raw}</p>
    </div>
  );
}
