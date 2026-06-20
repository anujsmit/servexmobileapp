import React from 'react';
import { Stack } from 'expo-router';
import { AuthGuard } from '../../components/AuthGuard';
import { useSegments } from 'expo-router';
import { LocationProvider } from '../../context/LocationContext';
import { NotificationListener } from '../../components/NotificationListener';

export default function ProtectedLayout() {
    const segments = useSegments();
    const isInOnboardingFlow = segments.some(seg => seg === 'onboarding');

    return (
        <AuthGuard
            requireAuth={true}
            requireOnboarding={!isInOnboardingFlow}
        >
            <LocationProvider>
                <Stack screenOptions={{
                    headerShown: false,
                    animation: 'none',
                    contentStyle: {
                        backgroundColor: 'transparent',
                    }
                }}>
                    <Stack.Screen
                        name="(customer)"
                        options={{
                            // Prevent navigating back from customer dashboard
                            gestureEnabled: false,
                            headerBackVisible: false,
                        }}
                    />
                    <Stack.Screen
                        name="(mistri)"
                        options={{
                            // Prevent navigating back from mistri dashboard
                            gestureEnabled: false,
                            headerBackVisible: false,
                        }}
                    />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen
                        name="pending-approval"
                        options={{ gestureEnabled: false, headerBackVisible: false }}
                    />
                </Stack>
            <NotificationListener />
            </LocationProvider>
        </AuthGuard>
    );
}
