// context/ServicesContext.tsx

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/config';
import { getServiceConfig, getServiceIcon, DEFAULT_SERVICE_CONFIG } from '../lib/serviceConfig';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Raw service category data from database (new 3-level hierarchy)
 */
interface ServiceCategoryFromDB {
    id: number;
    name: string;                    // ✅ Changed from serviceName to name
    description: string | null;
    iconUrl: string | null;          // ✅ Changed from mapIconColor to iconUrl
    iconColor: string | null;        // ✅ Added iconColor
    isActive: boolean;
    displayOrder: number;
    subCategoryCount?: number;
}

/**
 * Enriched service with display configuration merged in
 */
export interface EnrichedService {
    id: number;
    serviceName: string;              // Maps from name field
    name: string;                     // Original name field
    description: string | null;
    color: string;                    // DB color or fallback from dictionary
    icon: IoniconName;                // From dictionary
    iconSelected: IoniconName;        // From dictionary
    displayName: string;              // Formatted name from dictionary or capitalized serviceName
    isActive: boolean;
    iconUrl: string | null;           // Custom icon URL
    subCategoryCount?: number;
}

interface ServicesContextType {
    services: EnrichedService[];      // All enriched services
    activeServices: EnrichedService[]; // Only active services
    isLoading: boolean;
    error: Error | null;
    getServiceByName: (name: string) => EnrichedService | undefined;
    getServiceColor: (name: string) => string;
    getServiceIcon: (name: string, selected?: boolean) => IoniconName;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);


// Update the fetchServices function
const fetchServices = async (): Promise<ServiceCategoryFromDB[]> => {
    // ✅ Use public endpoint
    const response = await fetch(`${API_BASE_URL}/api/public/categories`);
    if (!response.ok) {
        throw new Error('Failed to fetch service categories');
    }
    const data = await response.json();
    
    // Handle response format
    if (data?.success && data?.categories) {
        return data.categories;
    }
    return [];
};

/**
 * Enriches a service category from the database with display configuration
 */
const enrichService = (dbService: ServiceCategoryFromDB): EnrichedService => {
    // Use name field (which exists in service_categories)
    const serviceName = dbService.name || dbService.serviceName || 'Unnamed';
    const config = getServiceConfig(serviceName);

    return {
        id: dbService.id,
        serviceName: serviceName,
        name: dbService.name || serviceName,
        description: dbService.description,
        // Use DB color if available, otherwise fallback to dictionary default
        color: dbService.iconColor || config.defaultColor,
        icon: config.icon,
        iconSelected: config.iconSelected,
        // Use dictionary display name or capitalize the service name
        displayName: config.displayName ||
                    serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
        isActive: dbService.isActive !== false,
        iconUrl: dbService.iconUrl || null,
        subCategoryCount: dbService.subCategoryCount || 0,
    };
};

export const ServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { data: rawServices = [], isLoading, error } = useQuery({
        queryKey: ['service-categories'],
        queryFn: fetchServices,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });

    // Enrich all services with display configuration
    const services = useMemo(() => {
        return rawServices.map(enrichService);
    }, [rawServices]);

    // Filter to only active services
    const activeServices = useMemo(() => {
        return services.filter(s => s.isActive);
    }, [services]);

    const getServiceByName = (name: string): EnrichedService | undefined => {
        if (!name) return undefined;
        return services.find(s => 
            s.serviceName?.toLowerCase() === name.toLowerCase() ||
            s.name?.toLowerCase() === name.toLowerCase()
        );
    };

    const getServiceColor = (name: string): string => {
        const service = getServiceByName(name);
        return service?.color || DEFAULT_SERVICE_CONFIG.defaultColor;
    };

    const getServiceIconFn = (name: string, selected: boolean = false): IoniconName => {
        return getServiceIcon(name, selected);
    };

    return (
        <ServicesContext.Provider
            value={{
                services,
                activeServices,
                isLoading,
                error: error as Error | null,
                getServiceByName,
                getServiceColor,
                getServiceIcon: getServiceIconFn,
            }}
        >
            {children}
        </ServicesContext.Provider>
    );
};

export const useServices = (): ServicesContextType => {
    const context = useContext(ServicesContext);
    if (context === undefined) {
        throw new Error('useServices must be used within a ServicesProvider');
    }
    return context;
};