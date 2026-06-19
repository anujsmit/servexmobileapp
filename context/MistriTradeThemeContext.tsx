import React, { createContext, useContext, useMemo } from 'react';
import { buildMistriTradeTheme, type MistriTradeTheme } from '../lib/mistriTradeTheme';
import { useMistriProfileQuery } from '../hooks/queries';

const defaultTheme = buildMistriTradeTheme(null, null);

const MistriTradeThemeContext = createContext<MistriTradeTheme>(defaultTheme);

export function MistriTradeThemeProvider({ children }: { children: React.ReactNode }) {
    const { data: profile } = useMistriProfileQuery();
    const value = useMemo(
        () => buildMistriTradeTheme(profile?.serviceName, profile?.mapIconColor ?? null),
        [profile?.serviceName, profile?.mapIconColor]
    );
    return (
        <MistriTradeThemeContext.Provider value={value}>{children}</MistriTradeThemeContext.Provider>
    );
}

export function useMistriTradeTheme(): MistriTradeTheme {
    return useContext(MistriTradeThemeContext);
}
