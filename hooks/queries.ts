import { useQuery, UseQueryResult, useQueryClient, useMutation } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

// API base URL
import { API_BASE_URL as API_URL } from '../lib/config';

// Shared service request type
export interface ServiceRequest {
    id: string;
    type: string; // Dynamic service type from database
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    assignedAt?: string;
    completedAt?: string;
    assignedMistriId?: string;
    unpaid: boolean;
}

/**
 * Fetch customer service requests (for the logged-in customer)
 */
const fetchCustomerRequests = async (): Promise<ServiceRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to fetch requests');
    }
    const data = await response.json();
    const requests = data.requests as ServiceRequest[];
    // Deduplicate by id to guard against any backend/cache anomalies
    const seen = new Set<string>();
    return requests.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
};

/**
 * React Query hook to get customer requests
 */
export const useCustomerRequestsQuery = () => {
    return useQuery({
        queryKey: ['customerRequests'],
        queryFn: fetchCustomerRequests,
        staleTime: 5 * 60 * 1000,       // 5 minutes
        refetchInterval: 5000,          // Poll every 5 seconds for real-time updates
        refetchOnWindowFocus: true,
    });
};

/**
 * Fetch mistri job list (unassigned service requests)
 */
const fetchMistriJobs = async (): Promise<ServiceRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/pending`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch pending jobs');
    }
    const data = await response.json();
    return data.requests as ServiceRequest[];
};

/**
 * React Query hook to get mistri jobs
 */
export const useMistriJobsQuery = () => {
    return useQuery({
        queryKey: ['mistriJobs'],
        queryFn: fetchMistriJobs,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Create a new service request
 */
const createServiceRequest = async (requestBody: {
    type: string; // Dynamic service type from database
    platformServiceIds?: string[]; // Array of platform service IDs
    coords: { lat: number; lng: number };
    address: string;
    source: 'gps' | 'drag';
    selectedMistriId?: string; // For targeted requests
    customerNotes?: string; // Custom description/notes from customer
}): Promise<{ requestId: string; status: string }> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests`, {
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

/**
 * React Query mutation hook for creating service requests
 */
export const useCreateServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createServiceRequest,
        onSuccess: (data, variables) => {
            // Optimistically add new request to the customerRequests cache
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
                // Avoid duplicate if item already exists (e.g. from a concurrent refetch)
                if (existing.some(r => r.id === data.requestId)) return existing;
                return [newReq, ...existing];
            });
            // Invalidate so the next background refetch replaces the optimistic item with server truth
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriJobs'] });
        },
    });
};

/**
 * Cancel a service request
 */
const cancelServiceRequest = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        throw new Error('Failed to cancel service request');
    }
};

/**
 * React Query mutation hook for canceling service requests
 */
export const useCancelServiceRequest = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: cancelServiceRequest,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            queryClient.invalidateQueries({ queryKey: ['mistriJobs'] });
            queryClient.invalidateQueries({ queryKey: ['targetedRequests'] });
        },
    });
};

// ---- Single service request (for polling assignment) ----
export interface ServiceRequestDetail extends ServiceRequest {
    lat?: string;
    lng?: string;
    customerNotes?: string; // Custom description/notes from customer
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
    mistriDetails?: MistriDetails; // Included when status is 'assigned' or 'completed' (for customer)
    customerDetails?: CustomerDetails; // Included when status is 'assigned' or 'completed' (for mistri)
}

const fetchServiceRequestById = async (id: string): Promise<ServiceRequestResponse> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}`, {
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

// Types for nearby mistris
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

/**
 * Fetch nearby mistris based on customer location
 */
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

/**
 * React Query hook to get nearby mistris
 */
export const useNearbyMistrisQuery = (customerLocation: { lat: number; lng: number; maxDistanceKm?: number } | null) => {
    return useQuery({
        queryKey: ['nearbyMistris', customerLocation],
        queryFn: () => fetchNearbyMistris(customerLocation!),
        enabled: !!customerLocation,
        staleTime: 0, // Always stale — mistri availability changes in real-time
        refetchOnMount: 'always', // Force fresh fetch every time the screen mounts
        refetchOnWindowFocus: true,
    });
};

// ---- Targeted Requests (for mistris) ----
export interface TargetedRequest {
    id: string;
    type: string; // Dynamic service type from database
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

/**
 * Fetch targeted requests (requests assigned to current mistri)
 */
const fetchTargetedRequests = async (): Promise<TargetedRequest[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/mistri/targeted-requests`, {
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

/**
 * React Query hook to get targeted requests for mistri
 * @param options.enablePolling - If false, disables the 10-second polling (e.g., when mistri is unavailable/on_work)
 */
export const useTargetedRequestsQuery = (options?: { enablePolling?: boolean }) => {
    const shouldPoll = options?.enablePolling !== false;
    return useQuery({
        queryKey: ['targetedRequests'],
        queryFn: fetchTargetedRequests,
        refetchInterval: shouldPoll ? 10000 : false, // Poll every 10 seconds only when available
        refetchOnWindowFocus: true,
    });
};

// ---- Mistri Accepted Jobs ----
export interface MistriJob {
    id: string;
    type: string; // Dynamic service type from database
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
}

/**
 * Fetch mistri's accepted jobs (jobs where status is 'assigned' and assignedMistriId matches current mistri)
 */
const fetchMistriAcceptedJobs = async (): Promise<MistriJob[]> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/mistri/accepted-jobs`, {
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

/**
 * React Query hook to get mistri's accepted jobs
 * @param options.enablePolling - If false, disables the 10-second polling (e.g., when mistri is unavailable/on_work)
 */
export const useMistriAcceptedJobsQuery = (options?: { enablePolling?: boolean }) => {
    const shouldPoll = options?.enablePolling !== false;
    return useQuery({
        queryKey: ['mistriAcceptedJobs'],
        queryFn: fetchMistriAcceptedJobs,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: shouldPoll ? 10000 : false, // Poll every 10 seconds only when available
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
    /** From `services.map_icon_color` — plumber/electrician brand color */
    mapIconColor?: string | null;
    profilePhotoUrl?: string;
    bio?: string;
    currentLocation?: string;
    isAvailable: boolean;
    availabilityStatus: 'available' | 'unavailable' | 'on_work_available';
    averageRating?: number;
    jobsCompleted: number;
}

/**
 * Fetch mistri profile for the current user
 */
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

/**
 * React Query hook to get mistri profile
 */
export const useMistriProfileQuery = () => {
    return useQuery({
        queryKey: ['mistriProfile'],
        queryFn: fetchMistriProfile,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: Infinity, // Keep profile cached indefinitely
        refetchOnWindowFocus: false, // Don't refetch on window focus for static profile data
    });
};

/**
 * Update mistri profile
 */
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

/**
 * React Query mutation hook for updating mistri profile
 */
export const useUpdateMistriProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateMistriProfileApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mistriProfile'] });
            // Also invalidate user data in auth context if needed
        },
    });
};

// ---- Complete Service Request ----
const completeServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/complete`, {
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
            queryClient.invalidateQueries({ queryKey: ['mistriJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Toggle Unpaid Status ----
const toggleUnpaidApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/toggle-unpaid`, {
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
            queryClient.invalidateQueries({ queryKey: ['mistriJobs'] });
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Accept Service Request ----
const acceptServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/accept`, {
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
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
        },
    });
};

// ---- Decline Service Request ----
const declineServiceRequestApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/decline`, {
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
            queryClient.invalidateQueries({ queryKey: ['serviceRequest', id] });
        },
    });
};

// ---- Notifications ----
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
    const response = await fetch(`${API_URL}/api/notifications`, {
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
        refetchInterval: 5000, // Poll every 5 seconds
        refetchOnWindowFocus: true,
    });
};

const markNotificationAsReadApi = async (id: string): Promise<void> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
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
    const response = await fetch(`${API_URL}/api/notifications/read-all`, {
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

// ========================================
// PLATFORM SERVICES
// ========================================

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

/**
 * Fetch all platform services grouped by category
 */
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

/**
 * React Query hook to get platform services
 */
export const usePlatformServicesQuery = () => {
    return useQuery({
        queryKey: ['platformServices'],
        queryFn: fetchPlatformServices,
        staleTime: 10 * 60 * 1000, // 10 minutes - platform services don't change often
        refetchOnWindowFocus: false,
    });
};

// ========================================
// RATINGS
// ========================================

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

/**
 * Create a rating (customer only)
 */
const createRatingApi = async (ratingData: {
    serviceRequestId: string;
    rating: number;
    review?: string;
}): Promise<Rating> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/ratings`, {
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

/**
 * React Query mutation hook for creating ratings
 */
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

/**
 * Get all ratings for a mistri
 */
const fetchMistriRatings = async (mistriId: string): Promise<{
    ratings: RatingWithCustomer[];
    averageRating: number;
    totalRatings: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/ratings/mistri/${mistriId}`, {
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

/**
 * React Query hook to get mistri ratings
 */
export const useMistriRatingsQuery = (mistriId: string | null) => {
    return useQuery({
        queryKey: ['ratings', mistriId],
        queryFn: () => fetchMistriRatings(mistriId!),
        enabled: !!mistriId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Fetch ratings received by the authenticated mistri
 */
const fetchMyRatings = async (): Promise<{
    ratings: (Rating & { requestId: string; customerName: string })[];
    averageRating: number;
    totalRatings: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/ratings/my`, {
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

/**
 * React Query hook to get ratings for the authenticated mistri
 */
export const useMistriReceivedRatingsQuery = () => {
    return useQuery({
        queryKey: ['myRatings'],
        queryFn: fetchMyRatings,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

/**
 * Check if a service request has been rated
 */
const checkIfRated = async (serviceRequestId: string): Promise<{
    isRated: boolean;
    rating: Rating | null;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/ratings/check/${serviceRequestId}`, {
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

/**
 * React Query hook to check if service request is rated
 */
export const useRatingStatusQuery = (serviceRequestId: string | null) => {
    return useQuery({
        queryKey: ['ratingStatus', serviceRequestId],
        queryFn: () => checkIfRated(serviceRequestId!),
        enabled: !!serviceRequestId,
        staleTime: 5 * 60 * 1000,
    });
};

// ========================================
// EARNINGS
// ========================================

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

/**
 * Fetch earnings data for mistri
 */
const fetchEarnings = async (period: string = 'month', page: number = 1, limit: number = 20): Promise<EarningsResponse> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/earnings?period=${period}&page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch earnings');
    }
    const data = await response.json();
    return data as EarningsResponse;
};

/**
 * React Query hook to get earnings data
 */
export const useEarningsQuery = (period: string = 'month', page: number = 1, limit: number = 20) => {
    return useQuery({
        queryKey: ['earnings', period, page, limit],
        queryFn: () => fetchEarnings(period, page, limit),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: true,
    });
};

/**
 * Mark a job as paid
 */
const markJobAsPaidApi = async (id: string): Promise<{
    success: boolean;
    message: string;
    isPaid: boolean;
    paidAt?: string;
    amount?: number;
}> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(`${API_URL}/api/service-requests/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to mark job as paid');
    }
    return await response.json();
};

/**
 * React Query mutation hook for marking job as paid
 */
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