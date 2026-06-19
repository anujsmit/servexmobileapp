import React from 'react';
import { Stack } from 'expo-router';
import { MistriTradeThemeProvider } from '../../../context/MistriTradeThemeContext';

export default function MistriLayout() {
    return (
        <MistriTradeThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
                name="job-details"
                options={{
                    headerShown: false,
                    presentation: 'card',
                    animation: 'slide_from_right',
                }}
            />
            <Stack.Screen
                name="services"
                options={{
                    headerShown: false,
                    presentation: 'card',
                    animation: 'slide_from_right',
                }}
            />
            <Stack.Screen
                name="account-settings"
                options={{
                    headerShown: true,
                    presentation: 'card',
                    animation: 'slide_from_right',
                }}
            />
            <Stack.Screen
                name="edit-profile"
                options={{
                    headerShown: true,
                    title: 'Edit profile',
                    presentation: 'card',
                    animation: 'slide_from_right',
                    headerBackTitle: 'Settings',
                }}
            />
        </Stack>
        </MistriTradeThemeProvider>
    );
}
