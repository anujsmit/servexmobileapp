import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { PhoneChangeModal } from './PhoneChangeModal';
import { AccountDeletionModal } from './AccountDeletionModal';
import { ExpandableMapSelector } from './ExpandableMapSelector';
import { useLocation } from '../context/LocationContext';
import {
    customerBrand as B,
    customerDashboardColors as C,
    customerDashboardElevation as ELEV,
} from '../lib/customerDashboardTokens';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../lib/legalUrls';

export type CustomerProfileUser = {
    fullName: string;
    phoneNumber: string;
    role?: string;
};

export type CustomerProfileContentProps = {
    user: CustomerProfileUser;
    onUpdateProfile: (data: { fullName: string }) => Promise<void>;
    onRequestPhoneChange: (newPhone: string) => Promise<void>;
    onVerifyPhoneChange: (newPhone: string, otp: string) => Promise<void>;
    onLogout: () => Promise<void>;
    onRequestAccountDeletion?: () => Promise<void>;
    onVerifyAccountDeletion?: (otp: string) => Promise<void>;
    showLocationChange?: boolean;
    variant: 'modal' | 'screen';
    /** When `variant` is `modal`, pass `visible` so form state resets when the sheet opens. */
    visible?: boolean;
    onClose?: () => void;
    /** `screen` only: hide the large in-content title when an outer header is used. */
    showScreenHeader?: boolean;
    showLegalSection?: boolean;
    showLogoutSection?: boolean;
};

export function CustomerProfileContent({
    user,
    onUpdateProfile,
    onRequestPhoneChange,
    onVerifyPhoneChange,
    onLogout,
    onRequestAccountDeletion,
    onVerifyAccountDeletion,
    showLocationChange = false,
    variant,
    visible,
    onClose,
    showScreenHeader = true,
    showLegalSection = true,
    showLogoutSection = true,
}: CustomerProfileContentProps) {
    const { setCustomLocation, coordinates } = useLocation();
    const [isEditing, setIsEditing] = useState(false);
    const [showPhoneChangeModal, setShowPhoneChangeModal] = useState(false);
    const [showAccountDeletionModal, setShowAccountDeletionModal] = useState(false);
    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const [fullName, setFullName] = useState(user.fullName);
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (variant === 'modal' && visible === false) return;
        setFullName(user.fullName);
        setIsEditing(false);
    }, [variant, visible, user.fullName, user.phoneNumber]);

    const handleSaveProfile = async () => {
        if (!fullName.trim()) {
            Alert.alert('Error', 'Name cannot be empty');
            return;
        }

        try {
            setIsLoading(true);
            await onUpdateProfile({ fullName: fullName.trim() });
            setIsEditing(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setFullName(user.fullName);
        setIsEditing(false);
    };

    const handleLogoutPress = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await onLogout();
                    onClose?.();
                },
            },
        ]);
    };

    const handleOpenLink = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Unable to open link. Please try again.');
        }
    };

    const getInitials = (name: string) =>
        name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

    return (
        <View style={styles.root}>
            {variant === 'modal' ? <StatusBar style="dark" /> : null}

            {variant === 'modal' ? (
                <View style={styles.modalHeader}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialIcons name="close" size={28} color={C.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalHeaderTitle} selectable>
                        Profile
                    </Text>
                    <View style={styles.headerPlaceholder} />
                </View>
            ) : showScreenHeader ? (
                <View style={styles.screenTitleRow}>
                    <Text style={styles.screenTitle} selectable>
                        Profile
                    </Text>
                </View>
            ) : null}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollInner}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.avatarSection}>
                    <View style={[styles.avatar, { backgroundColor: B.accent, boxShadow: ELEV.card }]}>
                        <Text style={styles.avatarText} selectable>
                            {getInitials(user.fullName)}
                        </Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: B.accentSoft }]}>
                        <Text style={[styles.roleBadgeText, { color: B.accent }]} selectable>
                            {user.role === 'mistri' ? 'Mistri' : 'Customer'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.cardBlock, { boxShadow: ELEV.card }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.headerSectionTitle} selectable>
                            Personal information
                        </Text>
                        {!isEditing ? (
                            <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={8}>
                                <MaterialIcons name="edit" size={20} color={B.accent} />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.label} selectable>
                            Full name
                        </Text>
                        {isEditing ? (
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Enter your name"
                                autoFocus
                            />
                        ) : (
                            <Text style={styles.value} selectable>
                                {user.fullName}
                            </Text>
                        )}
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.label} selectable>
                            Phone number
                        </Text>
                        <View style={styles.phoneRow}>
                            <Text style={styles.value} selectable>
                                {user.phoneNumber}
                            </Text>
                            {!isEditing ? (
                                <TouchableOpacity
                                    onPress={() => setShowPhoneChangeModal(true)}
                                    style={[styles.changeButton, { backgroundColor: B.accentSoft }]}
                                >
                                    <Text style={[styles.changeButtonText, { color: B.accent }]} selectable>
                                        Change
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.infoRowLast}>
                        <Text style={styles.label} selectable>
                            Account type
                        </Text>
                        <Text style={styles.value} selectable>
                            {user.role === 'mistri' ? 'Service provider' : 'Customer'}
                        </Text>
                    </View>
                </View>

                {showLocationChange ? (
                    <View style={[styles.cardBlock, { boxShadow: ELEV.card }]}>
                        <Text style={styles.sectionTitle} selectable>
                            Location
                        </Text>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => setShowLocationSelector(true)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.settingIconContainer, { backgroundColor: B.accentSoft }]}>
                                <MaterialIcons name="location-on" size={18} color={B.accent} />
                            </View>
                            <Text style={styles.settingLabel} selectable>
                                Change location
                            </Text>
                            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                {showLegalSection ? (
                    <View style={[styles.cardBlock, { boxShadow: ELEV.card }]}>
                        <Text style={styles.sectionTitle} selectable>
                            Legal
                        </Text>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => handleOpenLink(PRIVACY_POLICY_URL)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingIconContainer}>
                                <MaterialIcons name="privacy-tip" size={18} color="#dc2626" />
                            </View>
                            <Text style={styles.settingLabel} selectable>
                                Privacy policy
                            </Text>
                            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.settingItemLast}
                            onPress={() => handleOpenLink(TERMS_URL)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingIconContainer}>
                                <MaterialIcons name="description" size={18} color="#dc2626" />
                            </View>
                            <Text style={styles.settingLabel} selectable>
                                Terms of use
                            </Text>
                            <MaterialIcons name="chevron-right" size={20} color={C.muted} />
                        </TouchableOpacity>
                    </View>
                ) : null}

                {showLogoutSection ? (
                    <View style={styles.logoutSection}>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleLogoutPress}
                            disabled={isEditing}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="logout" size={20} color="#ffffff" />
                            <Text style={styles.logoutButtonText} selectable>
                                Logout
                            </Text>
                        </TouchableOpacity>

                        {onRequestAccountDeletion && onVerifyAccountDeletion ? (
                            <TouchableOpacity
                                style={styles.deleteAccountButton}
                                onPress={() => setShowAccountDeletionModal(true)}
                                disabled={isEditing}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="delete-forever" size={20} color="#dc2626" />
                                <Text style={styles.deleteAccountButtonText} selectable>
                                    Delete account
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : null}
            </ScrollView>

            <PhoneChangeModal
                visible={showPhoneChangeModal}
                onClose={() => setShowPhoneChangeModal(false)}
                currentPhone={user.phoneNumber}
                onRequestOtp={onRequestPhoneChange}
                onVerifyOtp={onVerifyPhoneChange}
            />

            {onRequestAccountDeletion && onVerifyAccountDeletion ? (
                <AccountDeletionModal
                    visible={showAccountDeletionModal}
                    onClose={() => setShowAccountDeletionModal(false)}
                    phoneNumber={user.phoneNumber}
                    onRequestOtp={onRequestAccountDeletion}
                    onVerifyOtp={onVerifyAccountDeletion}
                />
            ) : null}

            {showLocationChange ? (
                <ExpandableMapSelector
                    visible={showLocationSelector}
                    onClose={() => setShowLocationSelector(false)}
                    onConfirm={async loc => {
                        await setCustomLocation(loc);
                    }}
                    initialLocation={coordinates}
                    accentColor={B.accent}
                />
            ) : null}

            {isEditing ? (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancel}
                        disabled={isLoading}
                    >
                        <Text style={styles.cancelButtonText} selectable>
                            Cancel
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSaveProfile}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText} selectable>
                                Save changes
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: C.surface,
        borderBottomWidth: 0,
        boxShadow: ELEV.header,
    },
    modalHeaderTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.3,
    },
    closeButton: {
        padding: 4,
    },
    headerPlaceholder: {
        width: 36,
    },
    screenTitleRow: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: C.surface,
        boxShadow: ELEV.header,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: C.text,
        letterSpacing: -0.6,
    },
    scroll: {
        flex: 1,
    },
    scrollInner: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 14,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: C.surfaceMuted,
        borderRadius: 16,
        borderCurve: 'continuous',
        marginTop: 14,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 34,
        fontWeight: '700',
        color: '#ffffff',
    },
    roleBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderCurve: 'continuous',
    },
    roleBadgeText: {
        fontSize: 13,
        fontWeight: '700',
    },
    cardBlock: {
        backgroundColor: C.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.25,
        marginBottom: 12,
    },
    infoRow: {
        marginBottom: 16,
    },
    infoRowLast: {
        marginBottom: 0,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: C.muted,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    value: {
        fontSize: 16,
        color: C.text,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e4e4e7',
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 12,
        fontSize: 16,
        color: C.text,
        backgroundColor: C.surfaceMuted,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    changeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderCurve: 'continuous',
    },
    changeButtonText: {
        fontSize: 13,
        fontWeight: '700',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        backgroundColor: C.surfaceMuted,
        borderRadius: 12,
        borderCurve: 'continuous',
        marginBottom: 10,
        gap: 12,
    },
    settingItemLast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        backgroundColor: C.surfaceMuted,
        borderRadius: 12,
        borderCurve: 'continuous',
        gap: 12,
    },
    settingIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: '#fee2e2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: C.text,
    },
    logoutSection: {
        paddingTop: 4,
        gap: 12,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#52525b',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderCurve: 'continuous',
        gap: 8,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef2f2',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderCurve: 'continuous',
        gap: 8,
        borderWidth: 2,
        borderColor: '#dc2626',
    },
    deleteAccountButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#dc2626',
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#e4e4e7',
        backgroundColor: C.surface,
        boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
    },
    saveButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: '#16a34a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
    },
});
