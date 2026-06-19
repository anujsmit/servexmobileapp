/**
 * Visual tokens for the mistri worker dashboard (home + related screens).
 * Neutral zinc/gray palette (aligned with customer flows); trade accent comes from MistriTradeTheme only.
 */
export const mistriDashboardColors = {
    /** Greeting: name, location, avatar */
    greetingBand: '#ffffff',
    /** Main scroll area */
    canvas: '#f9fafb',
    /** Metric / list / chart panels */
    cardFill: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f4f4f5',
    text: '#18181b',
    muted: '#71717a',
    /** Panel edge on canvas */
    cardBorder: 'rgba(15, 23, 42, 0.08)',
} as const;

export const mistriDashboardElevation = {
    header: '0 10px 28px rgba(15, 23, 42, 0.07), 0 2px 8px rgba(15, 23, 42, 0.04)',
    card: '0 6px 20px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
} as const;
