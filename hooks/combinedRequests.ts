// hooks/queries/combinedRequests.ts

import { useMemo } from 'react';
import { useCustomerRequestsQuery } from './queries';
import { useCustomerOrdersQuery } from './queries';

// ============================================
// TYPES
// ============================================

export interface CombinedRequest {
    id: string;
    type: 'service_request' | 'order';
    originalId: string;
    title: string;
    address: string;
    status: string;
    statusLabel: string;
    statusColor: string;
    createdAt: string;
    assignedAt?: string | null;
    assignedMistriId?: string | null;
    unpaid?: boolean;
    total: number;
    itemCount?: number;
    items?: any[];
    mistriDetails?: any | null;
    originalData: any;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        'pending': 'Pending Approval',
        'assigned': 'Assigned',
        'completed': 'Completed ✅',
        'canceled': 'Canceled',
    };
    return labels[status] || status;
};

const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        'pending': '#f59e0b',
        'assigned': '#3b82f6',
        'completed': '#10b981',
        'canceled': '#ef4444',
    };
    return colors[status] || '#94a3b8';
};

const getOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'assigned': 'Assigned',
        'in_progress': 'In Progress',
        'completed': 'Completed ✅',
        'cancelled': 'Cancelled',
        'rejected': 'Rejected',
    };
    return labels[status] || status;
};

const getOrderStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        'pending': '#f59e0b',
        'confirmed': '#3b82f6',
        'assigned': '#8b5cf6',
        'in_progress': '#f59e0b',
        'completed': '#10b981',
        'cancelled': '#ef4444',
        'rejected': '#ef4444',
    };
    return colors[status] || '#94a3b8';
};

// ============================================
// MAIN HOOK
// ============================================

/**
 * Hook to get combined service requests and orders
 * Merges both types into a single sorted list
 */
export const useCombinedRequests = (statusFilter?: string) => {
    // Fetch service requests
    const { 
        data: serviceRequests = [], 
        isLoading: isLoadingService,
        refetch: refetchService,
    } = useCustomerRequestsQuery();

    // Fetch orders
    const { 
        data: orders = [], 
        isLoading: isLoadingOrders,
        refetch: refetchOrders,
    } = useCustomerOrdersQuery(statusFilter);

    const isLoading = isLoadingService || isLoadingOrders;

    // Memoize the combined list
    const combinedData = useMemo(() => {
        // Map service requests to combined format
        const serviceRequestsMapped: CombinedRequest[] = serviceRequests.map((req: any) => ({
            id: `sr_${req.id}`,
            type: 'service_request',
            originalId: req.id,
            title: req.type?.charAt(0).toUpperCase() + req.type?.slice(1) || 'Service Request',
            address: req.address,
            status: req.status,
            statusLabel: getStatusLabel(req.status),
            statusColor: getStatusColor(req.status),
            createdAt: req.createdAt,
            assignedAt: req.assignedAt || null,
            assignedMistriId: req.assignedMistriId || null,
            unpaid: req.unpaid || false,
            total: parseFloat(req.paymentAmount || '0'),
            itemCount: 1,
            items: null,
            mistriDetails: req.mistriDetails || null,
            originalData: req,
        }));

        // Map orders to combined format
        const ordersMapped: CombinedRequest[] = orders.map((order: any) => ({
            id: `ord_${order.id}`,
            type: 'order',
            originalId: order.id,
            title: `Order #${order.id.slice(0, 8).toUpperCase()}`,
            address: order.address,
            status: order.status,
            statusLabel: getOrderStatusLabel(order.status),
            statusColor: getOrderStatusColor(order.status),
            createdAt: order.createdAt,
            assignedAt: order.assignedAt || null,
            assignedMistriId: order.assignedMistriId || null,
            unpaid: order.paymentStatus === 'pending',
            total: parseFloat(order.total || '0'),
            itemCount: order.itemCount || 0,
            items: order.items || [],
            mistriDetails: order.mistriDetails || null,
            originalData: order,
        }));

        // Combine and sort by createdAt (newest first)
        const combined = [...serviceRequestsMapped, ...ordersMapped];
        combined.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        return combined;
    }, [serviceRequests, orders]);

    return {
        data: combinedData,
        isLoading,
        serviceRequests,
        orders,
        refetch: () => {
            refetchService();
            refetchOrders();
        },
    };
};

// ============================================
// FILTERED COMBINED REQUESTS HOOK
// ============================================

interface UseFilteredCombinedRequestsOptions {
    type?: 'all' | 'service_request' | 'order';
    searchQuery?: string;
    statusFilter?: string;
    sortOrder?: 'newest' | 'oldest';
}

/**
 * Hook to get filtered and sorted combined requests
 */
export const useFilteredCombinedRequests = (options: UseFilteredCombinedRequestsOptions = {}) => {
    const { 
        type = 'all', 
        searchQuery = '', 
        statusFilter = 'all',
        sortOrder = 'newest',
    } = options;

    const { data: allRequests, isLoading, refetch } = useCombinedRequests(statusFilter);

    const filteredData = useMemo(() => {
        let filtered = allRequests;

        // Filter by type
        if (type !== 'all') {
            filtered = filtered.filter(req => req.type === type);
        }

        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(req => req.status === statusFilter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(req => 
                req.title.toLowerCase().includes(query) ||
                req.address.toLowerCase().includes(query) ||
                req.originalId.toLowerCase().includes(query)
            );
        }

        // Sort by date
        filtered = [...filtered].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return filtered;
    }, [allRequests, type, searchQuery, statusFilter, sortOrder]);

    return {
        data: filteredData,
        allData: allRequests,
        isLoading,
        refetch,
        counts: {
            total: filteredData.length,
            serviceRequests: filteredData.filter(r => r.type === 'service_request').length,
            orders: filteredData.filter(r => r.type === 'order').length,
        },
    };
};

// ============================================
// STATISTICS HOOK
// ============================================

/**
 * Hook to get statistics about combined requests
 */
export const useCombinedRequestsStats = () => {
    const { data: allRequests, isLoading } = useCombinedRequests();

    const stats = useMemo(() => {
        const pending = allRequests.filter(r => 
            r.status === 'pending' || r.status === 'Pending'
        );
        const assigned = allRequests.filter(r => 
            r.status === 'assigned' || r.status === 'Assigned' || r.status === 'confirmed'
        );
        const completed = allRequests.filter(r => 
            r.status === 'completed' || r.status === 'Completed'
        );
        const cancelled = allRequests.filter(r => 
            r.status === 'canceled' || r.status === 'cancelled' || r.status === 'Cancelled' || r.status === 'Canceled'
        );

        const totalAmount = allRequests.reduce((sum, r) => sum + r.total, 0);
        const unpaidAmount = allRequests
            .filter(r => r.unpaid)
            .reduce((sum, r) => sum + r.total, 0);

        return {
            total: allRequests.length,
            pending: pending.length,
            assigned: assigned.length,
            completed: completed.length,
            cancelled: cancelled.length,
            totalAmount,
            unpaidAmount,
            serviceRequests: allRequests.filter(r => r.type === 'service_request').length,
            orders: allRequests.filter(r => r.type === 'order').length,
        };
    }, [allRequests]);

    return {
        stats,
        isLoading,
    };
};