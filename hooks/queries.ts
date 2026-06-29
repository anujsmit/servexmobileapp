// hooks/queries.ts

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

// API base URL
import { API_BASE_URL as API_URL } from '../lib/config';

// ============================================
// SHARED TYPES
// ============================================

export interface ServiceRequest {
    id: string;
    type: string;
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    assignedAt?: string;
    completedAt?: string;
    assignedMistriId?: string;
    unpaid: boolean;
    startedWorkAt?: string;
    arrivedAt?: string;
    arrivalLat?: string;
    arrivalLng?: string;
    arrivalDistance?: string;
    completionPhotos?: string[];
    completionNote?: string;
    durationMinutes?: number;
    warrantyStartDate?: string;
    warrantyEndDate?: string;
}

export type OrderStatus = 
    | 'pending' 
    | 'confirmed' 
    | 'assigned' 
    | 'in_progress' 
    | 'completed' 
    | 'cancelled' 
    | 'rejected';

export type PaymentStatus = 
    | 'pending' 
    | 'paid' 
    | 'failed' 
    | 'refunded';

export interface OrderItem {
    id: string;
    serviceItemId: string;
    name: string;
    description: string | null;
    price: number;
    quantity: number;
    subtotal: number;
    durationMinutes: number | null;
    imageUrl: string | null;
}

export interface OrderTimelineEvent {
    id: string;
    status: OrderStatus;
    note: string | null;
    metadata: any | null;
    createdAt: string;
}

export interface Order {
    id: string;
    customerId: string;
    assignedMistriId: string | null;
    serviceRequestId: string | null;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    subtotal: number;
    tax: number;
    deliveryFee: number;
    discount: number;
    total: number;
    address: string;
    city: string | null;
    zipCode: string | null;
    latitude: string | null;
    longitude: string | null;
    customerNotes: string | null;
    adminNotes: string | null;
    paymentMethod: 'cash' | 'card' | 'online';
    paymentDetails: any | null;
    scheduledDate: string | null;
    scheduledTime: string | null;
    createdAt: string;
    updatedAt: string;
    confirmedAt: string | null;
    assignedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    items: OrderItem[];
    timeline: OrderTimelineEvent[];
    itemCount: number;
    mistriDetails?: {
        id: string;
        fullName: string;
        phoneNumber: string;
        profilePhotoUrl: string;
        averageRating: string;
        jobsCompleted: number;
    } | null;
}

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

const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        'pending': 'Pending Approval',
        'assigned': 'Assigned',
        'completed': 'Completed ✅',
        'canceled': 'Canceled',
    };
    return labels[status] || status;
};

const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
        'pending': '#f59e0b',
        'assigned': '#3b82f6',
        'completed': '#10b981',
        'canceled': '#ef4444',
    };
    return colors[status] || '#94a3b8';
};

const getOrderStatusLabel = (status: string) => {
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

const getOrderStatusColor = (status: string) => {
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
// CUSTOMER SERVICE REQUEST HOOKS
// ============================================

/**
 * Fetch customer service requests (for the logged-in customer)
 */
const fetchCustomerRequests = async (): Promise<ServiceRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch requests');
    }
    const data = await response.json();
    const requests = data.requests as ServiceRequest[];
    const seen = new Set<string>();
    return requests.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
};

export const useCustomerRequestsQuery = () => {
    return useQuery({
        queryKey: ['customerRequests'],
        queryFn: fetchCustomerRequests,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Fetch pending service requests for mistri
 */
const fetchMistriPendingJobs = async (): Promise<ServiceRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/pending`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch pending jobs');
    }
    const data = await response.json();
    return data.requests as ServiceRequest[];
};

export const useMistriPendingJobsQuery = () => {
    return useQuery({
        queryKey: ['mistriPendingJobs'],
        queryFn: fetchMistriPendingJobs,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// Keep the old name for backward compatibility
export const useMistriJobsQuery = useMistriPendingJobsQuery;

/**
 * Create a new service request (customer)
 */
const createServiceRequest = async (requestBody: {
    type: string;
    platformServiceIds?: string[];
    coords: { lat: number; lng: number };
    address: string;
    source: 'gps' | 'drag';
    selectedMistriId?: string;
    customerNotes?: string;
}): Promise<{ requestId: string; status: string }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create service request');
    }
    const data = await response.json();
    return {
        requestId: data.requestId,
        status: data.status,
    };
};

export const useCreateServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createServiceRequest,
        onSuccess: (data, variables) => {
            const newReq = {
                id: data.requestId,
                type: variables.type,
                address: variables.address,
                status: data.status as 'pending',
                createdAt: new Date().toISOString(),
                unpaid: false,
            };
            queryClient.setQueryData<ServiceRequest[]>(['customerRequests'], (old) => {
                const existing = old ?? [];
                if (existing.some(r => r.id === data.requestId)) return existing;
                return [newReq, ...existing];
            });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
        },
    });
};

/**
 * Cancel a service request (customer)
 */
const cancelServiceRequest = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/service-requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to cancel service request');
    }
};

export const useCancelServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: cancelServiceRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
        },
    });
};

// ---- Single service request (for polling assignment) ----
export interface ServiceRequestDetail extends ServiceRequest {
    lat?: string;
    lng?: string;
    customerNotes?: string;
}

export interface MistriDetails {
    id: string;
    name: string;
    phone: string;
    profilePhotoUrl?: string;
    averageRating?: number;
    jobsCompleted?: number;
}

export interface CustomerDetails {
    id: string;
    name: string;
    phone: string;
}

export interface ServiceRequestResponse {
    success: boolean;
    request: ServiceRequestDetail;
    selectedServices?: Array<{
        id: string;
        name: string;
        description?: string;
        price: string;
        imageUrl?: string;
    }>;
    mistriDetails?: MistriDetails;
    customerDetails?: CustomerDetails;
}

const fetchServiceRequestById = async (id: string): Promise<ServiceRequestResponse> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/service-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch service request');
    }
    const data = await response.json();
    return data as ServiceRequestResponse;
};

export const useServiceRequestQuery = (
    id: string | null,
    options?: { refetchInterval?: number; refetchIntervalInBackground?: boolean }
) => {
    return useQuery({
        queryKey: ['serviceRequest', id],
        queryFn: () => fetchServiceRequestById(id!),
        enabled: !!id,
        refetchInterval: options?.refetchInterval,
        refetchIntervalInBackground: options?.refetchIntervalInBackground,
    });
};

// ---- Nearby Mistris ----
export interface NearbyMistri {
    id: string;
    fullName: string;
    distance: number;
    serviceName: string;
    serviceMapIconColor: string;
    profilePhotoUrl?: string;
    bio?: string;
    averageRating?: number;
    jobsCompleted: number;
    location: {
        lat: number;
        lng: number;
    };
}

const fetchNearbyMistris = async (customerLocation: { lat: number; lng: number; maxDistanceKm?: number }): Promise<NearbyMistri[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/mistri/nearby`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(customerLocation),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch nearby mistris');
    }

    const data = await response.json();
    return data.mistris as NearbyMistri[];
};

export const useNearbyMistrisQuery = (customerLocation: { lat: number; lng: number; maxDistanceKm?: number } | null) => {
    return useQuery({
        queryKey: ['nearbyMistris', customerLocation],
        queryFn: () => fetchNearbyMistris(customerLocation!),
        enabled: !!customerLocation,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });
};

// ============================================
// MISTRI SPECIFIC HOOKS
// ============================================

// ---- Targeted Requests (for mistris) ----
export interface TargetedRequest {
    id: string;
    type: string;
    lat: string;
    lng: string;
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    customerName: string;
    customerId: string;
    unpaid: boolean;
    completedAt?: string;
}

const fetchTargetedRequests = async (): Promise<TargetedRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/mistri/requests/targeted`, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch targeted requests');
    }

    const data = await response.json();
    return data.requests as TargetedRequest[];
};

export const useTargetedRequestsQuery = (options?: { enablePolling?: boolean }) => {
    const shouldPoll = options?.enablePolling !== false;
    return useQuery({
        queryKey: ['targetedRequests'],
        queryFn: fetchTargetedRequests,
        refetchInterval: shouldPoll ? 10000 : false,
        refetchOnWindowFocus: true,
    });
};

// ---- Mistri Accepted Jobs ----
export interface MistriJob {
    id: string;
    type: string;
    lat: string;
    lng: string;
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    assignedAt?: string;
    completedAt?: string;
    customerName: string;
    customerId: string;
    unpaid: boolean;
    paymentAmount?: string;
}

const fetchMistriAcceptedJobs = async (): Promise<MistriJob[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/mistri/requests/accepted-jobs`, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch accepted jobs');
    }

    const data = await response.json();
    return data.jobs as MistriJob[];
};

export const useMistriAcceptedJobsQuery = (options?: { enablePolling?: boolean }) => {
    const shouldPoll = options?.enablePolling !== false;
    return useQuery({
        queryKey: ['mistriAcceptedJobs'],
        queryFn: fetchMistriAcceptedJobs,
        staleTime: 5 * 60 * 1000,
        refetchInterval: shouldPoll ? 10000 : false,
        refetchOnWindowFocus: true,
    });
};

// ---- Mistri Profile ----
export interface MistriProfile {
    userId: string;
    fullName: string;
    phoneNumber: string;
    serviceId: number;
    serviceName: string;
    mapIconColor?: string | null;
    profilePhotoUrl?: string;
    bio?: string;
    currentLocation?: string;
    isAvailable: boolean;
    availabilityStatus: 'available' | 'unavailable' | 'on_work_available';
    averageRating?: number;
    jobsCompleted: number;
}

const fetchMistriProfile = async (): Promise<MistriProfile> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/mistri/profile`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch mistri profile');
    }
    const data = await response.json();
    return data.profile as MistriProfile;
};

export const useMistriProfileQuery = () => {
    return useQuery({
        queryKey: ['mistriProfile'],
        queryFn: fetchMistriProfile,
        staleTime: 5 * 60 * 1000,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
    });
};

const updateMistriProfileApi = async (updates: {
    serviceId?: number;
    profilePhotoBase64?: string;
    currentLocation?: string;
    fullName?: string;
    bio?: string;
    isAvailable?: boolean;
    availabilityStatus?: 'available' | 'unavailable' | 'on_work_available';
}): Promise<MistriProfile> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/mistri/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update mistri profile');
    }
    const data = await response.json();
    return data.profile as MistriProfile;
};

export const useUpdateMistriProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateMistriProfileApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mistriProfile'] });
        },
    });
};

// ---- Create Mistri Profile (Onboarding) ----
const createMistriProfileApi = async (profileData: {
    serviceId: number;
    profilePhotoBase64: string;
    currentLocation: string;
    fullName: string;
    bio?: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'expert';
    govtIdType?: string;
    govtIdFrontBase64?: string;
    govtIdBackBase64?: string;
}): Promise<{ success: boolean; message: string; profile: MistriProfile }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create mistri profile');
    }
    return await response.json();
};

export const useCreateMistriProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createMistriProfileApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mistriProfile'] });
        },
    });
};

// ---- Complete Service Request (Legacy - Mistri) ----
const completeServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to complete request');
    }
};

export const useCompleteServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: completeServiceRequestApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Toggle Unpaid Status (Mistri) ----
const toggleUnpaidApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/toggle-unpaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to toggle unpaid status');
    }
};

export const useToggleUnpaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: toggleUnpaidApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Accept Service Request (Mistri) ----
const acceptServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to accept request');
    }
};

export const useAcceptServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: acceptServiceRequestApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Decline Service Request (Mistri) ----
const declineServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to decline request');
    }
};

export const useDeclineServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: declineServiceRequestApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
        },
    });
};

// ---- Mark Job as Paid (Mistri) ----
const markJobAsPaidApi = async (id: string): Promise<{
    success: boolean;
    message: string;
    isPaid: boolean;
    paidAt?: string;
    amount?: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark job as paid');
    }
    return await response.json();
};

export const useMarkJobAsPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markJobAsPaidApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['earnings'] });
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
        },
    });
};

// ============================================
// MISTRI MUTATIONS - START WORK
// ============================================

const startWorkApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/start-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to start work');
    }
};

export const useStartWork = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: startWorkApi,
        onSuccess: (_data, id) => {
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
        },
    });
};

// ============================================
// MISTRI MUTATIONS - MARK ARRIVED
// ============================================

const markArrivedApi = async (id: string, coords?: { lat: number; lng: number }): Promise<{ request: any; distance: number }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/arrive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: coords?.lat, lng: coords?.lng }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark arrival');
    }
    const data = await response.json();
    return data;
};

export const useMarkArrived = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, coords }: { id: string; coords?: { lat: number; lng: number } }) =>
            markArrivedApi(id, coords),
        onSuccess: (_data, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
        },
    });
};

// ============================================
// MISTRI MUTATIONS - COMPLETE WITH PHOTOS
// ============================================

const completeJobWithPhotosApi = async (id: string, photos: string[], note: string): Promise<{
    request: any;
    photos: string[];
    warranty: { startDate: string; endDate: string; durationDays: number };
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/complete-with-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photos, note }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to complete job');
    }
    return await response.json();
};

export const useCompleteJobWithPhotos = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, photos, note }: { id: string; photos: string[]; note: string }) =>
            completeJobWithPhotosApi(id, photos, note),
        onSuccess: (_data, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['mistriAcceptedJobs'] });
            queryClient.invalidateQueries({ queryKey: ['mistriPendingJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['earnings'] });
            queryClient.invalidateQueries({ queryKey: ['completionPhotos', id] });
            queryClient.invalidateQueries({ queryKey: ['warrantyStatus', id] });
        },
    });
};

// ============================================
// MISTRI QUERIES - GET COMPLETION PHOTOS
// ============================================

const fetchCompletionPhotos = async (id: string): Promise<{
    photos: string[];
    warranty: { startDate: string; endDate: string; isActive: boolean } | null;
    note: string | null;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch photos');
    }
    return await response.json();
};

export const useCompletionPhotosQuery = (id: string | null) => {
    return useQuery({
        queryKey: ['completionPhotos', id],
        queryFn: () => fetchCompletionPhotos(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
};

// ============================================
// MISTRI QUERIES - GET WARRANTY STATUS
// ============================================

const fetchWarrantyStatus = async (id: string): Promise<{
    warranty: {
        hasWarranty: boolean;
        startDate: string | null;
        endDate: string | null;
        isActive: boolean;
        daysRemaining: number;
        totalDays: number;
    };
    photos: string[];
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/requests/${id}/warranty`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch warranty status');
    }
    return await response.json();
};

export const useWarrantyStatusQuery = (id: string | null) => {
    return useQuery({
        queryKey: ['warrantyStatus', id],
        queryFn: () => fetchWarrantyStatus(id!),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 60000, // Refresh every minute to update days remaining
    });
};

// ============================================
// EARNINGS (Mistri)
// ============================================

export interface EarningsJob {
    id: string;
    type: string;
    customerName: string;
    amount: number;
    completedAt: string;
    paidAt?: string;
    isPaid: boolean;
    services: Array<{
        name: string;
        price: number;
    }>;
}

export interface EarningsSummary {
    totalEarnings: number;
    paidEarnings: number;
    unpaidEarnings: number;
    totalJobs: number;
    paidJobs: number;
    unpaidJobs: number;
    averagePerJob: number;
}

export interface EarningsTrend {
    date: string;
    amount: number;
    jobCount: number;
}

export interface EarningsResponse {
    success: boolean;
    period: string;
    summary: EarningsSummary;
    trend: EarningsTrend[];
    jobs: EarningsJob[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const fetchEarnings = async (period: string = 'month', page: number = 1, limit: number = 20): Promise<EarningsResponse> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/jobs/earnings?period=${period}&page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch earnings');
    }
    const data = await response.json();
    return data as EarningsResponse;
};

export const useEarningsQuery = (period: string = 'month', page: number = 1, limit: number = 20) => {
    return useQuery({
        queryKey: ['earnings', period, page, limit],
        queryFn: () => fetchEarnings(period, page, limit),
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// ============================================
// NOTIFICATIONS (Customer/Mistri)
// ============================================

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    relatedRequestId?: string;
    isRead: boolean;
    createdAt: string;
}

const fetchNotifications = async (): Promise<{ notifications: Notification[]; unreadCount: number }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch notifications');
    }
    const data = await response.json();
    return { notifications: data.notifications, unreadCount: data.unreadCount };
};

export const useNotificationsQuery = () => {
    return useQuery({
        queryKey: ['notifications'],
        queryFn: fetchNotifications,
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });
};

const markNotificationAsReadApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark notification as read');
    }
};

export const useMarkNotificationAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markNotificationAsReadApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

const markAllNotificationsAsReadApi = async (): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark all notifications as read');
    }
};

export const useMarkAllNotificationsAsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markAllNotificationsAsReadApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

// ============================================
// RATINGS
// ============================================

export interface Rating {
    id: string;
    serviceRequestId: string;
    customerId: string;
    mistriId: string;
    rating: number;
    review?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RatingWithCustomer {
    id: string;
    rating: number;
    review?: string;
    createdAt: string;
    customerName: string;
}

// ---- Create Rating (Customer) ----
const createRatingApi = async (ratingData: {
    serviceRequestId: string;
    rating: number;
    review?: string;
}): Promise<Rating> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(ratingData),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create rating');
    }
    const data = await response.json();
    return data.rating as Rating;
};

export const useCreateRating = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createRatingApi,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['ratings', data.mistriId] });
            queryClient.invalidateQueries({ queryKey: ['mistriProfile'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', data.serviceRequestId] });
            queryClient.invalidateQueries({ queryKey: ['ratingStatus', data.serviceRequestId] });
        },
    });
};

// ---- Check if Rated (Customer) ----
const checkIfRated = async (serviceRequestId: string): Promise<{
    isRated: boolean;
    rating: Rating | null;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/users/ratings/check/${serviceRequestId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to check rating status');
    }
    const data = await response.json();
    return {
        isRated: data.isRated,
        rating: data.rating,
    };
};

export const useRatingStatusQuery = (serviceRequestId: string | null) => {
    return useQuery({
        queryKey: ['ratingStatus', serviceRequestId],
        queryFn: () => checkIfRated(serviceRequestId!),
        enabled: !!serviceRequestId,
        staleTime: 5 * 60 * 1000,
    });
};

// ---- Fetch Mistri Ratings (Public) ----
const fetchMistriRatings = async (mistriId: string): Promise<{
    ratings: RatingWithCustomer[];
    averageRating: number;
    totalRatings: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/ratings/${mistriId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch ratings');
    }
    const data = await response.json();
    return {
        ratings: data.ratings,
        averageRating: data.averageRating,
        totalRatings: data.totalRatings,
    };
};

export const useMistriRatingsQuery = (mistriId: string | null) => {
    return useQuery({
        queryKey: ['ratings', mistriId],
        queryFn: () => fetchMistriRatings(mistriId!),
        enabled: !!mistriId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// ---- Fetch My Ratings (Mistri) ----
const fetchMyRatings = async (): Promise<{
    ratings: (Rating & { requestId: string; customerName: string })[];
    averageRating: number;
    totalRatings: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/mistri/ratings/my`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch ratings');
    }
    const data = await response.json();
    return {
        ratings: data.ratings,
        averageRating: data.averageRating,
        totalRatings: data.totalRatings,
    };
};

export const useMistriReceivedRatingsQuery = () => {
    return useQuery({
        queryKey: ['myRatings'],
        queryFn: fetchMyRatings,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// ============================================
// PLATFORM SERVICES
// ============================================

export interface PlatformService {
    id: string;
    name: string;
    description?: string;
    price: string;
    imageUrl?: string;
}

export interface PlatformServiceCategory {
    categoryId: number;
    categoryName: string;
    services: PlatformService[];
}

const fetchPlatformServices = async (): Promise<PlatformServiceCategory[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/platform-services`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch platform services');
    }
    const data = await response.json();
    return data.categories as PlatformServiceCategory[];
};

export const usePlatformServicesQuery = () => {
    return useQuery({
        queryKey: ['platformServices'],
        queryFn: fetchPlatformServices,
        staleTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
};

// ============================================
// ORDER HOOKS (Customer)
// ============================================

/**
 * Fetch customer orders
 */
const fetchCustomerOrders = async (status?: string): Promise<Order[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const url = status && status !== 'all' 
        ? `${API_URL}/api/orders?status=${status}`
        : `${API_URL}/api/orders`;

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch orders');
    }

    const data = await response.json();
    return data.orders || [];
};

export const useCustomerOrdersQuery = (status?: string) => {
    return useQuery({
        queryKey: ['customerOrders', status],
        queryFn: () => fetchCustomerOrders(status),
        staleTime: 5 * 60 * 1000,
        refetchInterval: 30000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Fetch order by ID
 */
const fetchOrderById = async (orderId: string): Promise<Order> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch order');
    }

    const data = await response.json();
    return data.order;
};

export const useOrderQuery = (orderId: string | null) => {
    return useQuery({
        queryKey: ['order', orderId],
        queryFn: () => fetchOrderById(orderId!),
        enabled: !!orderId,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 30000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Create a new order
 */
const createOrderApi = async (orderData: {
    items: Array<{
        serviceItemId: string;
        quantity: number;
    }>;
    address: string;
    city?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
    customerNotes?: string;
    paymentMethod: 'cash' | 'card' | 'online';
    scheduledDate?: string;
    scheduledTime?: string;
    email?: string;
}): Promise<{ success: boolean; message: string; order: Order }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create order');
    }

    return await response.json();
};

export const useCreateOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createOrderApi,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
            queryClient.setQueryData<Order[]>(['customerOrders'], (old) => {
                if (!old) return [data.order];
                return [data.order, ...old];
            });
        },
    });
};

/**
 * Cancel an order
 */
const cancelOrderApi = async (orderId: string, reason?: string): Promise<{ success: boolean; message: string; order: Order }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reason || 'Customer cancelled' }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to cancel order');
    }

    return await response.json();
};

export const useCancelOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) => 
            cancelOrderApi(orderId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
            queryClient.invalidateQueries({ queryKey: ['order'] });
        },
    });
};

/**
 * Get order counts by status
 */
const fetchOrderCounts = async (): Promise<Record<string, number>> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/orders/counts`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch order counts');
    }

    const data = await response.json();
    return data.counts;
};

export const useOrderCountsQuery = () => {
    return useQuery({
        queryKey: ['orderCounts'],
        queryFn: fetchOrderCounts,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// ============================================
// COMBINED REQUESTS HOOK (Customer)
// ============================================

export const useCombinedRequests = (statusFilter?: string) => {
    const { data: serviceRequests = [], isLoading: isLoadingService } = useCustomerRequestsQuery();
    const { data: orders = [], isLoading: isLoadingOrders } = useCustomerOrdersQuery(statusFilter);

    const isLoading = isLoadingService || isLoadingOrders;

    const combinedRequests = useQuery({
        queryKey: ['combinedRequests', statusFilter],
        queryFn: () => {
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
                assignedAt: req.assignedAt,
                assignedMistriId: req.assignedMistriId,
                unpaid: req.unpaid,
                total: parseFloat(req.paymentAmount || '0'),
                itemCount: 1,
                items: null,
                mistriDetails: req.mistriDetails || null,
                originalData: req,
            }));

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
                assignedAt: order.assignedAt,
                assignedMistriId: order.assignedMistriId,
                unpaid: order.paymentStatus === 'pending',
                total: parseFloat(order.total || '0'),
                itemCount: order.itemCount || 0,
                items: order.items || [],
                mistriDetails: order.mistriDetails || null,
                originalData: order,
            }));

            const combined = [...serviceRequestsMapped, ...ordersMapped];
            combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return combined;
        },
        enabled: !isLoading,
    });

    return {
        data: combinedRequests.data || [],
        isLoading,
        serviceRequests,
        orders,
        refetch: combinedRequests.refetch,
    };
};
