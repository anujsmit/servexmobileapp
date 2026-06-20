import { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export interface User {
    id: string;
    phoneNumber: string;
    fullName: string;
    role?: string;
    isOnboarded?: boolean;
    approvalStatus?: string | null;
    approvalRejectionReason?: string | null;
    defaultLocation?: string | null;
    isVerified?: boolean;
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
    message?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: User;
}

type AuthContextData = {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isTokenRefreshing: boolean;
    sendOtp: (phone: string) => Promise<void>;
    register: (payload: RegisterPayload) => Promise<void>;
    loginWithPassword: (phone: string, password: string) => Promise<LoginResponse>;
    verifyOtp: (phone: string, otp: string) => Promise<User>;
    setUserRole: (role: string) => Promise<void>;
    updateProfile: (fullName: string, location?: string) => Promise<void>;
    logout: () => Promise<void>;
    getMe: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

import { API_BASE_URL as API_URL } from '../lib/config';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isTokenRefreshing, setIsTokenRefreshing] = useState<boolean>(false);

    const queryClient = useQueryClient();
    const appStateSubscription = useRef<any>(null);
    const tokenRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const tokenExpiryRef = useRef<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadAuth = async () => {
            try {
                setIsLoading(true);
                const storedToken = await SecureStore.getItemAsync('token');
                const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
                const storedExpiry = await SecureStore.getItemAsync('tokenExpiry');
                const storedUser = await SecureStore.getItemAsync('user');

                if (isMounted) {
                    if (storedToken) { setToken(storedToken); tokenRef.current = storedToken; }
                    if (storedRefreshToken) { setRefreshToken(storedRefreshToken); refreshTokenRef.current = storedRefreshToken; }
                    if (storedExpiry) { setTokenExpiry(Number(storedExpiry)); tokenExpiryRef.current = Number(storedExpiry); }
                    if (storedUser) setUser(JSON.parse(storedUser));

                    if (storedToken && storedExpiry) {
                        const isExpired = Date.now() >= Number(storedExpiry);

                        if (isExpired && storedRefreshToken) {
                            await refreshAccessToken();
                        } else if (storedToken) {
                            await validateUserExists(storedToken);
                            scheduleTokenRefresh();
                            registerPushToken(storedToken);
                        }
                    }
                }
            } catch (error) {
                if (__DEV__) console.error('Error loading auth state:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadAuth();

        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && tokenRef.current) {
                if (tokenExpiryRef.current && Date.now() >= (tokenExpiryRef.current - 5 * 60 * 1000)) {
                    await refreshAccessToken();
                } else {
                    await validateUserExists(tokenRef.current);
                }
            }
        };

        appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            isMounted = false;
            if (appStateSubscription.current) appStateSubscription.current.remove();
            if (tokenRefreshTimeout.current) clearTimeout(tokenRefreshTimeout.current);
        };
    }, []);

    const scheduleTokenRefresh = useCallback(() => {
        if (tokenRefreshTimeout.current) clearTimeout(tokenRefreshTimeout.current);
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

    const validateUserExists = async (authToken: string) => {
        if (!authToken) return;
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (response.status === 404) {
                await logout();
                return;
            }
            if (response.status === 401) {
                await refreshAccessToken();
                return;
            }
            if (response.ok) {
                const { user } = await response.json();
                setUser(user);
                await SecureStore.setItemAsync('user', JSON.stringify(user));
            }
        } catch (error) {
            if (__DEV__) console.error('Failed to validate user exists', error);
        }
    };

    const registerPushToken = async (authToken: string) => {
        if (!authToken) return;
        try {
            if (!Device.isDevice) return;
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') return;

            const pushTokenData = await Notifications.getExpoPushTokenAsync({
                projectId: '0e6a5ebe-b7f6-46d3-8441-77faf9ba775a',
            });

            const pushToken = pushTokenData.data;
            await fetch(`${API_URL}/api/auth/register-device-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ deviceToken: pushToken }),
            });

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }
        } catch (error) {
            if (__DEV__) console.error('Error registering push token:', error);
        }
    };

    // FIXED: Register using /api/auth/register endpoint
    const register = async (payload: RegisterPayload) => {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Store token if returned
        if (data.accessToken) {
            const accessToken = data.accessToken;
            const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

            setToken(accessToken);
            tokenRef.current = accessToken;
            setTokenExpiry(expiryTime);
            tokenExpiryRef.current = expiryTime;
            setUser(data.user);

            await SecureStore.setItemAsync('token', accessToken);
            await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));
            await SecureStore.setItemAsync('user', JSON.stringify(data.user));

            scheduleTokenRefresh();
            registerPushToken(accessToken);
        }
    };

    // FIXED: Login endpoint
    const loginWithPassword = async (phone: string, password: string): Promise<LoginResponse> => {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
        });

        const data = await response.json();

        // Handle case where account exists but is unverified
        if (response.status === 403 && data.isVerified === false) {
            return { isVerified: false, message: data.message };
        }

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Handle fully authenticated user response
        const accessToken = data.accessToken;
        const newRefreshToken = data.refreshToken;
        const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

        setToken(accessToken);
        tokenRef.current = accessToken;
        setRefreshToken(newRefreshToken);
        refreshTokenRef.current = newRefreshToken;
        setTokenExpiry(expiryTime);
        tokenExpiryRef.current = expiryTime;
        setUser(data.user);

        await SecureStore.setItemAsync('token', accessToken);
        if (newRefreshToken) await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));
        await SecureStore.setItemAsync('user', JSON.stringify(data.user));

        scheduleTokenRefresh();
        registerPushToken(accessToken);

        return { isVerified: true, user: data.user, accessToken };
    };

    const sendOtp = async (phone: string) => {
        const response = await fetch(`${API_URL}/api/auth/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
        if (!response.ok) throw new Error('Failed to send OTP');
    };

    const refreshAccessToken = async (): Promise<string | null> => {
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return null;

        try {
            setIsTokenRefreshing(true);
            const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: currentRefreshToken }),
            });

            if (response.status === 401 || response.status === 403) {
                await logout();
                return null;
            }

            if (!response.ok) return null;

            const data = await response.json();
            const newToken = data.accessToken;
            const newRefreshToken = data.refreshToken || currentRefreshToken;
            const expiryTime = data.expiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

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

    const verifyOtp = async (phone: string, otp: string): Promise<User> => {
        const response = await fetch(`${API_URL}/api/auth/verify-phone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to verify OTP');
        }

        // Update user as verified
        if (data.user) {
            setUser(data.user);
            await SecureStore.setItemAsync('user', JSON.stringify(data.user));
        }

        return data.user;
    };

    const setUserRole = async (role: string) => {
        if (!tokenRef.current) throw new Error('Not authenticated');
        const response = await fetch(`${API_URL}/api/auth/role`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenRef.current}`,
            },
            body: JSON.stringify({ role }),
        });
        const data = await response.json();
        if (data.user) {
            setUser(data.user);
            await SecureStore.setItemAsync('user', JSON.stringify(data.user));
        }
    };

    const updateProfile = async (fullName: string, location?: string) => {
        if (!token) throw new Error('Not authenticated');
        const body: Record<string, string> = { fullName };
        if (location) body.location = location;
        const response = await fetch(`${API_URL}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (data.user) {
            setUser(data.user);
            await SecureStore.setItemAsync('user', JSON.stringify(data.user));
        }
    };

    const logout = async () => {
        if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
            tokenRefreshTimeout.current = null;
        }
        if (token) {
            try {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
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

        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('tokenExpiry');
        await SecureStore.deleteItemAsync('user');
    };

    const getMe = async () => {
        const authToken = tokenRef.current ?? token;
        if (!authToken) return;

        const fetchMe = (bearer: string) =>
            fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${bearer}` },
            });

        try {
            let response = await fetchMe(authToken);
            if (response.status === 404) {
                await logout();
                return;
            }
            if (response.ok) {
                const { user } = await response.json();
                setUser(user);
                await SecureStore.setItemAsync('user', JSON.stringify(user));
                return;
            }
            if (response.status === 401 || response.status === 403) {
                const newToken = await refreshAccessToken();
                if (!tokenRef.current) return;
                if (newToken) {
                    response = await fetchMe(newToken);
                    if (response.ok) {
                        const { user } = await response.json();
                        setUser(user);
                        await SecureStore.setItemAsync('user', JSON.stringify(user));
                    } else if (response.status === 404 || response.status === 401 || response.status === 403) {
                        await logout();
                    }
                }
            }
        } catch (error: any) {
            if (__DEV__) console.error('Failed to fetch me', error);
        }
    };

    useEffect(() => {
        scheduleTokenRefresh();
        return () => {
            if (tokenRefreshTimeout.current) clearTimeout(tokenRefreshTimeout.current);
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
            refreshUser: getMe,
            refreshAccessToken
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);