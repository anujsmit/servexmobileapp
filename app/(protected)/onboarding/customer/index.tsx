// app/onboarding/customer/index.tsx

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function CustomerOnboarding() {
    const router = useRouter();
    const { user, updateProfile, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        setLoading(true);
        try {
            await updateProfile(user?.fullName || '', undefined, undefined, true);
            await refreshUser();
            router.replace('/(protected)/(customer)');
        } catch (error) {
            console.error('Onboarding error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0177b8', '#005a8f']}
                style={styles.header}
            >
                <Image
                    source={require('../../../../assets/images/logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Welcome to ServeX</Text>
                <Text style={styles.subtitle}>
                    Book trusted professionals for all your needs
                </Text>
            </LinearGradient>

            <ScrollView style={styles.content}>
                <View style={styles.featureCard}>
                    <Ionicons name="search" size={32} color="#0177b8" />
                    <Text style={styles.featureTitle}>Find Services</Text>
                    <Text style={styles.featureDesc}>
                        Browse through hundreds of services near you
                    </Text>
                </View>

                <View style={styles.featureCard}>
                    <Ionicons name="people" size={32} color="#0177b8" />
                    <Text style={styles.featureTitle}>Trusted Professionals</Text>
                    <Text style={styles.featureDesc}>
                        Verified and experienced service providers
                    </Text>
                </View>

                <View style={styles.featureCard}>
                    <Ionicons name="shield-checkmark" size={32} color="#0177b8" />
                    <Text style={styles.featureTitle}>Secure & Reliable</Text>
                    <Text style={styles.featureDesc}>
                        Quality service guaranteed with secure payments
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleContinue}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Get Started</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 40,
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    logo: {
        width: 80,
        height: 80,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    featureCard: {
        backgroundColor: '#f8fafc',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    featureTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 8,
    },
    featureDesc: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
    },
    button: {
        backgroundColor: '#0177b8',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#0177b8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});