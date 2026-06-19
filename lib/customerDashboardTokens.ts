/**
 * Customer app shell tokens — same structural language as `mistriDashboardTokens`,
 * with a single fixed brand accent (no per-trade / DB-driven colors).
 */
export const customerBrand = {
    accent: '#2563eb',
    /** Soft fill behind icons / chips */
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    accentRgb: '37, 99, 235',
} as const;

export const customerDashboardColors = {
    canvas: '#f2f4f3',
    /** Hero banner / panels on canvas — not white */
    cardFill: '#e2e7e4',
    surface: '#ffffff',
    surfaceMuted: '#fafbfb',
    text: '#18181b',
    muted: '#71717a',
    cardBorder: 'rgba(15, 23, 42, 0.08)',
} as const;

export const customerDashboardElevation = {
    header: '0 10px 28px rgba(15, 23, 42, 0.07), 0 2px 8px rgba(15, 23, 42, 0.04)',
    card: '0 6px 20px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
} as const;
