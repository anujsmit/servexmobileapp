import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function MistriOnboardingWelcome() {
    const router = useRouter();
    const { logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await logout();
            router.replace('/login');
        } catch (error) {
            if (__DEV__) console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to log out. Please try again.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleStart = () => {
        router.push('/(protected)/onboarding/mistri/profile');
    };
    return (
        <LinearGradient
            colors={['#e8f5e8', '#ffffff']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        >
            <View style={styles.container}>
                <Image
                    source={require('../../../../assets/images/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Welcome to ServeX!</Text>
                <Text style={styles.subtitle}>
                    Let's set up your service profile.{"\n"}You can add your photo, select your service,
                    and share your location with customers.
                </Text>
                <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    disabled={isLoggingOut}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={18} color="red" />
                    <Text style={styles.logoutText}>
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
        fontWeight: '400',
    },
    button: {
        backgroundColor: '#179d2e',
        paddingVertical: 16,
        paddingHorizontal: 60,
        borderRadius: 12,
            },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        marginTop: 30,
    },
    logoutText: {
        marginLeft: 8,
        color: 'red',
        fontSize: 16,
        fontWeight: '500',
    },
});
