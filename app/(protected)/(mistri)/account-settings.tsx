import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Linking,
    ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../context/AuthContext';
import { AccountDeletionModal } from '../../../components/AccountDeletionModal';
import { PhoneChangeModal } from '../../../components/PhoneChangeModal';
import { API_BASE_URL } from '../../../lib/config';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../../../lib/legalUrls';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';

function SectionLabel({ label }: { label: string }) {
    return (
        <Text style={{
            fontSize: 11, fontWeight: '700', color: DC.muted,
            letterSpacing: 0.8, paddingHorizontal: 4,
            marginBottom: 8, marginTop: 4,
        }}>
            {label}
        </Text>
    );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <View style={{
            backgroundColor: DC.surface,
            borderRadius: 16, borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: MISTRI_ELEV.card,
            marginBottom: 24,
        }}>
            {children}
        </View>
    );
}

function SettingsRow({
    icon,
    iconBg,
    iconColor,
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
    iconColor?: string;
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
            style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 14,
                borderTopWidth: isFirst ? 0 : 1, borderTopColor: '#f1f5f9',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View style={{
                    width: 38, height: 38, borderRadius: 10, borderCurve: 'continuous',
                    backgroundColor: iconBg,
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    {icon}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: titleColor }}>{title}</Text>
                    {subtitle ? (
                        <Text style={{ fontSize: 12, color: '#94a3b8', lineHeight: 16 }}>{subtitle}</Text>
                    ) : null}
                </View>
            </View>
            {rightElement ?? (showChevron && onPress ? (
                <Ionicons name="chevron-forward" size={17} color="#cbd5e1" />
            ) : null)}
        </TouchableOpacity>
    );
}

export default function AccountSettings() {
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ newPhoneNumber: newPhone, otp }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to verify phone change');
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: DC.canvas }}>
            <StatusBar style="dark" />
            <Stack.Screen
                options={{
                    title: 'Account & Privacy',
                    headerBackTitle: 'Settings',
                    headerShown: true,
                    headerStyle: { backgroundColor: DC.canvas },
                    headerShadowVisible: false,
                    headerTitleStyle: { fontSize: 17, fontWeight: '700', color: DC.text },
                    headerTintColor: DC.text,
                }}
            />

            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 }}
            >
                {/* Account section */}
                <SectionLabel label="ACCOUNT" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        onPress={() => setShowPhoneModal(true)}
                        icon={<MaterialIcons name="phone" size={19} color="#3b82f6" />}
                        iconBg="#eff6ff"
                        title="Phone Number"
                        subtitle={user?.phoneNumber || 'Not set'}
                    />
                </SettingsCard>

                {/* Legal section */}
                <SectionLabel label="LEGAL & PRIVACY" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        onPress={() => openURL(PRIVACY_POLICY_URL)}
                        icon={<MaterialIcons name="privacy-tip" size={19} color="#8b5cf6" />}
                        iconBg="#f5f3ff"
                        title="Privacy Policy"
                        subtitle="How we collect and use your data"
                        rightElement={
                            <Ionicons name="open-outline" size={16} color="#cbd5e1" />
                        }
                    />
                    <SettingsRow
                        onPress={() => openURL(TERMS_URL)}
                        icon={<MaterialIcons name="description" size={19} color="#0ea5e9" />}
                        iconBg="#f0f9ff"
                        title="Terms of Service"
                        subtitle="Rules and conditions for using Mistri"
                        rightElement={
                            <Ionicons name="open-outline" size={16} color="#cbd5e1" />
                        }
                    />
                </SettingsCard>

                {/* About section */}
                <SectionLabel label="ABOUT" />
                <SettingsCard>
                    <SettingsRow
                        isFirst
                        icon={<MaterialIcons name="info-outline" size={19} color="#64748b" />}
                        iconBg="#f8fafc"
                        title="Mistri"
                        subtitle="Service provider platform"
                        showChevron={false}
                        rightElement={
                            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '500' }}>v1.0</Text>
                        }
                    />
                </SettingsCard>

                {/* Data management — delete is deliberately last and understated */}
                <SectionLabel label="DATA MANAGEMENT" />
                <View style={{
                    backgroundColor: DC.surface,
                    borderRadius: 16, borderCurve: 'continuous',
                    overflow: 'hidden',
                    boxShadow: MISTRI_ELEV.card,
                }}>
                    <TouchableOpacity
                        onPress={() => setShowDeletionModal(true)}
                        activeOpacity={0.65}
                        style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                            paddingHorizontal: 16, paddingVertical: 14,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                            <View style={{
                                width: 38, height: 38, borderRadius: 10, borderCurve: 'continuous',
                                backgroundColor: '#fff1f1',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <MaterialIcons name="person-remove" size={19} color="#dc2626" />
                            </View>
                            <View style={{ flex: 1, gap: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#dc2626' }}>Delete Account</Text>
                                <Text style={{ fontSize: 12, color: '#fca5a5', lineHeight: 16 }}>
                                    Permanently removes all your data
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={17} color="#fca5a5" />
                    </TouchableOpacity>
                </View>

                {/* Footnote */}
                <Text style={{
                    fontSize: 12, color: '#94a3b8', textAlign: 'center',
                    marginTop: 20, lineHeight: 18, paddingHorizontal: 8,
                }}>
                    Account deletion is permanent and irreversible.{'\n'}
                    Your data will be removed in accordance with our{' '}
                    <Text
                        style={{ color: '#64748b', fontWeight: '600' }}
                        onPress={() => openURL(PRIVACY_POLICY_URL)}
                    >
                        Privacy Policy
                    </Text>.
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
        </View>
    );
}
