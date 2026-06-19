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

interface AccountDeletionModalProps {
    visible: boolean;
    onClose: () => void;
    phoneNumber: string;
    onRequestOtp: () => Promise<void>;
    onVerifyOtp: (otp: string) => Promise<void>;
}

export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
    visible,
    onClose,
    phoneNumber,
    onRequestOtp,
    onVerifyOtp,
}) => {
    const [step, setStep] = useState<'confirm' | 'verify-otp'>('confirm');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [canResend, setCanResend] = useState(false);

    const otpInputs = React.useRef<(TextInput | null)[]>([]);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setStep('confirm');
            setOtp(['', '', '', '', '', '']);
            setIsLoading(false);
            setTimer(0);
            setCanResend(false);
        }
    }, [visible]);

    // Timer for resend OTP
    React.useEffect(() => {
        let interval: NodeJS.Timeout;
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

    const handleOtpChange = (value: string, index: number) => {
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

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    const handleRequestDeletion = async () => {
        try {
            setIsLoading(true);
            await onRequestOtp();

            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setStep('verify-otp');
            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
        } catch (error: any) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            setIsLoading(true);
            await onRequestOtp();

            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } catch (error: any) {
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
            await onVerifyOtp(otpToVerify);

            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to verify OTP');
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 'verify-otp') {
            setStep('confirm');
            setOtp(['', '', '', '', '', '']);
        } else {
            onClose();
        }
    };

    const maskedPhone = phoneNumber
        ? phoneNumber.slice(-4).padStart(phoneNumber.length, '*')
        : '';

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
                        <Text style={styles.headerTitle}>Delete Account</Text>
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
                                {step === 'confirm' ? (
                                    <>
                                        {/* Warning Icon */}
                                        <View style={styles.warningIconContainer}>
                                            <MaterialIcons name="warning" size={64} color="#dc2626" />
                                        </View>

                                        {/* Warning Title */}
                                        <Text style={styles.warningTitle}>
                                            Are you sure you want to delete your account?
                                        </Text>

                                        {/* Warning Description */}
                                        <Text style={styles.warningDescription}>
                                            This action is permanent and cannot be undone. All your data will be permanently deleted, including:
                                        </Text>

                                        {/* List of what will be deleted */}
                                        <View style={styles.deleteList}>
                                            <View style={styles.deleteListItem}>
                                                <MaterialIcons name="check-circle" size={18} color="#dc2626" />
                                                <Text style={styles.deleteListText}>Your profile information</Text>
                                            </View>
                                            <View style={styles.deleteListItem}>
                                                <MaterialIcons name="check-circle" size={18} color="#dc2626" />
                                                <Text style={styles.deleteListText}>Service request history</Text>
                                            </View>
                                            <View style={styles.deleteListItem}>
                                                <MaterialIcons name="check-circle" size={18} color="#dc2626" />
                                                <Text style={styles.deleteListText}>Reviews and ratings</Text>
                                            </View>
                                            <View style={styles.deleteListItem}>
                                                <MaterialIcons name="check-circle" size={18} color="#dc2626" />
                                                <Text style={styles.deleteListText}>All associated data</Text>
                                            </View>
                                        </View>

                                        {/* OTP Info */}
                                        <View style={styles.infoBox}>
                                            <MaterialIcons name="info-outline" size={18} color="#6b7280" />
                                            <Text style={styles.infoText}>
                                                A verification code will be sent to your phone number ({maskedPhone}) to confirm deletion.
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        {/* OTP Section Header */}
                                        <View style={styles.otpHeaderSection}>
                                            <View style={styles.warningIconSmall}>
                                                <MaterialIcons name="warning" size={32} color="#dc2626" />
                                            </View>
                                            <Text style={styles.otpTitle}>Enter Verification Code</Text>
                                            <Text style={styles.otpSentText}>
                                                Code sent to <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
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

                                        {/* Final Warning */}
                                        <View style={styles.finalWarningBox}>
                                            <MaterialIcons name="error" size={20} color="#dc2626" />
                                            <Text style={styles.finalWarningText}>
                                                Entering this code will permanently delete your account
                                            </Text>
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
                            style={[styles.deleteButton, isLoading && styles.buttonDisabled]}
                            onPress={step === 'confirm' ? handleRequestDeletion : () => handleVerifyOtp()}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.deleteButtonText}>
                                    {step === 'confirm' ? 'Continue' : 'Delete Account'}
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
        color: '#dc2626',
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
    warningIconContainer: {
        alignItems: 'center',
        marginVertical: 24,
    },
    warningIconSmall: {
        marginBottom: 16,
    },
    warningTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 16,
    },
    warningDescription: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    deleteList: {
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    deleteListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    deleteListText: {
        fontSize: 14,
        color: '#991b1b',
        flex: 1,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
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
        borderColor: '#dc2626',
        backgroundColor: '#fef2f2',
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
    finalWarningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    finalWarningText: {
        flex: 1,
        fontSize: 13,
        color: '#991b1b',
        lineHeight: 18,
        fontWeight: '500',
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
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
    },
    deleteButton: {
        flex: 2,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
});
