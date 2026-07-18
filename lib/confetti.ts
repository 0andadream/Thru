import confetti from 'canvas-confetti';

const BRAND = ['#0ea5e9', '#22d3ee', '#10b981', '#38bdf8', '#a7f3d0'];

/** A celebratory two-sided burst used on the success screen. */
export function celebrate() {
  const end = Date.now() + 900;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0 },
      colors: BRAND,
      startVelocity: 45,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1 },
      colors: BRAND,
      startVelocity: 45,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // A single big pop in the center to punctuate.
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 },
    colors: BRAND,
    scalar: 1.1,
  });
}

/** A small pop for individual step completions. */
export function popSuccess(x = 0.5, y = 0.5) {
  confetti({
    particleCount: 45,
    spread: 55,
    startVelocity: 28,
    origin: { x, y },
    colors: BRAND,
    scalar: 0.9,
  });
}
