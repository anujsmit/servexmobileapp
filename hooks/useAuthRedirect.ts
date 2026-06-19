import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../lib/routes';

export function useAuthRedirect() {
    const { user, token, isLoading, isTokenRefreshing, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Don't redirect while loading or refreshing
        if (isLoading || isTokenRefreshing) return;

        // No token - stay on landing page (index.tsx), no redirect needed
        if (!token) return;

        // User has a token but no role — invalid state, log out and return to landing
        if (user && !user.role) {
            logout();
            return;
        }

        // User has role but not onboarded - redirect to onboarding
        if (user && user.role && !user.isOnboarded) {
            const onboardingRoute = user.role === 'mistri'
                ? ROUTES.ONBOARDING.MISTRI
                : ROUTES.ONBOARDING.CUSTOMER;
            router.replace(onboardingRoute);
            return;
        }

        // User is fully onboarded - redirect to appropriate dashboard
        if (user && user.role && user.isOnboarded) {
            const dashboardRoute = user.role === 'mistri'
                ? ROUTES.MISTRI.HOME
                : ROUTES.CUSTOMER.HOME;
            router.replace(dashboardRoute);
            return;
        }
    }, [user, token, isLoading, isTokenRefreshing, router]);

    return { isRedirecting: isLoading || isTokenRefreshing };
}
