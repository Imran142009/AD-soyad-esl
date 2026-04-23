export const colors = {
  bg: "#0B0E14",
  bgSecondary: "#11151F",
  card: "#181D29",
  glass: "rgba(255,255,255,0.05)",
  glassStrong: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  white: "#ffffff",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  indigo: "#818CF8",
  indigoDeep: "#6366F1",
  violet: "#A78BFA",
  emerald: "#34D399",
  sky: "#93C5FD",
  amber: "#FBBF24",
  red: "#F87171",
  rose: "#FCA5A5",
  mint: "#86EFAC",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 10, md: 16, lg: 20, xl: 24, pill: 999 };

export const typography = {
  display: { fontWeight: "900", letterSpacing: -0.8 },
  displayLg: { fontWeight: "900", letterSpacing: -1.2 },
  body: { fontWeight: "400" },
  mono: { fontFamily: "Courier", fontWeight: "600" },
};

export const CATEGORIES = [
  { key: "ad", label: "Ad" },
  { key: "soyad", label: "Soyad" },
  { key: "seher", label: "Şəhər" },
  { key: "olke", label: "Ölkə" },
  { key: "bitki", label: "Bitki" },
  { key: "heyvan", label: "Heyvan" },
  { key: "esya", label: "Əşya" },
];

export const CATEGORY_LABELS = CATEGORIES.reduce((a, c) => ({ ...a, [c.key]: c.label }), {});
