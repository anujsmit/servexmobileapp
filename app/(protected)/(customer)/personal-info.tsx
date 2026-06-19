import React from 'react';
import { Pressable, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { CustomerProfileContent } from '../../../components/customer-profile-content';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../lib/config';
import { customerBrand as B, customerDashboardColors as C } from '../../../lib/customerDashboardTokens';

export default function CustomerPersonalInfoScreen() {
    const { user, logout, refreshUser } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.replace('/login');
    };

    const handleUpdateProfile = async (data: { fullName: string }) => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Failed to update profile');
        }

        await refreshUser();
    };

    const handleRequestPhoneChange = async (newPhone: string) => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/api/auth/request-phone-change`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ newPhoneNumber: newPhone }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to request phone change');
        }
    };

    const handleVerifyPhoneChange = async (newPhone: string, otp: string) => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${API_BASE_URL}/api/auth/verify-phone-change`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ newPhoneNumber: newPhone, otp }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to verify phone change');
        }

        Promise.resolve()
            .then(async () => {
                try {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await refreshUser();
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : '';
                    if (msg && !msg.toLowerCase().includes('splash') && __DEV__) {
                        console.log('User refresh completed with warning:', msg);
                    }
                }
            })
            .catch(() => {});
    };

    if (!user) {
        return (
            <SafeAreaContainer style={styles.safeRoot}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={B.accent} />
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer style={styles.safeRoot}>
            <PageTitle
                title="Personal information"
                variant="mistri"
                leftElement={
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={28} color={C.text} />
                    </Pressable>
                }
            />
            <CustomerProfileContent
                variant="screen"
                showScreenHeader={false}
                showLegalSection={false}
                showLogoutSection={false}
                user={{
                    fullName: user.fullName,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                }}
                onUpdateProfile={handleUpdateProfile}
                onRequestPhoneChange={handleRequestPhoneChange}
                onVerifyPhoneChange={handleVerifyPhoneChange}
                onLogout={handleLogout}
                showLocationChange
            />
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: C.surface,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
