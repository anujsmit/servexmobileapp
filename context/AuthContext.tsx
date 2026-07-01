// context/AuthContext.tsx

import { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

export interface User {
    id: string;
    phoneNumber: string;
    fullName: string;
    role?: string;
    accountType?: string;
    isOnboarded?: boolean;
    approvalStatus?: string | null;
    approvalRejectionReason?: string | null;
    defaultLocation?: string | null;
    isVerified?: boolean;
    isActive?: boolean;
    deletionScheduledAt?: string | null;
    hasScheduledDeletion?: boolean;
    [key: string]: any;
}

export interface RegisterPayload {
    phone: string;
    fullName: string;
    password: string;
    role: 'user' | 'mistri';
    dob?: string;
}

export interface LoginResponse {
    success?: boolean;
    isVerified?: boolean;
    requiresVerification?: boolean;
    phone?: string;
    message?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: User;
    requiresDeletionAction?: boolean;
    deletionScheduledAt?: string | null;
}

type AuthContextData = {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isTokenRefreshing: boolean;
    sendOtp: (phone: string, role?: 'user' | 'mistri') => Promise<void>;
    register: (payload: RegisterPayload) => Promise<void>;
    loginWithPassword: (phone: string, password: string, role?: 'user' | 'mistri') => Promise<LoginResponse>;
    verifyOtp: (phone: string, otp: string, role?: 'user' | 'mistri') => Promise<User>;
    setUserRole: (role: string) => Promise<void>;
    updateProfile: (fullName: string, location?: string, avatarUrl?: string, isOnboarded?: boolean) => Promise<void>;
    logout: () => Promise<void>;
    getMe: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshAccessToken: () => Promise<string | null>;
    cancelDeletion: () => Promise<void>;
    getDeletionStatus: () => Promise<{ deletionScheduledAt: string | null } | null>;
    getRole: () => 'user' | 'mistri' | null;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

import { API_BASE_URL as API_URL } from '../lib/config';

// ============================================
// HELPER: Get the correct API path based on role
// ============================================
const getAuthPath = (role: 'user' | 'mistri' = 'user'): string => {
    return role === 'mistri' ? '/api/mistri/auth' : '/api/users/auth';
};

// Check if running in Expo Go
const isExpoGo = (): boolean => {
    try {
        return Constants?.expoConfig?.hostUri !== undefined;
    } catch {
        return true;
    }
};

// FIXED: Disable auto-registration in Expo Go
if (isExpoGo()) {
    try {
        const Notifications = require('expo-notifications');
        if (Notifications.default?.setAutoRegistrationEnabled) {
            Notifications.default.setAutoRegistrationEnabled(false);
        }
    } catch (e) {
        // Module might not be available, that's fine
    }
}

// Get project ID from config
const getProjectId = (): string | undefined => {
    try {
        const config = Constants?.expoConfig;
        const manifest = Constants?.manifest;

        const projectId = config?.extra?.eas?.projectId ||
            manifest?.extra?.eas?.projectId ||
            config?.projectId ||
            manifest?.projectId;

        return projectId;
    } catch (error) {
        if (__DEV__) console.error('Error getting project ID:', error);
        return undefined;
    }
};

// Lazy load notifications only when needed
const getNotifications = async () => {
    if (isExpoGo()) {
        if (__DEV__) console.log('Skipping expo-notifications import in Expo Go');
        return null;
    }

    try {
        const notifications = await import('expo-notifications');
        return notifications;
    } catch (error) {
        if (__DEV__) console.error('Failed to load expo-notifications:', error);
        return null;
    }
};

// Lazy load Device module
const getDevice = async () => {
    try {
        const device = await import('expo-device');
        return device;
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isTokenRefreshing, setIsTokenRefreshing] = useState<boolean>(false);
    const [userRole, setUserRoleState] = useState<'user' | 'mistri' | null>(null);

    const queryClient = useQueryClient();
    const appStateSubscription = useRef<any>(null);
    const tokenRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const tokenExpiryRef = useRef<number | null>(null);
    const roleRef = useRef<'user' | 'mistri' | null>(null);

    // ============================================
    // RESTORE AUTH STATE - FIXED
    // ============================================
    const restoreAuthState = useCallback(async () => {
        try {
            console.log('🔐 Restoring auth state...');

            // Get all stored values
            const storedToken = await SecureStore.getItemAsync('token');
            const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
            const storedExpiry = await SecureStore.getItemAsync('tokenExpiry');
            const storedUser = await SecureStore.getItemAsync('user');
            const storedRole = await SecureStore.getItemAsync('userRole');

            console.log('🔐 Stored token exists:', !!storedToken);
            console.log('🔐 Stored user exists:', !!storedUser);
            console.log('🔐 Stored expiry:', storedExpiry);

            // If no token and no user, we're done - no auth state to restore
            if (!storedToken && !storedUser) {
                console.log('🔐 No stored auth found');
                setIsLoading(false);
                return;
            }

            // Set the token first
            if (storedToken) {
                setToken(storedToken);
                tokenRef.current = storedToken;
            }

            if (storedRefreshToken) {
                setRefreshToken(storedRefreshToken);
                refreshTokenRef.current = storedRefreshToken;
            }

            if (storedExpiry) {
                const expiryNum = Number(storedExpiry);
                setTokenExpiry(expiryNum);
                tokenExpiryRef.current = expiryNum;
            }

            if (storedRole) {
                const role = storedRole as 'user' | 'mistri';
                setUserRoleState(role);
                roleRef.current = role;
            }

            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    if (!storedRole && parsedUser.role) {
                        const role = parsedUser.role === 'mistri' ? 'mistri' : 'user';
                        setUserRoleState(role);
                        roleRef.current = role;
                    }
                } catch (e) {
                    console.error('Failed to parse stored user:', e);
                }
            }

            // Check if token is valid and not expired
            if (storedToken && storedExpiry) {
                const isExpired = Date.now() >= Number(storedExpiry);
                console.log('🔐 Token expired:', isExpired);

                if (isExpired && storedRefreshToken) {
                    console.log('🔐 Token expired, refreshing...');
                    const newToken = await refreshAccessToken();
                    if (!newToken) {
                        // If refresh fails, clear auth
                        console.log('🔐 Refresh failed, clearing auth');
                        await logout();
                    }
                } else if (storedToken && !isExpired) {
                    console.log('🔐 Token valid, validating user...');
                    await validateUserExists(storedToken);
                    scheduleTokenRefresh();
                    if (!isExpoGo() && getProjectId()) {
                        registerPushToken(storedToken);
                    }
                }
            }

            setIsLoading(false);
            console.log('🔐 Auth restore complete');

        } catch (error) {
            console.error('Error restoring auth state:', error);
            // On error, clear auth state to be safe
            await logout();
            setIsLoading(false);
        }
    }, []);

    // ============================================
    // VALIDATE USER EXISTS
    // ============================================
// context/AuthContext.tsx

// ============================================
// VALIDATE USER EXISTS - FIXED
// ============================================
const validateUserExists = async (authToken: string) => {
    if (!authToken) return;
    const role = roleRef.current || 'user';
    const path = getAuthPath(role);
    const url = `${API_URL}${path}/profile`;

    try {
        console.log(`👤 Validating user at: ${url}`);
        
        const response = await fetch(url, {
            headers: { 
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`👤 Validation response status: ${response.status}`);

        // ✅ Only logout on 404 (user deleted)
        if (response.status === 404) {
            console.log('👤 User not found, logging out...');
            await logout();
            return;
        }

        // ✅ On 401/403, try to refresh the token
        if (response.status === 401 || response.status === 403) {
            console.log('👤 Token invalid, attempting refresh...');
            const newToken = await refreshAccessToken();
            if (!newToken) {
                console.log('👤 Refresh failed, logging out...');
                await logout();
                return;
            }
            // ✅ If refresh succeeded, retry validation with new token
            const retryResponse = await fetch(url, {
                headers: { 
                    Authorization: `Bearer ${newToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (retryResponse.ok) {
                const data = await retryResponse.json();
                const userData = data.user || data;
                userData.role = role;
                setUser(userData);
                await SecureStore.setItemAsync('user', JSON.stringify(userData));
                console.log('👤 User validated after refresh');
                return;
            } else {
                console.log('👤 Validation failed after refresh, logging out');
                await logout();
                return;
            }
        }

        // ✅ On success, update user data
        if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            userData.role = role;
            setUser(userData);
            await SecureStore.setItemAsync('user', JSON.stringify(userData));
            console.log('👤 User validated successfully');
            return;
        }

        // ✅ For other errors (500, etc.), don't logout - just log and continue
        console.log(`👤 Validation returned non-critical status: ${response.status}`);
        // Keep the existing user data

    } catch (error) {
        // ✅ Network errors or timeouts - don't logout
        console.error('👤 Error validating user:', error);
        // Keep the existing user data and don't logout
    }
};

    // ============================================
    // REGISTER PUSH TOKEN
    // ============================================
    const registerPushToken = async (authToken: string) => {
        if (!authToken) return;

        if (isExpoGo()) {
            if (__DEV__) console.log('Skipping push notification registration in Expo Go');
            return;
        }

        try {
            const notifications = await getNotifications();
            if (!notifications) {
                if (__DEV__) console.log('Notifications module not available');
                return;
            }

            const device = await getDevice();
            if (!device) {
                if (__DEV__) console.log('Device module not available');
                return;
            }

            if (!device.default.isDevice) {
                if (__DEV__) console.log('Push notifications only work on physical devices');
                return;
            }

            const projectId = getProjectId();
            if (!projectId) {
                if (__DEV__) console.warn('No project ID found for push notifications');
                return;
            }

            if (__DEV__) console.log('Using project ID for notifications:', projectId);

            const { status: existingStatus } = await notifications.default.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await notifications.default.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                if (__DEV__) console.log('Push notification permissions denied');
                return;
            }

            let pushTokenData;
            try {
                pushTokenData = await notifications.default.getExpoPushTokenAsync({
                    projectId: projectId,
                });
            } catch (error) {
                if (__DEV__) console.error('Error getting Expo push token:', error);
                return;
            }

            const pushToken = pushTokenData?.data || pushTokenData?.token;
            if (!pushToken) {
                if (__DEV__) console.error('No push token received');
                return;
            }

            if (__DEV__) console.log('Push token received:', pushToken);

            await fetch(`${API_URL}/api/auth/register-device-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ deviceToken: pushToken }),
            });

            if (Platform.OS === 'android') {
                await notifications.default.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: notifications.default.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        } catch (error) {
            if (__DEV__) console.error('Error registering push token:', error);
        }
    };

    // ============================================
    // SCHEDULE TOKEN REFRESH
    // ============================================
    const scheduleTokenRefresh = useCallback(() => {
        if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
            tokenRefreshTimeout.current = null;
        }
        if (!tokenExpiry) return;

        const timeUntilRefresh = Math.max(0, tokenExpiry - Date.now() - 5 * 60 * 1000);

        if (timeUntilRefresh > 0) {
            tokenRefreshTimeout.current = setTimeout(() => {
                refreshAccessToken();
            }, timeUntilRefresh);
        } else {
            refreshAccessToken();
        }
    }, [tokenExpiry]);

    // ============================================
    // REGISTER
    // ============================================
    const register = async (payload: RegisterPayload) => {
        const role = payload.role || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/register`;

        console.log('🔍 Register URL:', url);
        console.log('🔍 Role:', role);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: payload.phone,
                fullName: payload.fullName,
                password: payload.password,
                dob: payload.dob || undefined,
            }),
        });

        const data = await response.json();
        console.log('🔍 Register Response Status:', response.status);

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Store the role
        setUserRoleState(role);
        roleRef.current = role;
        await SecureStore.setItemAsync('userRole', role);

        if (data.accessToken) {
            const accessToken = data.accessToken;
            const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

            setToken(accessToken);
            tokenRef.current = accessToken;
            setTokenExpiry(expiryTime);
            tokenExpiryRef.current = expiryTime;

            const userData = data.user || data;
            userData.role = role;
            setUser(userData);

            await SecureStore.setItemAsync('token', accessToken);
            await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));
            await SecureStore.setItemAsync('user', JSON.stringify(userData));

            if (data.refreshToken) {
                setRefreshToken(data.refreshToken);
                refreshTokenRef.current = data.refreshToken;
                await SecureStore.setItemAsync('refreshToken', data.refreshToken);
            }

            scheduleTokenRefresh();

            if (!isExpoGo() && getProjectId()) {
                registerPushToken(accessToken);
            }
        }
    };

    // ============================================
    // LOGIN WITH PASSWORD
    // ============================================
    const loginWithPassword = async (phone: string, password: string, role: 'user' | 'mistri' = 'user'): Promise<LoginResponse> => {
        try {
            const path = getAuthPath(role);
            const url = `${API_URL}${path}/login`;

            console.log('🔍 === LOGIN DEBUG ===');
            console.log('🔍 API_URL:', API_URL);
            console.log('🔍 Role:', role);
            console.log('🔍 Path:', path);
            console.log('🔍 Full URL:', url);
            console.log('🔍 Phone:', phone);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password }),
            });

            // Check if response is HTML (error page)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                console.error('❌ Received HTML instead of JSON:', text.substring(0, 200));
                throw new Error(`Server returned HTML (${response.status}). The endpoint ${url} may not exist.`);
            }

            // Parse the response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Failed to parse JSON:', parseError);
                const text = await response.text();
                console.error('❌ Raw response:', text);
                throw new Error('Invalid response from server');
            }

            console.log('🔍 Login Response Status:', response.status);
            console.log('🔍 Login Response Data:', data);

            // Handle rate limiting (429)
            if (response.status === 429) {
                throw new Error('429: Too many login attempts. Please wait a few minutes.');
            }

            // Handle verification required
            if (response.status === 403 && data?.isVerified === false) {
                return {
                    isVerified: false,
                    requiresVerification: true,
                    phone: data.phone || phone,
                    message: data.message || 'Please verify your phone number',
                    user: data.user,
                };
            }

            if (!response.ok) {
                const errorMessage = data?.message || data?.error || 'Login failed';
                throw new Error(errorMessage);
            }

            // The response might have the user data directly or nested in a 'user' property
            const userData = data?.user || data;

            if (!userData || typeof userData !== 'object') {
                console.error('❌ Invalid user data received:', userData);
                throw new Error('Invalid user data received from server');
            }

            // Ensure we have the user ID
            if (!userData.id) {
                console.error('❌ User data missing ID:', userData);
                throw new Error('User data missing ID');
            }

            const accessToken = data?.accessToken;
            const newRefreshToken = data?.refreshToken;
            const expiryTime = data?.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

            if (!accessToken) {
                console.error('❌ No access token in response:', data);
                throw new Error('No access token received');
            }

            // Store the role
            userData.role = role;
            setUserRoleState(role);
            roleRef.current = role;
            await SecureStore.setItemAsync('userRole', role);

            setToken(accessToken);
            tokenRef.current = accessToken;
            setRefreshToken(newRefreshToken);
            refreshTokenRef.current = newRefreshToken;
            setTokenExpiry(expiryTime);
            tokenExpiryRef.current = expiryTime;

            setUser(userData);

            await SecureStore.setItemAsync('token', accessToken);
            if (newRefreshToken) await SecureStore.setItemAsync('refreshToken', newRefreshToken);
            await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));
            await SecureStore.setItemAsync('user', JSON.stringify(userData));

            scheduleTokenRefresh();

            if (!isExpoGo() && getProjectId()) {
                registerPushToken(accessToken);
            }

            return {
                isVerified: true,
                user: userData,
                accessToken,
                refreshToken: newRefreshToken,
                requiresDeletionAction: data?.requiresDeletionAction || false,
                deletionScheduledAt: data?.deletionScheduledAt || null,
            };
        } catch (error: any) {
            console.error('❌ Login error:', error);
            throw new Error(error.message || 'Login failed. Please try again.');
        }
    };

    // ============================================
    // SEND OTP
    // ============================================
    const sendOtp = async (phone: string, role: 'user' | 'mistri' = 'user') => {
        try {
            const path = getAuthPath(role);
            const endpoint = '/resend-otp';
            const url = `${API_URL}${path}${endpoint}`;

            console.log('🔍 Send OTP URL:', url);
            console.log('🔍 Role:', role);
            console.log('🔍 Phone:', phone);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                console.error('❌ Received HTML instead of JSON:', text.substring(0, 200));
                throw new Error(`Server returned HTML (${response.status}). The endpoint ${url} may not exist.`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Failed to parse JSON:', parseError);
                const text = await response.text();
                console.error('❌ Raw response:', text);
                throw new Error('Invalid response from server');
            }

            console.log('🔍 Send OTP Response Status:', response.status);
            console.log('🔍 Send OTP Response:', data);

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to send OTP');
            }
        } catch (error: any) {
            console.error('❌ Send OTP error:', error);
            throw new Error(error.message || 'Failed to send OTP. Please try again.');
        }
    };

    // ============================================
    // VERIFY OTP
    // ============================================
    const verifyOtp = async (phone: string, otp: string, role: 'user' | 'mistri' = 'user'): Promise<User> => {
        try {
            const path = getAuthPath(role);
            const endpoint = role === 'mistri' ? '/otp/verify' : '/verify-otp';
            const url = `${API_URL}${path}${endpoint}`;

            console.log('🔍 Verify OTP URL:', url);
            console.log('🔍 Role:', role);
            console.log('🔍 Phone:', phone);
            console.log('🔍 OTP:', otp);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp }),
            });

            // Check if response is HTML (error page)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                const text = await response.text();
                console.error('❌ Received HTML instead of JSON:', text.substring(0, 200));
                throw new Error(`Server returned HTML (${response.status}). The endpoint ${url} may not exist.`);
            }

            // Parse the response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Failed to parse JSON:', parseError);
                const text = await response.text();
                console.error('❌ Raw response:', text);
                throw new Error('Invalid response from server');
            }

            console.log('🔍 Verify OTP Response Status:', response.status);
            console.log('🔍 Verify OTP Response Data:', data);

            if (!response.ok) {
                const errorMessage = data?.message || data?.error || 'Failed to verify OTP';
                throw new Error(errorMessage);
            }

            const userData = data?.user || data;

            if (!userData || typeof userData !== 'object') {
                console.error('❌ Invalid user data received:', userData);
                throw new Error('Invalid user data received from server');
            }

            if (!userData.id) {
                console.error('❌ User data missing ID:', userData);
                throw new Error('User data missing ID');
            }

            userData.role = role;

            setUser(userData);
            setUserRoleState(role);
            roleRef.current = role;

            await SecureStore.setItemAsync('user', JSON.stringify(userData));
            await SecureStore.setItemAsync('userRole', role);

            if (data?.accessToken) {
                const accessToken = data.accessToken;
                const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

                setToken(accessToken);
                tokenRef.current = accessToken;
                setTokenExpiry(expiryTime);
                tokenExpiryRef.current = expiryTime;

                await SecureStore.setItemAsync('token', accessToken);
                await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));

                if (data.refreshToken) {
                    setRefreshToken(data.refreshToken);
                    refreshTokenRef.current = data.refreshToken;
                    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
                }

                scheduleTokenRefresh();
            }

            return userData;
        } catch (error: any) {
            console.error('❌ Verify OTP error:', error);
            throw new Error(error.message || 'Failed to verify OTP. Please try again.');
        }
    };

    // ============================================
    // SET USER ROLE
    // ============================================
    const setUserRole = async (role: string) => {
        if (!tokenRef.current) throw new Error('Not authenticated');
        const roleType = role === 'mistri' ? 'mistri' : 'user';
        const path = getAuthPath(roleType);
        const url = `${API_URL}${path}/role`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenRef.current}`,
                },
                body: JSON.stringify({ role }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to set user role');
            }
            if (data.user) {
                data.user.role = roleType;
                setUser(data.user);
                setUserRoleState(roleType);
                roleRef.current = roleType;
                await SecureStore.setItemAsync('user', JSON.stringify(data.user));
                await SecureStore.setItemAsync('userRole', roleType);
            }
        } catch (error: any) {
            console.error('Set user role error:', error);
            throw new Error(error.message || 'Failed to set user role');
        }
    };

    // ============================================
    // UPDATE PROFILE
    // ============================================
    const updateProfile = async (fullName: string, location?: string, avatarUrl?: string, isOnboarded?: boolean) => {
        if (!token) throw new Error('Not authenticated');
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/profile`;

        try {
            const body: Record<string, string | boolean> = { fullName };
            if (location !== undefined) body.location = location;
            if (avatarUrl !== undefined) body.avatarUrl = avatarUrl;
            if (isOnboarded !== undefined) body.isOnboarded = isOnboarded;

            console.log('📤 Updating profile:', body);

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            
            const data = await response.json();
            console.log('📥 Profile update response:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update profile');
            }
            if (data.user) {
                data.user.role = role;
                setUser(data.user);
                await SecureStore.setItemAsync('user', JSON.stringify(data.user));
            }
        } catch (error: any) {
            console.error('Update profile error:', error);
            throw new Error(error.message || 'Failed to update profile');
        }
    };

    // ============================================
    // CANCEL DELETION
    // ============================================
    const cancelDeletion = async (): Promise<void> => {
        const authToken = tokenRef.current || token;
        if (!authToken) throw new Error('Not authenticated');
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/cancel-deletion`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to cancel deletion');
            }

            const data = await response.json();

            if (user) {
                const updatedUser = {
                    ...user,
                    deletionScheduledAt: null,
                    hasScheduledDeletion: false,
                };
                setUser(updatedUser);
                await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
            }

            return data;
        } catch (error) {
            console.error('Error cancelling deletion:', error);
            throw error;
        }
    };

    // ============================================
    // GET DELETION STATUS
    // ============================================
    const getDeletionStatus = async (): Promise<{ deletionScheduledAt: string | null } | null> => {
        const authToken = tokenRef.current || token;
        if (!authToken) return null;
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/deletion-status`;

        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting deletion status:', error);
            return null;
        }
    };

    // ============================================
    // REFRESH ACCESS TOKEN
    // ============================================
    const refreshAccessToken = async (): Promise<string | null> => {
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return null;
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/refresh-token`;

        try {
            setIsTokenRefreshing(true);
            console.log('🔄 Refreshing token...');

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: currentRefreshToken }),
            });

            if (response.status === 401 || response.status === 403) {
                console.log('🔄 Refresh token invalid, logging out...');
                await logout();
                return null;
            }

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to refresh token');
            }

            const data = await response.json();
            const newToken = data.accessToken;
            const newRefreshToken = data.refreshToken || currentRefreshToken;
            const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

            console.log('🔄 Token refreshed successfully');

            setToken(newToken);
            tokenRef.current = newToken;
            setRefreshToken(newRefreshToken);
            refreshTokenRef.current = newRefreshToken;
            setTokenExpiry(expiryTime);
            tokenExpiryRef.current = expiryTime;

            await SecureStore.setItemAsync('token', newToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
            await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));

            scheduleTokenRefresh();
            return newToken;
        } catch (error) {
            if (__DEV__) console.error('Token refresh failed:', error);
            return null;
        } finally {
            setIsTokenRefreshing(false);
        }
    };

    // ============================================
    // GET ME / REFRESH USER
    // ============================================
    const getMe = async () => {
        const authToken = tokenRef.current ?? token;
        if (!authToken) return;
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/profile`;

        const fetchMe = (bearer: string) =>
            fetch(url, {
                headers: { Authorization: `Bearer ${bearer}` },
            });

        try {
            let response = await fetchMe(authToken);
            if (response.status === 404) {
                await logout();
                return;
            }
            if (response.ok) {
                const data = await response.json();
                const userData = data.user || data;
                userData.role = role;
                setUser(userData);
                await SecureStore.setItemAsync('user', JSON.stringify(userData));
                return;
            }
            if (response.status === 401 || response.status === 403) {
                const newToken = await refreshAccessToken();
                if (!newToken) {
                    await logout();
                    return;
                }
                response = await fetchMe(newToken);
                if (response.ok) {
                    const data = await response.json();
                    const userData = data.user || data;
                    userData.role = role;
                    setUser(userData);
                    await SecureStore.setItemAsync('user', JSON.stringify(userData));
                } else if (response.status === 404 || response.status === 401 || response.status === 403) {
                    await logout();
                }
            }
        } catch (error: any) {
            if (__DEV__) console.error('Failed to fetch me', error);
        }
    };

    const refreshUser = async () => {
        await getMe();
    };

    // ============================================
    // GET ROLE
    // ============================================
    const getRole = (): 'user' | 'mistri' | null => {
        return roleRef.current;
    };

    // ============================================
    // LOGOUT
    // ============================================
    const logout = async () => {
        console.log('🚪 Logging out...');

        if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
            tokenRefreshTimeout.current = null;
        }

        const authToken = token;
        const role = roleRef.current || 'user';
        const path = getAuthPath(role);
        const url = `${API_URL}${path}/logout`;

        if (authToken) {
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authToken}`
                    },
                }).catch(() => { });
            } catch (e) { }
        }

        queryClient.clear();
        setToken(null);
        tokenRef.current = null;
        setRefreshToken(null);
        refreshTokenRef.current = null;
        setTokenExpiry(null);
        tokenExpiryRef.current = null;
        setUser(null);
        setUserRoleState(null);
        roleRef.current = null;

        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('tokenExpiry');
        await SecureStore.deleteItemAsync('user');
        await SecureStore.deleteItemAsync('userRole');

        // ✅ Ensure loading is false after logout
        setIsLoading(false);
    };

    // ============================================
    // APP STATE HANDLER
    // ============================================
    useEffect(() => {
        // Load auth on mount
        restoreAuthState();

        // Handle app state changes
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && tokenRef.current) {
                console.log('📱 App became active, checking token...');
                if (tokenExpiryRef.current && Date.now() >= (tokenExpiryRef.current - 5 * 60 * 1000)) {
                    console.log('📱 Token near expiry, refreshing...');
                    await refreshAccessToken();
                } else if (tokenRef.current) {
                    try {
                        const role = roleRef.current || 'user';
                        const path = getAuthPath(role);
                        const response = await fetch(`${API_URL}${path}/profile`, {
                            headers: { Authorization: `Bearer ${tokenRef.current}` },
                        });

                        if (response.status === 401) {
                            console.log('📱 Token invalid on app resume, refreshing...');
                            await refreshAccessToken();
                        }
                    } catch (error) {
                        console.log('📱 Error validating user on app resume:', error);
                    }
                }
            }
        };

        appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            if (appStateSubscription.current) {
                appStateSubscription.current.remove();
            }
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
                tokenRefreshTimeout.current = null;
            }
        };
    }, []);

    // ============================================
    // SCHEDULE TOKEN REFRESH ON EXPIRY CHANGE
    // ============================================
    useEffect(() => {
        scheduleTokenRefresh();
        return () => {
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
                tokenRefreshTimeout.current = null;
            }
        };
    }, [tokenExpiry, scheduleTokenRefresh]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            isTokenRefreshing,
            sendOtp,
            register,
            loginWithPassword,
            verifyOtp,
            setUserRole,
            updateProfile,
            logout,
            getMe,
            refreshUser,
            refreshAccessToken,
            cancelDeletion,
            getDeletionStatus,
            getRole,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};