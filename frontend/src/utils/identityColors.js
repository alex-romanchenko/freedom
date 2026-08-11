const IDENTITY_COLORS = [
  '#2563eb',
  '#0f766e',
  '#7c3aed',
  '#be123c',
  '#b45309',
  '#0369a1',
  '#4d7c0f',
  '#c2410c',
  '#6d28d9',
  '#047857',
];

function stableHash(value) {
  let hash = 0;
  for (const char of String(value || '?').trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getIdentityColors(value) {
  const background = IDENTITY_COLORS[stableHash(value) % IDENTITY_COLORS.length];
  return { background, foreground: '#ffffff' };
}

export function getIdentityNameColor(value) {
  return IDENTITY_COLORS[stableHash(value) % IDENTITY_COLORS.length];
}
