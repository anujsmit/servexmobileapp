//app/(protected)/onboarding/mistri/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function MistriOnboardingWelcome() {
    const router = useRouter();
    const { logout } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
    const [isRequestingPermissions, setIsRequestingPermissions] = useState<boolean>(false);

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

    const requestCameraPermission = async (): Promise<boolean> => {
        try {
            if (Platform.OS === 'ios') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Camera Permission Required',
                        'Camera access is required to take your profile picture and capture ID documents in real-time. This ensures authenticity of your documents.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                    );
                    return false;
                }
                return true;
            } else {
                // For Android
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Camera Permission Required',
                        'Camera access is required for real-time photo capture of your profile and ID documents. This helps verify your identity.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                    );
                    return false;
                }
                return true;
            }
        } catch (error) {
            console.error('Camera permission error:', error);
            return false;
        }
    };

    const requestLocationPermission = async (): Promise<boolean> => {
        try {
            const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
            
            if (foregroundStatus !== 'granted') {
                const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
                
                if (requestedStatus !== 'granted') {
                    Alert.alert(
                        'Location Permission Required',
                        'Location access helps customers find you on the map. Please enable location services in settings.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Open Settings', onPress: () => Linking.openSettings() }
                        ]
                    );
                    return false;
                }
            }
            return true;
        } catch (error) {
            console.error('Location permission error:', error);
            return false;
        }
    };

    const handleStart = async () => {
        if (isRequestingPermissions) return;
        setIsRequestingPermissions(true);

        try {
            // 1. Request Camera Permission for real-time photos
            const cameraGranted = await requestCameraPermission();
            if (!cameraGranted) {
                setIsRequestingPermissions(false);
                return;
            }

            // 2. Request Location Permission
            const locationGranted = await requestLocationPermission();
            if (!locationGranted) {
                setIsRequestingPermissions(false);
                return;
            }

            // 3. Navigate if all permissions are granted
            router.push('/onboarding/mistri/Profile');
        } catch (error) {
            console.error('Permission requesting error:', error);
            Alert.alert('Error', 'An error occurred while setting up permissions. Please try again.');
        } finally {
            setIsRequestingPermissions(false);
        }
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
                    Let's set up your service profile.{"\n"}You'll take real-time photos for your profile and ID verification.
                </Text>

                {/* Explanation Block for Permissions */}
                <View style={styles.infoBox}>
                    <View style={styles.infoRow}>
                        <Ionicons name="camera-outline" size={20} color="#179d2e" />
                        <Text style={styles.infoText}>
                            <Text style={styles.boldText}>Camera Access: </Text>
                            Required to capture your live profile picture and scan Government ID documents in real-time for authenticity.
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={20} color="#179d2e" />
                        <Text style={styles.infoText}>
                            <Text style={styles.boldText}>Location Coordinates: </Text>
                            Used to position your service shop on the customer map so jobs can find you.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.button, isRequestingPermissions && styles.buttonDisabled]} 
                    onPress={handleStart} 
                    disabled={isRequestingPermissions}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>
                        {isRequestingPermissions ? 'Setting up...' : 'Get Started'}
                    </Text>
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    disabled={isLoggingOut || isRequestingPermissions}
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
        fontSize: 15,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        fontWeight: '400',
    },
    infoBox: {
        backgroundColor: '#f4faf4',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#d0ebd4',
        width: '100%',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#4b5563',
        lineHeight: 18,
    },
    boldText: {
        fontWeight: '600',
        color: '#1f2937',
    },
    button: {
        backgroundColor: '#179d2e',
        paddingVertical: 16,
        width: '100%',
        alignItems: 'center',
        borderRadius: 12,
    },
    buttonDisabled: {
        backgroundColor: '#a3caa7',
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
        marginTop: 16,
    },
    logoutText: {
        marginLeft: 8,
        color: 'red',
        fontSize: 16,
        fontWeight: '500',
    },
});