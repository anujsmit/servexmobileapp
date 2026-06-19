// app/verify-forgot-otp.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL as API_URL } from '../../lib/config';

export default function VerifyForgotOtpScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanResend(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleOtpChange = (text: string, index: number) => {
        if (text.length > 1) return;
        
        const newOtp = [...otp];
        newOtp[index] = text;
        setOtp(newOtp);

        if (text && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOTP = async () => {
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            Toast.show({
                type: 'error',
                text1: 'Invalid OTP',
                text2: 'Please enter the 6-digit verification code',
                position: 'top',
                visibilityTime: 3000,
            });
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const response = await fetch(`${API_URL}/api/auth/verify-forgot-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone, otp: otpString }),
            });

            const data = await response.json();

            if (response.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Toast.show({
                    type: 'success',
                    text1: 'Verified!',
                    text2: 'Please set your new password',
                    position: 'top',
                    visibilityTime: 3000,
                });
                
                router.push({
                    pathname: '/reset-password',
                    params: { phone, token: data.token },
                });
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: data.message || 'Invalid OTP. Please try again.',
                    position: 'top',
                    visibilityTime: 3000,
                });
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
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

    const handleResendOTP = async () => {
        if (!canResend) return;

        setResendLoading(true);
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
                    text1: 'OTP Resent',
                    text2: 'Please check your phone for new verification code',
                    position: 'top',
                    visibilityTime: 3000,
                });
                
                setTimer(60);
                setCanResend(false);
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                
                const interval = setInterval(() => {
                    setTimer((prev) => {
                        if (prev <= 1) {
                            clearInterval(interval);
                            setCanResend(true);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: data.message || 'Failed to resend OTP',
                    position: 'top',
                    visibilityTime: 3000,
                });
            }
        } catch (error) {
            console.error('Resend OTP error:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Network error. Please try again.',
                position: 'top',
                visibilityTime: 3000,
            });
        } finally {
            setResendLoading(false);
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
                            <Text style={styles.title}>Verify Code</Text>
                            <Text style={styles.subtitle}>
                                We've sent a verification code to
                            </Text>
                            <Text style={styles.phoneText}>+977 {phone}</Text>
                        </LinearGradient>

                        {/* OTP Input Fields */}
                        <View style={styles.formContainer}>
                            <View style={styles.otpContainer}>
                                {otp.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => (inputRefs.current[index] = ref)}
                                        style={styles.otpInput}
                                        value={digit}
                                        onChangeText={(text) => handleOtpChange(text, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        textAlign="center"
                                    />
                                ))}
                            </View>

                            {/* Resend Section */}
                            <View style={styles.resendContainer}>
                                <Text style={styles.resendText}>
                                    {canResend ? "Didn't receive the code?" : `Resend code in ${timer}s`}
                                </Text>
                                {canResend && (
                                    <TouchableOpacity onPress={handleResendOTP} disabled={resendLoading}>
                                        <Text style={styles.resendButton}>
                                            {resendLoading ? 'Sending...' : 'Resend Code'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Verify Button */}
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: '#0177b8' }]}
                                onPress={handleVerifyOTP}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Verify & Continue</Text>
                                )}
                            </TouchableOpacity>
                        </View>
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
    phoneText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginTop: 8,
    },
    formContainer: {
        paddingHorizontal: 24,
        marginTop: 32,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    otpInput: {
        width: 50,
        height: 55,
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 12,
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        backgroundColor: '#f8f9fa',
        textAlign: 'center',
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginBottom: 30,
    },
    resendText: {
        fontSize: 14,
        color: '#fff',
    },
    resendButton: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        textDecorationLine: 'underline',
    },
    button: {
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
});