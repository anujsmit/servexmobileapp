import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../lib/config';
import { getServiceConfig, getServiceIcon, DEFAULT_SERVICE_CONFIG } from '../lib/serviceConfig';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Raw service data from database
 */
interface ServiceFromDB {
    id: number;
    serviceName: string;
    description: string | null;
    mapIconColor: string | null;
    isActive: boolean;
}

/**
 * Enriched service with display configuration merged in
 */
export interface EnrichedService {
    id: number;
    serviceName: string;
    description: string | null;
    color: string;                    // DB color or fallback from dictionary
    icon: IoniconName;                // From dictionary
    iconSelected: IoniconName;        // From dictionary
    displayName: string;              // Formatted name from dictionary or capitalized serviceName
    isActive: boolean;
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

const fetchServices = async (): Promise<ServiceFromDB[]> => {
    const response = await fetch(`${API_BASE_URL}/api/services`);
    if (!response.ok) {
        throw new Error('Failed to fetch services');
    }
    const data = await response.json();
    return data.services;
};

/**
 * Enriches a service from the database with display configuration
 */
const enrichService = (dbService: ServiceFromDB): EnrichedService => {
    const config = getServiceConfig(dbService.serviceName);

    return {
        id: dbService.id,
        serviceName: dbService.serviceName,
        description: dbService.description,
        // Use DB color if available, otherwise fallback to dictionary default
        color: dbService.mapIconColor || config.defaultColor,
        icon: config.icon,
        iconSelected: config.iconSelected,
        // Use dictionary display name or capitalize the service name
        displayName: config.displayName ||
                    dbService.serviceName.charAt(0).toUpperCase() + dbService.serviceName.slice(1),
        isActive: dbService.isActive,
    };
};

export const ServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { data: rawServices = [], isLoading, error } = useQuery({
        queryKey: ['services'],
        queryFn: fetchServices,
        staleTime: Infinity, // Services rarely change, cache forever
        gcTime: Infinity, // Don't garbage collect
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
        return services.find(s => s.serviceName.toLowerCase() === name.toLowerCase());
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
