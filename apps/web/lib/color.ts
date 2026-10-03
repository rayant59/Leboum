// Couleur hexadécimale → rgba avec transparence (« #FFC24B », 0.2).
export function hexA(hex: string, a: number) {
  const h = String(hex || "#FFC24B").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
