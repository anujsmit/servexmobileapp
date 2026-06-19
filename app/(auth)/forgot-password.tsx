// app/forgot-password.tsx
import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL as API_URL } from '../../lib/config';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    const validatePhone = (phoneNumber: string): boolean => {
        return /^[6-9]\d{9}$/.test(phoneNumber);
    };

    const handleSendOTP = async () => {
        if (!phone) {
            setPhoneError('Phone number is required');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        if (!validatePhone(phone)) {
            setPhoneError('Enter a valid 10-digit phone number');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setPhoneError('');
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone }),
            });

            const data = await response.json();

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Toast.show({
                    type: 'success',
                    text1: 'OTP Sent!',
                    text2: 'Verification code sent to your phone',
                    position: 'top',
                    visibilityTime: 3000,
                });
                
                // Navigate to verify OTP screen
                router.push({
                    pathname: '/verify-forgot-otp',
                    params: { phone },
                });
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: data.message || 'Failed to send OTP',
                    position: 'top',
                    visibilityTime: 3000,
                });
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Network error. Please try again.',
                position: 'top',
                visibilityTime: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length <= 10) {
            setPhone(cleaned);
            if (phoneError) setPhoneError('');
        }
    };

    return (
        <>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Back Button */}
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#666" />
                        </TouchableOpacity>

                        {/* Header with Gradient */}
                        <LinearGradient
                            colors={['#0177b8', '#005a8f']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.headerGradient}
                        >
                            <Text style={styles.cursiveBrand}>ServeX</Text>
                            <Text style={styles.title}>Forgot Password?</Text>
                            <Text style={styles.subtitle}>
                                Enter your registered phone number
                            </Text>
                        </LinearGradient>

                        {/* Phone Input */}
                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <View style={styles.inputIcon}>
                                    <Ionicons name="call-outline" size={20} color="#0177b8" />
                                </View>
                                <View style={styles.phoneWrapper}>
                                    <View style={styles.countryCode}>
                                        <Text style={styles.countryText}>+977</Text>
                                    </View>
                                    <TextInput
                                        placeholder="98XXXXXXXX"
                                        placeholderTextColor="#999"
                                        value={phone}
                                        onChangeText={handlePhoneChange}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        style={styles.phoneInput}
                                    />
                                </View>
                            </View>
                            {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
                        </View>

                        {/* Send OTP Button */}
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: '#0177b8' }]}
                            onPress={handleSendOTP}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Send Verification Code</Text>
                            )}
                        </TouchableOpacity>

                        {/* Back to Login */}
                        <TouchableOpacity
                            style={styles.backToLogin}
                            onPress={() => router.push('/login')}
                        >
                            <Text style={styles.backToLoginText}>Back to Login</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
            <Toast />
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    backButton: {
        position: 'absolute',
        top: 16,
        left: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    headerGradient: {
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 50,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    cursiveBrand: {
        fontSize: 42,
        fontWeight: '400',
        fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
        fontStyle: 'italic',
        color: '#fff',
        marginBottom: 12,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    formContainer: {
        paddingHorizontal: 24,
        marginTop: 32,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        overflow: 'hidden',
    },
    inputIcon: {
        paddingLeft: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    phoneWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    countryCode: {
        paddingLeft: 0,
        paddingRight: 8,
        justifyContent: 'center',
    },
    countryText: {
        fontWeight: '600',
        color: '#333',
        fontSize: 15,
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 16,
        paddingRight: 16,
        fontSize: 15,
        color: '#333',
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 12,
        marginBottom: 12,
        marginLeft: 12,
    },
    button: {
        marginHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    backToLogin: {
        alignItems: 'center',
        marginTop: 20,
    },
    backToLoginText: {
        color: '#0177b8',
        fontSize: 15,
        fontWeight: '600',
    },
});