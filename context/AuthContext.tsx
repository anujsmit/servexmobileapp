import { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';
import { useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Define the shape of the user object
export interface User {
    id: string;
    phoneNumber: string;
    fullName: string;
    role?: string;
    isOnboarded?: boolean;
    approvalStatus?: string | null;
    approvalRejectionReason?: string | null;
    defaultLocation?: string | null;
    [key: string]: any;
}

// Define the auth tokens interface
export interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number; // Unix timestamp when token expires
}

// Define the context data shape
type AuthContextData = {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isTokenRefreshing: boolean;
    sendOtp: (phone: string) => Promise<void>;
    verifyOtp: (phone: string, otp: string) => Promise<User>;
    setUserRole: (role: string) => Promise<void>;
    updateProfile: (fullName: string, location?: string) => Promise<void>;
    logout: () => Promise<void>;
    getMe: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshAccessToken: () => Promise<string | null>;
};

// Create context
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// API base URL
import { API_BASE_URL as API_URL } from '../lib/config';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isTokenRefreshing, setIsTokenRefreshing] = useState<boolean>(false);

    // Get QueryClient for cache management
    const queryClient = useQueryClient();

    // Refs to prevent memory leaks
    const appStateSubscription = useRef<any>(null);
    const tokenRefreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs that mirror state — used in callbacks to avoid stale closures
    const tokenRef = useRef<string | null>(null);
    const refreshTokenRef = useRef<string | null>(null);
    const tokenExpiryRef = useRef<number | null>(null);

    // Load token and user from SecureStore on startup
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
                    // Set stored tokens and user state — also update refs so callbacks are current
                    if (storedToken) { setToken(storedToken); tokenRef.current = storedToken; }
                    if (storedRefreshToken) { setRefreshToken(storedRefreshToken); refreshTokenRef.current = storedRefreshToken; }
                    if (storedExpiry) { setTokenExpiry(Number(storedExpiry)); tokenExpiryRef.current = Number(storedExpiry); }
                    if (storedUser) setUser(JSON.parse(storedUser));

                    // Check if token is expired
                    if (storedToken && storedExpiry) {
                        const isExpired = Date.now() >= Number(storedExpiry);

                        if (isExpired && storedRefreshToken) {
                            // Token expired — refs are already set above so refreshAccessToken can read them
                            await refreshAccessToken();
                        } else if (storedToken) {
                            // Token valid, validate that user still exists
                            await validateUserExists(storedToken);
                            scheduleTokenRefresh();
                            // Register push token on app startup if logged in
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

        // Set up AppState listener to refresh token when app comes back to foreground
        // Uses refs to avoid stale closure — token/tokenExpiry state would always be null here
        const handleAppStateChange = async (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && tokenRef.current) {
                // Check if token is expired or about to expire (within 5 minutes)
                if (tokenExpiryRef.current && Date.now() >= (tokenExpiryRef.current - 5 * 60 * 1000)) {
                    await refreshAccessToken();
                } else {
                    await validateUserExists(tokenRef.current);
                }
            }
        };

        appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

        // Cleanup function
        return () => {
            isMounted = false;
            if (appStateSubscription.current) {
                appStateSubscription.current.remove();
            }
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
            }
        };
    }, []);

    // Schedule token refresh before expiration
    const scheduleTokenRefresh = useCallback(() => {
        if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
        }

        if (!tokenExpiry) return;

        // Calculate time until refresh (5 min before expiry)
        const timeUntilRefresh = Math.max(0, tokenExpiry - Date.now() - 5 * 60 * 1000);

        if (timeUntilRefresh > 0) {
            tokenRefreshTimeout.current = setTimeout(() => {
                refreshAccessToken();
            }, timeUntilRefresh);
        } else {
            // Token is already expired or about to expire
            refreshAccessToken();
        }
    }, [tokenExpiry]);

    // Validate that the user still exists in the backend
    const validateUserExists = async (authToken: string) => {
        if (!authToken) return;

        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });

            // If user not found (deleted), logout
            if (response.status === 404) {
                if (__DEV__) console.log('User account no longer exists');
                await logout();
                return;
            }

            // If token expired, attempt refresh
            // refreshAccessToken handles logout internally on definitive auth failure (401/403)
            // A null return here could mean network error — don't logout in that case
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

    // Register push notification token with backend
    const registerPushToken = async (authToken: string) => {
        if (!authToken) return;

        try {
            // Check if we're on a physical device (push notifications don't work on simulators)
            if (!Device.isDevice) {
                if (__DEV__) console.log('Push notifications only work on physical devices');
                return;
            }

            // Request notification permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                if (__DEV__) console.log('Failed to get push token! Permission not granted');
                return;
            }

            // Get the Expo push token
            const pushTokenData = await Notifications.getExpoPushTokenAsync({
                projectId: '0e6a5ebe-b7f6-46d3-8441-77faf9ba775a', // From app.json
            });

            const pushToken = pushTokenData.data;
            if (__DEV__) console.log('Push token obtained:', pushToken);

            // Register token with backend
            const response = await fetch(`${API_URL}/api/auth/register-device-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ deviceToken: pushToken }),
            });

            if (response.ok) {
                if (__DEV__) console.log('Device token registered successfully');
            } else {
                console.error('Failed to register device token:', await response.text());
            }

            // Configure Android notification channel
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

    // Send OTP to phone number
    const sendOtp = async (phone: string) => {
        await fetch(`${API_URL}/api/auth/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone }),
        });
    };

    // Refresh access token using refresh token
    const refreshAccessToken = async (): Promise<string | null> => {
        // Use ref so this works even when called before state has propagated (e.g. on startup)
        const currentRefreshToken = refreshTokenRef.current;
        if (!currentRefreshToken) return null;

        try {
            setIsTokenRefreshing(true);

            const response = await fetch(`${API_URL}/api/auth/refresh-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: currentRefreshToken }),
            });

            // Only logout on definitive auth failures — refresh token is expired/revoked
            if (response.status === 401 || response.status === 403) {
                await logout();
                return null;
            }

            // Server error or other non-auth failure — don't logout, will retry on next cycle
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const newToken = data.accessToken;
            const newRefreshToken = data.refreshToken || currentRefreshToken;
            const expiryTime = data.expiresAt || (Date.now() + 14 * 24 * 60 * 60 * 1000); // Default 14d expiry

            // Update state and refs together
            setToken(newToken); tokenRef.current = newToken;
            setRefreshToken(newRefreshToken); refreshTokenRef.current = newRefreshToken;
            setTokenExpiry(expiryTime); tokenExpiryRef.current = expiryTime;

            // Persist new tokens
            await SecureStore.setItemAsync('token', newToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
            await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));

            // Schedule next refresh
            scheduleTokenRefresh();

            return newToken;
        } catch (error) {
            // Network error (offline, dev server down, etc.) — do NOT logout
            // The user's refresh token is still valid; retry will happen on next foreground/cycle
            if (__DEV__) console.error('Token refresh failed:', error);
            return null;
        } finally {
            setIsTokenRefreshing(false);
        }
    };

    // Verify OTP and authenticate user
    const verifyOtp = async (phone: string, otp: string): Promise<User> => {
        const response = await fetch(`${API_URL}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp }),
        });

        if (!response.ok) {
            throw new Error('Failed to verify OTP');
        }

        const data = await response.json();

        // Extract tokens and expiry
        const accessToken = data.token || data.accessToken;
        const newRefreshToken = data.refreshToken;
        const expiryTime = data.expiresAt || (Date.now() + 14 * 24 * 60 * 60 * 1000); // Default 14d expiry

        // Update state and refs
        setToken(accessToken); tokenRef.current = accessToken;
        setRefreshToken(newRefreshToken); refreshTokenRef.current = newRefreshToken;
        setTokenExpiry(expiryTime); tokenExpiryRef.current = expiryTime;
        setUser(data.user);

        // Persist auth data
        await SecureStore.setItemAsync('token', accessToken);
        if (newRefreshToken) {
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        }
        await SecureStore.setItemAsync('tokenExpiry', String(expiryTime));
        await SecureStore.setItemAsync('user', JSON.stringify(data.user));

        // Schedule token refresh
        scheduleTokenRefresh();

        // Register push notification token
        registerPushToken(accessToken);

        return data.user;
    };

    // Set user role (customer or mistri)
    // Uses tokenRef.current (not token state) so it works when called immediately
    // after verifyOtp — React state updates are async but the ref is set synchronously.
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
        setUser(data.user);
        await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    };

    // Update user profile (fullName, optional location) and mark onboarding complete
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
        setUser(data.user);
        await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    };

    // Logout: clear token/user and SecureStore
    const logout = async () => {
        // Clear timeouts
        if (tokenRefreshTimeout.current) {
            clearTimeout(tokenRefreshTimeout.current);
            tokenRefreshTimeout.current = null;
        }

        // Try to invalidate token on server (best effort)
        if (token) {
            try {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                }).catch(() => { }); // Ignore errors on logout request
            } catch (e) {
                // Ignore errors during logout
            }
        }

        // Clear React Query cache to prevent data leakage between users
        queryClient.clear();

        // Clear state and refs
        setToken(null); tokenRef.current = null;
        setRefreshToken(null); refreshTokenRef.current = null;
        setTokenExpiry(null); tokenExpiryRef.current = null;
        setUser(null);

        // Clear storage
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('tokenExpiry');
        await SecureStore.deleteItemAsync('user');
    };

    // Reload current user profile (same 401 handling as validateUserExists: refresh first, then logout only if still unauthorized)
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
                if (__DEV__) console.log('User account no longer exists');
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
                    } else if (response.status === 404) {
                        await logout();
                    } else if (response.status === 401 || response.status === 403) {
                        await logout();
                    }
                }
            }
        } catch (error: any) {
            if (error?.message && !error.message.toLowerCase().includes('splash')) {
                if (__DEV__) console.error('Failed to fetch me', error);
            }
        }
    };

    // Effect for token expiry management
    useEffect(() => {
        scheduleTokenRefresh();
        return () => {
            if (tokenRefreshTimeout.current) {
                clearTimeout(tokenRefreshTimeout.current);
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
            verifyOtp,
            setUserRole,
            updateProfile,
            logout,
            getMe,
            refreshUser: getMe, // Alias for getMe
            refreshAccessToken
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);
