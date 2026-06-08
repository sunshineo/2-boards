export type RandomSource = () => number;

export function chooseRandom<T>(items: readonly T[], random: RandomSource = Math.random): T | null {
  if (items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] ?? null;
}
