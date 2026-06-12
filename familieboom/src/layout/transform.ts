/**
 * Affiene transformatie van pad-strings. Onze layouts produceren uitsluitend
 * absolute 'M x,y C x1,y1 x2,y2 x,y'-paden; cubic béziers transformeren
 * affien, dus elk coördinatenpaar mag onafhankelijk geschaald + verschoven
 * worden. Hiermee projecteren we de navigatie-layout in de canvas-ruimte van
 * het kunstwerk, zodat nodes en lijnen tussen beide layouts kunnen morphen.
 */
export function affinePath(d: string, k: number, tx: number, ty: number): string {
  let isX = true;
  return d.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (num) => {
    const value = parseFloat(num) * k + (isX ? tx : ty);
    isX = !isX;
    return value.toFixed(2);
  });
}
