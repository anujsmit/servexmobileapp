import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="customer/index" />
            <Stack.Screen name="mistri/index" />
            <Stack.Screen name="mistri/profile" />
        </Stack>
    );
}


