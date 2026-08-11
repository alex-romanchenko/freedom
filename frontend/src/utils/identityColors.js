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
  const normalized = String(value || '?').trim().toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) & 0x7fffffff;
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
