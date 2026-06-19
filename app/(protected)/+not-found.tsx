import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedNotFoundScreen() {
    const { user } = useAuth();

    // Determine the appropriate dashboard path based on user role
    const getDashboardPath = () => {
        if (!user?.isOnboarded) {
            return user?.role === 'mistri' ? '/onboarding/mistri' : '/onboarding/customer';
        }
        return user?.role === 'mistri' ? '/(protected)/(mistri)/(tabs)' : '/(protected)/(customer)';
    };

    return (
        <>
            <Stack.Screen options={{ title: "Page Not Found" }} />
            <View style={styles.container}>
                <Text style={styles.title}>Page Not Found</Text>
                <Text style={styles.subtitle}>
                    The page you're looking for doesn't exist in this section.
                </Text>
                <Link href={getDashboardPath()} asChild>
                    <TouchableOpacity style={styles.homeButton}>
                        <Text style={styles.homeButtonText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f9fafb',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    homeButton: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    homeButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
