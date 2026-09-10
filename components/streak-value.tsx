const flame = [
  "......o......",
  "......oo.....",
  ".....ooo.....",
  ".....oooo....",
  "....ooooo....",
  "..o.oooooo...",
  "..oooooooo...",
  ".oooooooo.o..",
  ".ooooooooooo.",
  "oooooooooooo.",
  "oooooo.oooooo",
  "ooooo...ooooo",
  "oooo.....oooo",
  ".ooo.....ooo.",
  ".oooo...oooo.",
  "..ooooooooo..",
  "...ooooooo...",
  ".....ooo.....",
];

export function StreakValue({ days }: { days: number }) {
  return (
    <strong className="streak-value">
      {days > 0 && (
        <svg
          className="streak-flame"
          viewBox="0 0 26 36"
          fill="currentColor"
          style={{ opacity: days === 1 ? 0.3 : days === 2 ? 0.65 : 1 }}
          aria-hidden="true"
          focusable="false"
        >
          {flame.flatMap((row, y) =>
            Array.from(row, (dot, x) =>
              dot === "o" ? (
                <circle
                  key={`${x}-${y}`}
                  cx={x * 2 + 1}
                  cy={y * 2 + 1}
                  r="0.65"
                />
              ) : null,
            ),
          )}
        </svg>
      )}
      {days} {days === 1 ? "day" : "days"}
    </strong>
  );
}
