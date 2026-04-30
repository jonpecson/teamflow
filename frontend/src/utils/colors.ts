const AVATAR_COLORS = [
  '#7c3aed', '#6c5ce7', '#e84393', '#00b894', '#fdcb6e',
  '#e17055', '#0984e3', '#6c5ce7', '#00cec9', '#fd79a8',
  '#55a3f7', '#a29bfe', '#fab1a0', '#81ecec', '#ffeaa7',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
