// Couleur → même couleur avec transparence (« #FFC24B », 0.2).
// Accepte aussi les couleurs du thème (« rgb(var(--c-gold)) ») : elles restent
// modifiables en direct depuis l'éditeur de design (/design).
export function hexA(color: string, a: number) {
  const c = String(color || "rgb(var(--c-gold))").trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) {
    const h = c.slice(1);
    const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = /^rgb\(var\((--[\w-]+)\)\)$/.exec(c);
  if (m) return `rgb(var(${m[1]}) / ${a})`;
  return `color-mix(in srgb, ${c} ${Math.round(a * 1000) / 10}%, transparent)`;
}
