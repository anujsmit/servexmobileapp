import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    Alert,
    TouchableOpacity,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    Image,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import * as Haptics from 'expo-haptics';
import { ROUTES } from '../../lib/routes';
import { Ionicons } from '@expo/vector-icons';

type RoleParam = 'user' | 'mistri';

const ROLE_CONFIG: Record<RoleParam, { accent: string; label: string }> = {
    user: { accent: '#0177b8', label: 'Customer' },
    mistri: { accent: '#179d2e', label: 'Mistri' },
};

export default function VerifyOtpScreen() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);
    const [roleMismatch, setRoleMismatch] = useState<RoleParam | null>(null);
    // Set after OTP verify for new users; navigation deferred until user.role is in state
    const [pendingOnboarding, setPendingOnboarding] = useState(false);

    const router = useRouter();
    const { phone, role: roleParam } = useLocalSearchParams<{ phone: string; role?: string }>();
    const { verifyOtp, sendOtp, setUserRole, user } = useAuth();

    const role: RoleParam = roleParam === 'mistri' ? 'mistri' : 'user';
    const config = ROLE_CONFIG[role];
    // The opposite role — used in the mismatch card
    const oppositeRole: RoleParam = role === 'mistri' ? 'user' : 'mistri';

    const otpInputs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    setCanResend(true);
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Navigate to onboarding only AFTER user.role is reflected in React state.
    // This avoids a race where AuthGuard sees role=null and bounces back to login.
    useEffect(() => {
        if (!pendingOnboarding || !user?.role) return;
        setPendingOnboarding(false);
        router.replace(
            user.role === 'mistri'
                ? { pathname: '(Protected)/onboarding/mistri' }
                : { pathname: '(Protected)/onboarding/customer' }
        );
    }, [pendingOnboarding, user?.role]);

    const handleOtpChange = (value: string, index: number): void => {
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 1) {
            const newOtp = [...otp];
            newOtp[index] = numericValue;
            setOtp(newOtp);
            if (numericValue && index < 5) {
                otpInputs.current[index + 1]?.focus();
            }
            if (index === 5 && numericValue) {
                const completeOtp = [...newOtp];
                completeOtp[5] = numericValue;
                if (completeOtp.every(digit => digit !== '')) {
                    Keyboard.dismiss();
                    handleVerifyOtp(completeOtp.join(''));
                }
            }
        }
    };

    const handleKeyPress = (e: any, index: number): void => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (otpCode?: string): Promise<void> => {
        const otpToVerify = otpCode || otp.join('');
        if (otpToVerify.length !== 6) {
            Alert.alert('Error', 'Please enter complete 6-digit OTP');
            return;
        }

        setIsLoading(true);
        try {
            const user = await verifyOtp(phone as string, otpToVerify);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (!user.role) {
                // New user — assign role, then let useEffect navigate once
                // user.role is reflected in React state (avoids AuthGuard race).
                await setUserRole(role);
                setPendingOnboarding(true);
                return;
            }

            // Returning user — check role matches the login path they chose
            const actualRole: RoleParam = user.role === 'mistri' ? 'mistri' : 'user';
            if (actualRole !== role) {
                // Mismatch: this phone belongs to the opposite role
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setRoleMismatch(actualRole);
                setOtp(['', '', '', '', '', '']);
                return;
            }

            // Role matches — route normally
            if (user.role === 'mistri') {
                if (!user.isOnboarded) {
                    router.replace({ pathname: '/onboarding/mistri' });
                } else if (user.approvalStatus !== 'approved') {
                    router.replace(ROUTES.PENDING_APPROVAL as any);
                } else {
                    router.replace({ pathname: '/(protected)/(mistri)/' } as any);
                }
            } else {
                if (!user.isOnboarded) {
                    router.replace({ pathname: '/onboarding/customer' });
                } else {
                    router.replace({ pathname: '/(protected)/(customer)/' } as any);
                }
            }
        } catch (error) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (__DEV__) console.error('[VerifyOTP] error:', error);
            const msg = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
            const isOtpError = msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired');
            Alert.alert('Error', isOtpError ? 'Invalid or expired OTP' : msg);
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async (): Promise<void> => {
        try {
            setIsLoading(true);
            await sendOtp(phone as string);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } catch (error) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const formatPhoneNumber = (phoneNum: any): string => {
        const p = phoneNum?.toString() || '';
        if (p.length === 10) return `+977 ${p.slice(0, 5)} ${p.slice(5)}`;
        return `+977 ${p}`;
    };

    const switchToCorrectLogin = () => {
        if (!roleMismatch) return;
        // Restart the login flow for the correct role
        router.replace({ pathname: '/login', params: { role: roleMismatch } });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerSection}>
                        <Image
                            source={require('../../assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.brandName}>ServeX</Text>

                        {/* Role pill — dynamic accent */}
                        <View style={[styles.rolePill, { backgroundColor: `${config.accent}14`, borderColor: `${config.accent}35` }]}>
                            <View style={[styles.rolePillDot, { backgroundColor: config.accent }]} />
                            <Text style={[styles.rolePillText, { color: config.accent }]}>
                                {config.label} login
                            </Text>
                        </View>

                        <Text style={styles.headerTitle}>Verify your number</Text>
                        <Text style={styles.headerSubtitle}>
                            Enter the 6-digit code sent to{'\n'}
                            <Text style={styles.phoneNumber}>{formatPhoneNumber(phone)}</Text>
                        </Text>
                    </View>

                    {/* ── Role mismatch card ── */}
                    {roleMismatch && (
                        <View style={styles.mismatchCard}>
                            <View style={styles.mismatchIconWrap}>
                                <Ionicons name="swap-horizontal-outline" size={20} color="#b45309" />
                            </View>
                            <View style={styles.mismatchBody}>
                                <Text style={styles.mismatchTitle}>Wrong login path</Text>
                                <Text style={styles.mismatchDesc}>
                                    This number is registered as a{' '}
                                    <Text style={styles.mismatchBold}>{ROLE_CONFIG[roleMismatch].label}</Text>.
                                    {' '}Please sign in using the {ROLE_CONFIG[roleMismatch].label} option.
                                </Text>
                                <TouchableOpacity
                                    style={[styles.mismatchBtn, { backgroundColor: ROLE_CONFIG[roleMismatch].accent }]}
                                    onPress={switchToCorrectLogin}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.mismatchBtnText}>
                                        Go to {ROLE_CONFIG[roleMismatch].label} login
                                    </Text>
                                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ── OTP inputs ── */}
                    {!roleMismatch && (
                        <View style={styles.otpSection}>
                            <View style={styles.otpContainer}>
                                {otp.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { otpInputs.current[index] = ref; }}
                                        style={[
                                            styles.otpInput,
                                            digit && [styles.otpInputFilled, { borderColor: config.accent }],
                                        ]}
                                        value={digit}
                                        onChangeText={(value) => handleOtpChange(value, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        textAlign="center"
                                        selectTextOnFocus
                                        textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                                        autoComplete="sms-otp"
                                    />
                                ))}
                            </View>

                            <View style={styles.resendSection}>
                                {!canResend ? (
                                    <Text style={styles.timerText}>Resend code in {timer}s</Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                                        <Text style={[styles.resendText, { color: config.accent }]}>
                                            Didn't receive code? Resend
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.verifyButton,
                                    { backgroundColor: config.accent },
                                    (otp.join('').length !== 6 || isLoading) && styles.buttonDisabled,
                                ]}
                                onPress={() => handleVerifyOtp()}
                                disabled={otp.join('').length !== 6 || isLoading}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.verifyButtonText,
                                    (otp.join('').length !== 6 || isLoading) && styles.buttonTextDisabled,
                                ]}>
                                    {isLoading ? 'Verifying...' : 'Verify & Continue'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>← Back to phone number</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 30,
        paddingTop: 60,
        paddingBottom: 40,
    },

    /* ── Header ── */
    headerSection: {
        alignItems: 'center',
        marginBottom: 44,
    },
    logo: { width: 60, height: 60, marginBottom: 12, borderRadius: 14 },
    brandName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.4,
    },
    rolePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 20,
    },
    rolePillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    rolePillText: {
        fontSize: 13,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 10,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
    },
    phoneNumber: { fontWeight: '600', color: '#1a1a1a' },

    /* ── Role mismatch card ── */
    mismatchCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        backgroundColor: '#fffbeb',
        borderWidth: 1.5,
        borderColor: '#fcd34d',
        borderRadius: 16,
        padding: 18,
        marginBottom: 32,
    },
    mismatchIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#fef3c7',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
    },
    mismatchBody: {
        flex: 1,
    },
    mismatchTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#92400e',
        marginBottom: 4,
    },
    mismatchDesc: {
        fontSize: 13,
        color: '#78350f',
        lineHeight: 20,
        marginBottom: 14,
    },
    mismatchBold: {
        fontWeight: '700',
    },
    mismatchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    mismatchBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },

    /* ── OTP section ── */
    otpSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingHorizontal: 10,
    },
    otpInput: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        fontSize: 24,
        fontWeight: '600',
        color: '#1a1a1a',
        backgroundColor: '#f8f9fa',
        marginHorizontal: 4,
    },
    otpInputFilled: {
        backgroundColor: '#ffffff',
    },
    resendSection: { alignItems: 'center', marginBottom: 40 },
    timerText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
    resendText: {
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    verifyButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 30,
    },
    buttonDisabled: { backgroundColor: '#e5e7eb' },
    verifyButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    buttonTextDisabled: { color: '#9ca3af' },

    /* ── Back ── */
    backButton: { alignItems: 'center', paddingVertical: 12 },
    backButtonText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
});
