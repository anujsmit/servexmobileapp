import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

interface PhoneChangeModalProps {
    visible: boolean;
    onClose: () => void;
    currentPhone: string;
    onRequestOtp: (newPhone: string) => Promise<void>;
    onVerifyOtp: (newPhone: string, otp: string) => Promise<void>;
}

export const PhoneChangeModal: React.FC<PhoneChangeModalProps> = ({
    visible,
    onClose,
    currentPhone,
    onRequestOtp,
    onVerifyOtp,
}) => {
    const [step, setStep] = useState<'enter-phone' | 'verify-otp'>('enter-phone');
    const [newPhoneNumber, setNewPhoneNumber] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [canResend, setCanResend] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    const otpInputs = React.useRef<(TextInput | null)[]>([]);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep('enter-phone');
            setNewPhoneNumber('');
            setOtp(['', '', '', '', '', '']);
            setIsLoading(false);
            setTimer(0);
            setCanResend(false);
            setPhoneError('');
        }
    }, [visible]);

    // Timer for resend OTP
    React.useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (step === 'verify-otp' && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [step, timer]);

    const handlePhoneChange = (text: string) => {
        // Remove any non-numeric characters
        const cleanedText = text.replace(/\D/g, '');
        setNewPhoneNumber(cleanedText);

        // Clear error when user starts typing
        if (phoneError) {
            setPhoneError('');
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        // Only allow numeric input
        const numericValue = value.replace(/\D/g, '');

        if (numericValue.length <= 1) {
            const newOtp = [...otp];
            newOtp[index] = numericValue;
            setOtp(newOtp);

            // Auto-focus next input
            if (numericValue && index < 5) {
                otpInputs.current[index + 1]?.focus();
            }

            // Auto-verify when all digits are entered
            if (index === 5 && numericValue) {
                const completeOtp = [...newOtp];
                completeOtp[5] = numericValue;
                if (completeOtp.every(digit => digit !== '')) {
                    // Dismiss keyboard before verifying
                    Keyboard.dismiss();
                    handleVerifyOtp(completeOtp.join(''));
                }
            }
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    const handleSendOtp = async () => {
        // Clear previous errors
        setPhoneError('');

        // Validation
        if (!newPhoneNumber.trim() || newPhoneNumber.length < 10) {
            setPhoneError('Please enter a valid 10-digit phone number');
            return;
        }

        if (newPhoneNumber === currentPhone) {
            setPhoneError('New phone number must be different from current number');
            return;
        }

        try {
            setIsLoading(true);
            await onRequestOtp(newPhoneNumber);

            // Success haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setStep('verify-otp');
            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
        } catch (error: any) {
            // Error haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            const errorMessage = error.message || 'Failed to send OTP';

            // Handle rate limit error
            if (errorMessage.toLowerCase().includes('rate limit')) {
                setPhoneError('You have reached the daily limit of 5 phone number changes. Please try again tomorrow.');
            }
            // Handle phone already in use error
            else if (errorMessage.toLowerCase().includes('already registered') ||
                     errorMessage.toLowerCase().includes('already in use')) {
                setPhoneError('This phone number is already linked to another account');
            }
            // Generic error
            else {
                setPhoneError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            setIsLoading(true);
            await onRequestOtp(newPhoneNumber);

            // Success haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } catch (error: any) {
            // Error haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert('Error', error.message || 'Failed to resend OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (otpCode?: string) => {
        const otpToVerify = otpCode || otp.join('');

        if (otpToVerify.length !== 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit OTP');
            return;
        }

        try {
            setIsLoading(true);
            await onVerifyOtp(newPhoneNumber, otpToVerify);

            // Success haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Close modal immediately after success - no dialog needed
            onClose();
        } catch (error: any) {
            // Error haptic feedback
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            Alert.alert('Error', error.message || 'Failed to verify OTP');
            // Clear OTP on error
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 'verify-otp') {
            setStep('enter-phone');
            setOtp(['', '', '', '', '', '']);
        } else {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                    keyboardVerticalOffset={0}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handleBack}
                            style={styles.backButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialIcons name="arrow-back" size={28} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Change Phone Number</Text>
                        <View style={styles.headerPlaceholder} />
                    </View>

                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollViewContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.content}>
                        {/* Current Phone Display */}
                        <View style={styles.currentPhoneSection}>
                            <Text style={styles.label}>Current Phone Number</Text>
                            <View style={styles.currentPhoneBox}>
                                <MaterialIcons name="phone" size={20} color="#6b7280" />
                                <Text style={styles.currentPhoneText}>{currentPhone}</Text>
                            </View>
                        </View>

                        {step === 'enter-phone' ? (
                            <>
                                {/* New Phone Input */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>New Phone Number</Text>
                                    <View style={[
                                        styles.phoneInputContainer,
                                        phoneError && styles.phoneInputError
                                    ]}>
                                        <MaterialIcons
                                            name="phone"
                                            size={20}
                                            color={phoneError ? '#dc2626' : '#6b7280'}
                                            style={styles.phoneIcon}
                                        />
                                        <TextInput
                                            style={styles.phoneInput}
                                            value={newPhoneNumber}
                                            onChangeText={handlePhoneChange}
                                            placeholder="Enter new phone number"
                                            placeholderTextColor="#9ca3af"
                                            keyboardType="phone-pad"
                                            autoFocus
                                            maxLength={10}
                                        />
                                    </View>
                                    {phoneError ? (
                                        <View style={styles.errorContainer}>
                                            <MaterialIcons name="error-outline" size={16} color="#dc2626" />
                                            <Text style={styles.errorText}>{phoneError}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Info Box */}
                                {!phoneError && (
                                    <View style={styles.infoBox}>
                                        <MaterialIcons name="info-outline" size={18} color="#6b7280" />
                                        <Text style={styles.infoText}>
                                            A verification code will be sent to your new number
                                        </Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                {/* OTP Section Header */}
                                <View style={styles.otpHeaderSection}>
                                    <Text style={styles.otpTitle}>Verify OTP</Text>
                                    <Text style={styles.otpSentText}>
                                        Code sent to <Text style={styles.phoneHighlight}>{newPhoneNumber}</Text>
                                    </Text>
                                </View>

                                {/* OTP Input Boxes */}
                                <View style={styles.otpContainer}>
                                    {otp.map((digit, index) => (
                                        <TextInput
                                            key={index}
                                            ref={(ref) => {
                                                otpInputs.current[index] = ref;
                                            }}
                                            style={[
                                                styles.otpBox,
                                                digit && styles.otpBoxFilled
                                            ]}
                                            value={digit}
                                            onChangeText={(value) => handleOtpChange(value, index)}
                                            onKeyPress={(e) => handleKeyPress(e, index)}
                                            keyboardType="number-pad"
                                            maxLength={1}
                                            textAlign="center"
                                            selectTextOnFocus
                                        />
                                    ))}
                                </View>

                                {/* Timer and Resend */}
                                <View style={styles.resendSection}>
                                    {!canResend ? (
                                        <View style={styles.timerContainer}>
                                            <MaterialIcons name="schedule" size={16} color="#6b7280" />
                                            <Text style={styles.timerText}>
                                                Resend available in {timer}s
                                            </Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.resendButton}
                                            onPress={handleResendOtp}
                                            disabled={isLoading}
                                        >
                                            <MaterialIcons name="refresh" size={18} color="#111827" />
                                            <Text style={styles.resendText}>
                                                Resend Code
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        )}
                            </View>
                        </ScrollView>
                    </TouchableWithoutFeedback>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                            disabled={isLoading}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.continueButton, isLoading && styles.buttonDisabled]}
                            onPress={step === 'enter-phone' ? handleSendOtp : () => handleVerifyOtp()}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.continueButtonText}>
                                    {step === 'enter-phone' ? 'Send OTP' : 'Verify & Update'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#ffffff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    backButton: {
        padding: 4,
    },
    headerPlaceholder: {
        width: 36,
    },
    scrollView: {
        flex: 1,
    },
    scrollViewContent: {
        flexGrow: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    currentPhoneSection: {
        marginBottom: 32,
    },
    currentPhoneBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        gap: 12,
    },
    currentPhoneText: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
    },
    phoneInputError: {
        borderColor: '#dc2626',
        backgroundColor: '#fef2f2',
    },
    phoneIcon: {
        marginRight: 12,
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#111827',
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    errorText: {
        fontSize: 13,
        color: '#dc2626',
        fontWeight: '500',
        flex: 1,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        backgroundColor: '#f9fafb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
    },
    otpHeaderSection: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 8,
    },
    otpTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    otpSentText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    phoneHighlight: {
        fontWeight: '600',
        color: '#111827',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 32,
        paddingHorizontal: 4,
    },
    otpBox: {
        width: 48,
        height: 58,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        backgroundColor: '#f9fafb',
    },
    otpBoxFilled: {
        borderColor: '#111827',
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    resendSection: {
        alignItems: 'center',
        marginBottom: 24,
        minHeight: 40,
        justifyContent: 'center',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 20,
    },
    timerText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    resendText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '600',
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
    },
    noteText: {
        fontSize: 14,
        color: '#1e40af',
        marginLeft: 12,
        flex: 1,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#ffffff',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    continueButton: {
        flex: 2,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#16a34a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
});
