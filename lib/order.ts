// lib/types/order.ts

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