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
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconColor: string | null;
    isActive: boolean;
    displayOrder: number;
    subCategoryCount?: number;
}

/**
 * Enriched service with display configuration merged in
 */
export interface EnrichedService {
    id: number;
    serviceName: string;
    name: string;
    description: string | null;
    color: string;
    icon: IoniconName;
    iconSelected: IoniconName;
    displayName: string;
    isActive: boolean;
    iconUrl: string | null;
    subCategoryCount?: number;
}

interface ServicesContextType {
    services: EnrichedService[];
    activeServices: EnrichedService[];
    isLoading: boolean;
    error: Error | null;
    getServiceByName: (name: string) => EnrichedService | undefined;
    getServiceColor: (name: string) => string;
    getServiceIcon: (name: string, selected?: boolean) => IoniconName;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

// ✅ Fallback categories
const getFallbackCategories = (): ServiceCategoryFromDB[] => {
    return [
        { id: 1, name: 'Plumber', description: 'Professional plumbing services', iconUrl: null, iconColor: '#e67e22', isActive: true, displayOrder: 1 },
        { id: 2, name: 'Electrician', description: 'Professional electrical services', iconUrl: null, iconColor: '#f1c40f', isActive: true, displayOrder: 2 },
        { id: 3, name: 'Painter', description: 'Professional painting services', iconUrl: null, iconColor: '#3498db', isActive: true, displayOrder: 3 },
        { id: 4, name: 'Carpenter', description: 'Professional carpentry services', iconUrl: null, iconColor: '#2ecc71', isActive: true, displayOrder: 4 },
        { id: 5, name: 'Cleaner', description: 'Professional cleaning services', iconUrl: null, iconColor: '#1abc9c', isActive: true, displayOrder: 5 },
        { id: 6, name: 'AC Repair', description: 'Professional AC repair services', iconUrl: null, iconColor: '#9b59b6', isActive: true, displayOrder: 6 },
        { id: 7, name: 'General', description: 'General services', iconUrl: null, iconColor: '#95a5a6', isActive: true, displayOrder: 7 },
    ];
};

// ✅ Fetch from service-hierarchy endpoint
const fetchServices = async (): Promise<ServiceCategoryFromDB[]> => {
    try {
        const url = `${API_BASE_URL}/api/public/service-hierarchy`;
        console.log('📡 Fetching services from hierarchy:', url);
        
        const response = await fetch(url, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
            },
        });
        
        console.log('📡 Hierarchy response status:', response.status);
        
        if (!response.ok) {
            console.warn(`⚠️ Hierarchy API returned ${response.status}, using fallback categories`);
            return getFallbackCategories();
        }
        
        const data = await response.json();
        console.log('📦 Hierarchy data received:', data);
        
        // Check if we got valid data
        if (data?.success && data?.hierarchy && data.hierarchy.length > 0) {
            // Convert hierarchy categories to ServiceCategoryFromDB format
            // Each category in hierarchy has: id, name, description, iconUrl, iconColor, displayOrder, subCategories, totalItems
            return data.hierarchy.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                description: cat.description || null,
                iconUrl: cat.iconUrl || null,
                iconColor: cat.iconColor || null,
                isActive: true,
                displayOrder: cat.displayOrder || 0,
                subCategoryCount: cat.subCategories?.length || 0,
            }));
        }
        
        // If no data, use fallback
        console.warn('⚠️ No categories in hierarchy response, using fallback');
        return getFallbackCategories();
        
    } catch (error) {
        console.error('❌ Error fetching services from hierarchy:', error);
        // Return fallback categories on error
        return getFallbackCategories();
    }
};

/**
 * Enriches a service category from the database with display configuration
 */
const enrichService = (dbService: ServiceCategoryFromDB): EnrichedService => {
    const serviceName = dbService.name || dbService.serviceName || 'Unnamed';
    const config = getServiceConfig(serviceName);

    return {
        id: dbService.id,
        serviceName: serviceName,
        name: dbService.name || serviceName,
        description: dbService.description,
        color: dbService.iconColor || config.defaultColor,
        icon: config.icon,
        iconSelected: config.iconSelected,
        displayName: config.displayName || serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
        isActive: dbService.isActive !== false,
        iconUrl: dbService.iconUrl || null,
        subCategoryCount: dbService.subCategoryCount || 0,
    };
};

export const ServicesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { data: rawServices = [], isLoading, error } = useQuery({
        queryKey: ['service-hierarchy'],
        queryFn: fetchServices,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
    });

    console.log('🔍 ServicesProvider - rawServices count:', rawServices?.length || 0);
    console.log('🔍 ServicesProvider - rawServices:', JSON.stringify(rawServices, null, 2));

    // Enrich all services with display configuration
    const services = useMemo(() => {
        if (!rawServices || rawServices.length === 0) {
            return [];
        }
        return rawServices.map(enrichService);
    }, [rawServices]);

    console.log('🔍 ServicesProvider - enriched services count:', services.length);
    console.log('🔍 ServicesProvider - enriched services:', JSON.stringify(services, null, 2));

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