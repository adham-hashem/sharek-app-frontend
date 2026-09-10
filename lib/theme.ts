export const colors = {
  white: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF8F0',
  surfaceMuted: '#F5EDE3',

  primary: '#FF6B35',
  primaryDark: '#E85420',
  primaryLight: '#FF8F5E',

  coral: '#F7564C',
  coralDark: '#D9443B',

  golden: '#F9B233',
  goldenLight: '#FFD062',
  goldenDark: '#E09A1A',

  brown: '#3B2A20',
  brownLight: '#5C4636',
  brownMuted: '#8A7565',

  green: '#2E9E5B',
  greenDark: '#1F7A45',
  greenLight: '#4EC077',
  greenBg: '#E8F5EC',

  error: '#E53935',
  errorBg: '#FDECEC',
  warning: '#F9A825',
  warningBg: '#FFF6E0',
  success: '#2E9E5B',
  successBg: '#E8F5EC',

  border: '#EDE2D4',
  borderLight: '#F2EAE0',
  shadow: 'rgba(59, 42, 32, 0.08)',
  shadowStrong: 'rgba(59, 42, 32, 0.16)',
  overlay: 'rgba(59, 42, 32, 0.4)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  huge: { fontSize: 32, fontWeight: '800' as const, lineHeight: 40 },
  title: { fontSize: 24, fontWeight: '800' as const, lineHeight: 30 },
  heading: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold: { fontSize: 16, fontWeight: '700' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  micro: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
};
