/**
 * Service Configuration Dictionary
 *
 * This file defines the display configuration for each service type.
 * The database is still the source of truth for what services exist,
 * but this dictionary provides the UI metadata (icons, fallback colors, etc.)
 *
 * When a new service type is added to the database, add its configuration here.
 */

import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ServiceDisplayConfig {
    /** Ionicon name for this service type */
    icon: IoniconName;
    /** Icon to use when selected/active */
    iconSelected: IoniconName;
    /** Fallback color if database doesn't provide one */
    defaultColor: string;
    /** Formatted display name */
    displayName?: string;
}

/**
 * Service configuration dictionary
 * Key should match serviceName from database (case-insensitive matching)
 */
export const SERVICE_CONFIG: Record<string, ServiceDisplayConfig> = {
    plumber: {
        icon: 'water-outline',
        iconSelected: 'water-sharp',
        /** Aligned with `services.map_icon_color` in DB (seedServices) */
        defaultColor: '#0177b8',
        displayName: 'Plumber',
    },
    electrician: {
        icon: 'flash-outline',
        iconSelected: 'flash-sharp',
        defaultColor: '#179d2e',
        displayName: 'Electrician',
    },
    // Easy to add more services:
    // carpenter: {
    //     icon: 'hammer-outline',
    //     iconSelected: 'hammer-sharp',
    //     defaultColor: '#f59e0b',
    //     displayName: 'Carpenter',
    // },
    // painter: {
    //     icon: 'color-palette-outline',
    //     iconSelected: 'color-palette-sharp',
    //     defaultColor: '#ec4899',
    //     displayName: 'Painter',
    // },
};

/**
 * Default/fallback configuration for services not in dictionary
 */
export const DEFAULT_SERVICE_CONFIG: ServiceDisplayConfig = {
    icon: 'construct-outline',
    iconSelected: 'construct-sharp',
    defaultColor: '#6b7280', // Gray
};

/**
 * Get service configuration by name (case-insensitive)
 */
export const getServiceConfig = (serviceName: string): ServiceDisplayConfig => {
    const lowerName = serviceName.toLowerCase().trim();
    return SERVICE_CONFIG[lowerName] || DEFAULT_SERVICE_CONFIG;
};

/**
 * Get icon name for a service
 */
export const getServiceIcon = (serviceName: string, selected: boolean = false): IoniconName => {
    const config = getServiceConfig(serviceName);
    return selected ? config.iconSelected : config.icon;
};

/**
 * Get light background color from hex (10% opacity)
 */
export const getLightBgColor = (hex: string | null | undefined): string => {
    if (!hex) return 'rgba(107, 114, 128, 0.1)'; // Default gray

    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // Return rgba with low opacity
    return `rgba(${r}, ${g}, ${b}, 0.1)`;
};
