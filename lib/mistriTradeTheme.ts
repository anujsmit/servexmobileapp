import { getServiceConfig } from './serviceConfig';

/** Matches `backend/src/scripts/seedServices.ts` mapIconColor values */
export type MistriTradeTheme = {
    accent: string;
    accentSoft: string;
    accentRgb: string;
};

const HEX6 = /^#([0-9A-Fa-f]{6})$/;

export function normalizeMapIconColor(hex: string | null | undefined): string | null {
    if (hex == null || typeof hex !== 'string') return null;
    const t = hex.trim();
    return HEX6.test(t) ? t.toLowerCase() : null;
}

export function hexToRgbTriplet(hex: string): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

export function softTintFromHex(hex: string, alpha: number): string {
    const [r, g, b] = hexToRgbTriplet(hex).split(', ').map(Number);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolve accent from DB `services.map_icon_color` when present; otherwise from service name (same defaults as seed).
 */
export function buildMistriTradeTheme(
    serviceName?: string | null,
    mapIconColor?: string | null
): MistriTradeTheme {
    const fromDb = normalizeMapIconColor(mapIconColor ?? undefined);
    const accent = fromDb ?? getServiceConfig(serviceName ?? '').defaultColor;
    return {
        accent,
        accentSoft: softTintFromHex(accent, 0.12),
        accentRgb: hexToRgbTriplet(accent),
    };
}
