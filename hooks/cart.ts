// hooks/queries/cart.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../lib/config';

export interface CartItem {
    id: string;
    serviceItemId: string;
    quantity: number;
    name: string;
    description: string | null;
    price: number;
    subtotal: number;
    durationMinutes: number | null;
    imageUrl: string | null;
    isPopular: boolean;
    isActive: boolean;
    displayOrder: number;
    subCategoryId: string;
    categoryId: number;
    categoryName: string;
    addedAt: string;
    updatedAt: string;
}

export interface Cart {
    id: string;
    items: CartItem[];
    itemCount: number;
    subtotal: number;
    isEmpty: boolean;
}

// Fetch cart
const fetchCart = async (): Promise<Cart> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/users/cart`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch cart');
    }

    const data = await response.json();
    return data.cart;
};

export const useCartQuery = () => {
    return useQuery({
        queryKey: ['cart'],
        queryFn: fetchCart,
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
    });
};

// Add to cart
const addToCartApi = async (serviceItemId: string, quantity: number = 1) => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/users/cart/add`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ serviceItemId, quantity }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add to cart');
    }

    return await response.json();
};

export const useAddToCart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ serviceItemId, quantity }: { serviceItemId: string; quantity?: number }) =>
            addToCartApi(serviceItemId, quantity || 1),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            queryClient.invalidateQueries({ queryKey: ['cartCount'] });
        },
    });
};

// Update cart item
const updateCartItemApi = async (itemId: string, quantity: number) => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/users/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update cart');
    }

    return await response.json();
};

export const useUpdateCartItem = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
            updateCartItemApi(itemId, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            queryClient.invalidateQueries({ queryKey: ['cartCount'] });
        },
    });
};

// Remove from cart
const removeFromCartApi = async (itemId: string) => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/users/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove from cart');
    }

    return await response.json();
};

export const useRemoveFromCart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (itemId: string) => removeFromCartApi(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            queryClient.invalidateQueries({ queryKey: ['cartCount'] });
        },
    });
};

// Clear cart
const clearCartApi = async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/cart/clear`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to clear cart');
    }

    return await response.json();
};

export const useClearCart = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clearCartApi,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            queryClient.invalidateQueries({ queryKey: ['cartCount'] });
        },
    });
};

// Get cart count
const fetchCartCount = async (): Promise<number> => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/cart/count`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch cart count');
    }

    const data = await response.json();
    return data.count || 0;
};

export const useCartCount = () => {
    return useQuery({
        queryKey: ['cartCount'],
        queryFn: fetchCartCount,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
    });
};