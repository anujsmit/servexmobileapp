import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Linking,
    ScrollView,
    Pressable,
    StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { useAuth } from '../../../context/AuthContext';
import { AccountDeletionModal } from '../../../components/AccountDeletionModal';
import { PhoneChangeModal } from '../../../components/PhoneChangeModal';
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

export default function CustomerAccountSettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const [showDeletionModal, setShowDeletionModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);

    const openURL = (url: string) => {
        Linking.openURL(url).catch(() =>
            Alert.alert('Cannot open link', 'Please visit ' + url + ' in your browser.')
        );
    };

    const handleRequestAccountDeletion = async () => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`${API_BASE_URL}/api/auth/request-account-deletion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to request account deletion');
        }
    };

    const handleVerifyAccountDeletion = async (otp: string) => {
        const token = await SecureStore.getItemAsync('token');
        if (!token) throw new Error('Not authenticated');
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-account-deletion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ otp }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete account');
        }
        setShowDeletionModal(false);
        await logout();
        router.replace('/login');
    };

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
                        subtitle="Rules for using Mistri"
                        rightElement={<Ionicons name="open-outline" size={16} color="#cbd5e1" />}
                    />
                </SettingsCard>

                <SectionLabel label="ABOUT" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        icon={<MaterialIcons name="info-outline" size={19} color="#64748b" />}
                        iconBg="#f8fafc"
                        title="Mistri"
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
                                    Permanently removes all your data
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#fca5a5" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.footnote} selectable>
                    Account deletion is permanent and irreversible.{'\n'}
                    Your data will be removed in accordance with our{' '}
                    <Text style={styles.footnoteLink} onPress={() => openURL(PRIVACY_POLICY_URL)}>
                        Privacy policy
                    </Text>
                    .
                </Text>
            </ScrollView>

            <AccountDeletionModal
                visible={showDeletionModal}
                onClose={() => setShowDeletionModal(false)}
                phoneNumber={user?.phoneNumber || ''}
                onRequestOtp={handleRequestAccountDeletion}
                onVerifyOtp={handleVerifyAccountDeletion}
            />

            <PhoneChangeModal
                visible={showPhoneModal}
                onClose={() => setShowPhoneModal(false)}
                currentPhone={user?.phoneNumber || ''}
                onRequestOtp={handleRequestPhoneChange}
                onVerifyOtp={handleVerifyPhoneChange}
            />
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
});
