// app/(protected)/(customer)/settings.tsx

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Linking,
    ScrollView,
    Pressable,
    StyleSheet,
    Modal,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../lib/config';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../../lib/legalUrls';
import {
    customerDashboardColors as DC,
    customerDashboardElevation as ELEV,
} from '../../../lib/customerDashboardTokens';

function SectionLabel({ label }: { label: string }) {
    return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SettingsCard({ children }: { children: React.ReactNode }) {
    return <View style={styles.settingsCard}>{children}</View>;
}

function SettingsRow({
    icon,
    iconBg,
    title,
    subtitle,
    onPress,
    showChevron = true,
    titleColor = DC.text,
    isFirst = false,
    rightElement,
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showChevron?: boolean;
    titleColor?: string;
    isFirst?: boolean;
    rightElement?: React.ReactNode;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={onPress ? 0.65 : 1}
            style={[styles.settingsRow, !isFirst && styles.settingsRowBorder]}
        >
            <View style={styles.settingsRowLeft}>
                <View style={[styles.settingsRowIcon, { backgroundColor: iconBg }]}>{icon}</View>
                <View style={styles.settingsRowText}>
                    <Text style={[styles.settingsRowTitle, { color: titleColor }]} selectable>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.settingsRowSubtitle} selectable>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
            </View>
            {rightElement ??
                (showChevron && onPress ? (
                    <Ionicons name="chevron-forward" size={17} color="#cbd5e1" />
                ) : null)}
        </TouchableOpacity>
    );
}

// ✅ Account Deletion Modal with Password and Rate Limiting
function AccountDeletionModal({
    visible,
    onClose,
    onConfirm,
    isLoading,
    error,
    attemptsRemaining,
}: {
    visible: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    isLoading: boolean;
    error: string | null;
    attemptsRemaining: number;
}) {
    const [password, setPassword] = useState('');
    const inputRef = useRef<TextInput>(null);

    // ✅ Reset password when modal closes
    React.useEffect(() => {
        if (!visible) {
            setPassword('');
        }
    }, [visible]);

    const handleConfirm = () => {
        if (!password || password.length < 6) {
            Alert.alert('Error', 'Please enter your password to confirm account deletion.');
            return;
        }
        onConfirm(password);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContainer}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Delete Account</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <Ionicons name="close" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalBody}>
                                    <View style={styles.dangerIconContainer}>
                                        <MaterialIcons name="warning" size={48} color="#dc2626" />
                                    </View>

                                    <Text style={styles.modalWarningTitle}>Are you sure?</Text>
                                    <Text style={styles.modalWarningText}>
                                        This action will schedule your account for deletion in 7 days. During this time, you can cancel the request by logging in.
                                    </Text>

                                    <View style={styles.warningList}>
                                        <View style={styles.warningItem}>
                                            <MaterialIcons name="close" size={16} color="#dc2626" />
                                            <Text style={styles.warningItemText}>All your data will be permanently deleted</Text>
                                        </View>
                                        <View style={styles.warningItem}>
                                            <MaterialIcons name="close" size={16} color="#dc2626" />
                                            <Text style={styles.warningItemText}>You won't be able to recover your account</Text>
                                        </View>
                                        <View style={styles.warningItem}>
                                            <MaterialIcons name="close" size={16} color="#dc2626" />
                                            <Text style={styles.warningItemText}>You have 7 days to cancel the request</Text>
                                        </View>
                                    </View>

                                    <View style={styles.passwordInputContainer}>
                                        <Text style={styles.passwordLabel}>Confirm Password</Text>
                                        <TextInput
                                            ref={inputRef}
                                            style={[
                                                styles.passwordInput,
                                                error ? styles.passwordInputError : null,
                                            ]}
                                            placeholder="Enter your password"
                                            placeholderTextColor="#94a3b8"
                                            secureTextEntry
                                            value={password}
                                            onChangeText={setPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!isLoading && attemptsRemaining > 0}
                                        />
                                        {error ? (
                                            <Text style={styles.errorText}>{error}</Text>
                                        ) : null}
                                        {attemptsRemaining > 0 && attemptsRemaining < 10 ? (
                                            <Text style={styles.attemptsText}>
                                                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                                            </Text>
                                        ) : null}
                                        {attemptsRemaining === 0 ? (
                                            <Text style={styles.lockedText}>
                                                Too many failed attempts. Please try again in 24 hours.
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onClose}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.deleteButton,
                                        (isLoading || attemptsRemaining === 0) && styles.deleteButtonDisabled,
                                    ]}
                                    onPress={handleConfirm}
                                    disabled={isLoading || attemptsRemaining === 0}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.deleteButtonText}>Schedule Deletion</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

// ✅ Deletion Status Modal
function DeletionStatusModal({
    visible,
    onClose,
    deletionDate,
}: {
    visible: boolean;
    onClose: () => void;
    deletionDate: string | null;
}) {
    if (!deletionDate) return null;

    const deletionDateObj = new Date(deletionDate);
    const formattedDate = deletionDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = deletionDateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, styles.statusModalContent]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Account Deletion Scheduled</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <View style={styles.successIconContainer}>
                            <Ionicons name="checkmark-circle" size={56} color="#10b981" />
                        </View>

                        <Text style={styles.successTitle}>Deletion Scheduled</Text>
                        <Text style={styles.successText}>
                            Your account will be permanently deleted on:
                        </Text>

                        <View style={styles.deletionDateCard}>
                            <MaterialIcons name="calendar-today" size={20} color="#2563eb" />
                            <View>
                                <Text style={styles.deletionDateText}>{formattedDate}</Text>
                                <Text style={styles.deletionTimeText}>{formattedTime}</Text>
                            </View>
                        </View>

                        <View style={styles.cancelInfoContainer}>
                            <MaterialIcons name="info-outline" size={20} color="#64748b" />
                            <Text style={styles.cancelInfoText}>
                                You can cancel this request by logging in anytime before the deletion date.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
                            <Text style={styles.gotItButtonText}>Got It</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default function CustomerAccountSettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [showDeletionModal, setShowDeletionModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [deletionDate, setDeletionDate] = useState<string | null>(null);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [attemptsRemaining, setAttemptsRemaining] = useState<number>(10);

    const openURL = (url: string) => {
        Linking.openURL(url).catch(() =>
            Alert.alert('Cannot open link', 'Please visit ' + url + ' in your browser.')
        );
    };

    // ✅ Handle account deletion with password and rate limiting - FIXED
    const handleAccountDeletion = async (password: string) => {
        setIsLoading(true);
        setPasswordError(null);
        
        try {
            const token = await SecureStore.getItemAsync('token');
            if (!token) throw new Error('Not authenticated');

            const url = `${API_BASE_URL}/api/auth/delete-account`;
            console.log('📡 Sending request to:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ password }),
            });

            console.log('📥 Response status:', response.status);
            console.log('📥 Response headers:', response.headers.get('content-type'));

            // ✅ Check if response is HTML
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                console.error('❌ Received HTML instead of JSON. Endpoint might not exist.');
                Alert.alert(
                    'Error',
                    'The server endpoint is not available. Please contact support.',
                    [{ text: 'OK', onPress: () => {} }]
                );
                return;
            }

            // ✅ Parse JSON response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('❌ Failed to parse JSON:', parseError);
                // Try to get the raw text for debugging
                const text = await response.text();
                console.error('📄 Raw response:', text.substring(0, 200));
                Alert.alert(
                    'Error',
                    'Server returned an invalid response. Please try again later.',
                    [{ text: 'OK', onPress: () => {} }]
                );
                return;
            }

            console.log('📦 Response data:', data);

            if (!response.ok) {
                // ✅ Check for rate limiting error
                if (response.status === 429) {
                    setPasswordError(data.message || 'Too many attempts. Please try again in 24 hours.');
                    if (data.attemptsRemaining !== undefined) {
                        setAttemptsRemaining(data.attemptsRemaining);
                    }
                    return;
                }
                
                // ✅ Handle incorrect password
                if (data.message?.toLowerCase().includes('password') || data.message?.toLowerCase().includes('incorrect')) {
                    setPasswordError('Incorrect password. Please try again.');
                    if (data.attemptsRemaining !== undefined) {
                        setAttemptsRemaining(data.attemptsRemaining);
                    }
                    return;
                }
                
                throw new Error(data.message || 'Failed to schedule account deletion');
            }

            // ✅ Success - store deletion date
            if (data.deletionScheduledAt) {
                setDeletionDate(data.deletionScheduledAt);
            }

            // Reset attempts on success
            setAttemptsRemaining(10);
            setPasswordError(null);
            setShowDeletionModal(false);
            setShowStatusModal(true);

            // ✅ Logout after showing status
            setTimeout(async () => {
                await logout();
                router.replace('/login');
            }, 3000);
        } catch (error: any) {
            console.error('Account deletion error:', error);
            
            // ✅ Show a user-friendly error message
            if (error.message === 'Not authenticated') {
                Alert.alert('Session Expired', 'Please login again.');
                router.replace('/login');
            } else {
                Alert.alert(
                    'Error',
                    error.message || 'Failed to schedule account deletion. Please try again later.',
                    [{ text: 'OK', onPress: () => {} }]
                );
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ✅ Reset error when modal closes
    const handleCloseDeletionModal = () => {
        setShowDeletionModal(false);
        setPasswordError(null);
    };

    // ✅ Handle phone change (existing function)
    const handleRequestPhoneChange = async (newPhone: string) => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`${API_BASE_URL}/api/auth/request-phone-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ newPhoneNumber: newPhone, otp }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to verify phone change');
        }
    };

    return (
        <SafeAreaContainer style={styles.safeRoot} showBottomNav>
            <PageTitle
                title="Account & privacy"
                variant="mistri"
                leftElement={
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={28} color={DC.text} />
                    </Pressable>
                }
            />

            <ScrollView
                style={styles.scroll}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <SectionLabel label="ACCOUNT" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        onPress={() => setShowPhoneModal(true)}
                        icon={<MaterialIcons name="phone" size={19} color="#3b82f6" />}
                        iconBg="#eff6ff"
                        title="Phone number"
                        subtitle={user?.phoneNumber || 'Not set'}
                    />
                </SettingsCard>

                <SectionLabel label="LEGAL & PRIVACY" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        onPress={() => openURL(PRIVACY_POLICY_URL)}
                        icon={<MaterialIcons name="privacy-tip" size={19} color="#8b5cf6" />}
                        iconBg="#f5f3ff"
                        title="Privacy policy"
                        subtitle="How we collect and use your data"
                        rightElement={<Ionicons name="open-outline" size={16} color="#cbd5e1" />}
                    />
                    <SettingsRow
                        onPress={() => openURL(TERMS_URL)}
                        icon={<MaterialIcons name="description" size={19} color="#0ea5e9" />}
                        iconBg="#f0f9ff"
                        title="Terms of use"
                        subtitle="Rules for using ServeX"
                        rightElement={<Ionicons name="open-outline" size={16} color="#cbd5e1" />}
                    />
                </SettingsCard>

                <SectionLabel label="ABOUT" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        icon={<MaterialIcons name="info-outline" size={19} color="#64748b" />}
                        iconBg="#f8fafc"
                        title="ServeX"
                        subtitle="Book trusted home services"
                        showChevron={false}
                        rightElement={
                            <Text style={styles.versionText} selectable>
                                v1.0
                            </Text>
                        }
                    />
                </SettingsCard>

                <SectionLabel label="DATA MANAGEMENT" />
                <View style={styles.dangerCard}>
                    <TouchableOpacity
                        onPress={() => setShowDeletionModal(true)}
                        activeOpacity={0.65}
                        style={styles.dangerInner}
                    >
                        <View style={styles.dangerLeft}>
                            <View style={styles.dangerIconBox}>
                                <MaterialIcons name="person-remove" size={19} color="#dc2626" />
                            </View>
                            <View style={styles.dangerTextCol}>
                                <Text style={styles.dangerTitle} selectable>
                                    Delete account
                                </Text>
                                <Text style={styles.dangerSub} selectable>
                                    Permanently removes all your data after 7 days
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#fca5a5" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.footnote} selectable>
                    Account deletion is permanent and irreversible.{'\n'}
                    Your account will be deleted 7 days after confirmation.{'\n'}
                    You can cancel the deletion by logging in before then.{'\n'}
                    See our{' '}
                    <Text style={styles.footnoteLink} onPress={() => openURL(PRIVACY_POLICY_URL)}>
                        Privacy policy
                    </Text>
                    .
                </Text>
            </ScrollView>

            {/* Account Deletion Modal with Password */}
            <AccountDeletionModal
                visible={showDeletionModal}
                onClose={handleCloseDeletionModal}
                onConfirm={handleAccountDeletion}
                isLoading={isLoading}
                error={passwordError}
                attemptsRemaining={attemptsRemaining}
            />

            {/* Deletion Status Modal */}
            <DeletionStatusModal
                visible={showStatusModal}
                onClose={() => setShowStatusModal(false)}
                deletionDate={deletionDate}
            />

            {/* Phone Change Modal (existing) */}
            {/* You'll need to add the PhoneChangeModal component back here */}
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: DC.surface,
    },
    scroll: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 48,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: DC.muted,
        letterSpacing: 0.8,
        paddingHorizontal: 4,
        marginBottom: 8,
        marginTop: 4,
    },
    settingsCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        boxShadow: ELEV.card,
        marginBottom: 24,
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    settingsRowBorder: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    settingsRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
    },
    settingsRowIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsRowText: {
        flex: 1,
        gap: 1,
    },
    settingsRowTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    settingsRowSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 16,
    },
    versionText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    dangerCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        boxShadow: ELEV.card,
    },
    dangerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    dangerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
    },
    dangerIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        borderCurve: 'continuous',
        backgroundColor: '#fff1f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerTextCol: {
        flex: 1,
        gap: 1,
    },
    dangerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#dc2626',
    },
    dangerSub: {
        fontSize: 12,
        color: '#fca5a5',
        lineHeight: 16,
    },
    footnote: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 18,
        paddingHorizontal: 8,
    },
    footnoteLink: {
        color: '#64748b',
        fontWeight: '600',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 20,
    },
    statusModalContent: {
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    modalBody: {
        padding: 20,
        paddingBottom: 10,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    dangerIconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    modalWarningTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    modalWarningText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    warningList: {
        gap: 8,
        marginBottom: 20,
    },
    warningItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#fef2f2',
        padding: 10,
        borderRadius: 8,
    },
    warningItemText: {
        fontSize: 13,
        color: '#dc2626',
        flex: 1,
    },
    passwordInputContainer: {
        marginBottom: 8,
    },
    passwordLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
        marginBottom: 6,
    },
    passwordInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    passwordInputError: {
        borderColor: '#dc2626',
        backgroundColor: '#fef2f2',
    },
    errorText: {
        fontSize: 13,
        color: '#dc2626',
        marginTop: 6,
    },
    attemptsText: {
        fontSize: 12,
        color: '#f59e0b',
        marginTop: 4,
    },
    lockedText: {
        fontSize: 13,
        color: '#dc2626',
        marginTop: 4,
        fontWeight: '600',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748b',
    },
    deleteButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#dc2626',
    },
    deleteButtonDisabled: {
        opacity: 0.5,
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    successIconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    successText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16,
    },
    deletionDateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    deletionDateText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    deletionTimeText: {
        fontSize: 13,
        color: '#64748b',
    },
    cancelInfoContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
    },
    cancelInfoText: {
        flex: 1,
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    gotItButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#2563eb',
    },
    gotItButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});