import React, { memo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Redirect, useSegments } from 'expo-router';
import { ROUTES } from '../lib/routes';

export type AuthGuardProps = {
    children: React.ReactNode;
    requireAuth?: boolean;
    requireOnboarding?: boolean;
};

/**
 * Unified AuthGuard component that handles all authentication and authorization logic.
 *
 * Guards enforced (in order):
 *  1. Loading — wait for auth state to settle
 *  2. Token required — redirect unauthenticated users to login
 *  3. Role required — redirect to login if role is null (safety net, shouldn't happen)
 *  4. Onboarding required — redirect to role-specific onboarding if not completed
 *  5. Approval required (mistri only) — redirect to pending-approval if not approved
 *  6. Cross-role guard — prevent a customer from accessing mistri routes and vice versa
 */
export const AuthGuard = memo(({
    children,
    requireAuth = true,
    requireOnboarding = true,
}: AuthGuardProps) => {
    const { token, user, isLoading, isTokenRefreshing } = useAuth();
    const segments = useSegments();

    // Show loading while authentication state is being determined
    if (isLoading || isTokenRefreshing || (token && !user)) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    // 2. Authentication check
    if (requireAuth && !token) {
        return <Redirect href={ROUTES.LOGIN} />;
    }

    // 3. Safety net — user authenticated but has no role.
    // Show a spinner rather than immediately redirecting: this state can occur
    // transiently right after OTP verification while setUserRole() queues a React
    // state update. Redirecting here would race-condition the user back to login.
    // useAuthRedirect (on the landing page) handles the durable no-role case by
    // calling logout(), so a genuine stale session won't spin forever.
    if (token && user && !user.role) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    // 4. Onboarding check
    if (requireOnboarding && token && user && user.role && !user.isOnboarded) {
        const onboardingRoute = user.role === 'mistri'
            ? ROUTES.ONBOARDING.MISTRI
            : ROUTES.ONBOARDING.CUSTOMER;
        return <Redirect href={onboardingRoute} />;
    }

    // 5. Mistri approval gate — only applies after onboarding is complete
    if (
        token && user &&
        user.role === 'mistri' &&
        user.isOnboarded &&
        user.approvalStatus !== 'approved'
    ) {
        // Don't redirect if we're already on the pending-approval screen
        const isOnPendingScreen = segments.some(seg => seg === 'pending-approval');
        if (!isOnPendingScreen) {
            return <Redirect href={ROUTES.PENDING_APPROVAL as any} />;
        }
    }

    // 6. Cross-role guard — prevent navigation into the wrong role's route group
    const isInMistriGroup = segments.some(seg => seg === '(mistri)');
    const isInCustomerGroup = segments.some(seg => seg === '(customer)');

    if (token && user && user.isOnboarded) {
        if (user.role === 'user' && isInMistriGroup) {
            return <Redirect href={ROUTES.CUSTOMER.HOME as any} />;
        }
        if (user.role === 'mistri' && isInCustomerGroup && user.approvalStatus === 'approved') {
            return <Redirect href={ROUTES.MISTRI.HOME as any} />;
        }
    }

    return <>{children}</>;
});

/**
 * Simple loading guard for initial app load
 */
export const LoadingGuard = memo(({ children }: { children: React.ReactNode }) => {
    const { isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    return <>{children}</>;
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
