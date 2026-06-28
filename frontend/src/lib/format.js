// Shared display helpers.

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U';

// Language -> swatch color (Origin oklch palette).
export const langColor = (lang) => {
  const k = String(lang || '').toLowerCase();
  if (/(rust|java)/.test(k))                       return 'oklch(0.82 0.15 78)';   // amber
  if (/(type ?script|javascript|tsx|jsx)/.test(k)) return 'oklch(0.78 0.11 235)';  // sky
  if (/(python|django|flask)/.test(k))             return 'oklch(0.72 0.16 144)';  // acc-2
  if (/(go|golang)/.test(k))                       return 'oklch(0.72 0.16 144)';  // acc-2
  if (/(c\+\+|cpp|c#|csharp)/.test(k))             return 'oklch(0.78 0.11 235)';
  if (/(ruby)/.test(k))                            return 'oklch(0.7 0.18 25)';
  return 'oklch(0.48 0.01 250)';                                                   // ink-4 / other
};
