import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { useCustomerRequestsQuery } from '../../../hooks/queries';
import { useAuth } from '../../../context/AuthContext';
import {
    customerBrand as B,
    customerDashboardColors as DC,
    customerDashboardElevation as ELEV,
} from '../../../lib/customerDashboardTokens';

function SectionLabel({ label }: { label: string }) {
    return <Text style={styles.sectionLabel}>{label}</Text>;
}

export default function CustomerSettingsScreen() {
    const router = useRouter();
    const { user, logout } = useAuth();
    const { data: requests = [], isLoading: requestsLoading } = useCustomerRequestsQuery();
    const completedCount = requests.filter((r: { status?: string }) => r.status === 'completed').length;

    const openPersonalInfo = () => {
        router.push('/(protected)/(customer)/personal-info');
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    router.replace('/login');
                },
            },
        ]);
    };

    const getInitials = (name: string) =>
        name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

    if (!user) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Settings"
                    subtitle="Account, bookings & preferences"
                />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={B.accent} />
                    <Text style={styles.loadingText}>Loading…</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer showBottomNav>
            <PageTitle
                title="Settings"
                subtitle="Account, bookings & preferences"
            />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={openPersonalInfo}
                    activeOpacity={0.72}
                >
                    <View style={styles.profileCardInner}>
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarInitials}>{getInitials(user.fullName)}</Text>
                        </View>
                        <View style={styles.profileCardText}>
                            <Text style={styles.profileName} numberOfLines={1} selectable>
                                {user.fullName || 'Your name'}
                            </Text>
                            <View style={[styles.serviceBadge, { borderColor: `${B.accent}55` }]}>
                                <MaterialIcons name="verified" size={14} color={B.accent} />
                                <Text style={[styles.serviceBadgeText, { color: B.accent }]} selectable>
                                    Customer
                                </Text>
                            </View>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    {requestsLoading ? (
                                        <Text style={[styles.statValue, { color: DC.muted }]}>…</Text>
                                    ) : (
                                        <Text style={styles.statValue} selectable>
                                            {requests.length}
                                        </Text>
                                    )}
                                    <Text style={styles.statCaption} selectable>
                                        Requests
                                    </Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    {requestsLoading ? (
                                        <Text style={[styles.statValue, { color: DC.muted }]}>…</Text>
                                    ) : (
                                        <Text style={styles.statValue} selectable>
                                            {completedCount}
                                        </Text>
                                    )}
                                    <Text style={styles.statCaption} selectable>
                                        Completed
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={DC.muted} />
                    </View>
                    {/* <Text style={styles.profileHint} selectable>
                        Tap to edit name, phone & location
                    </Text> */}
                </TouchableOpacity>

                <View style={styles.card}>
                    <SettingsRow
                        icon={<MaterialIcons name="person" size={20} color={B.accent} />}
                        iconBg={B.accentSoft}
                        title="Personal information"
                        subtitle="Name, phone & service location"
                        onPress={openPersonalInfo}
                    />
                    <SettingsRow
                        icon={<MaterialIcons name="list-alt" size={20} color={DC.text} />}
                        iconBg={DC.surfaceMuted}
                        title="My requests"
                        subtitle="Track bookings"
                        onPress={() => router.push('/(protected)/(customer)/requests')}
                        isLast
                    />
                </View>

                <SectionLabel label="ACCOUNT" />
                <View style={styles.card}>
                    <SettingsRow
                        icon={<MaterialIcons name="privacy-tip" size={20} color="#8b5cf6" />}
                        iconBg="#f5f3ff"
                        title="Account, privacy & data"
                        subtitle="Phone, legal & delete account"
                        onPress={() => router.push('/(protected)/(customer)/account-settings')}
                    />
                    <SettingsRow
                        icon={<MaterialIcons name="logout" size={20} color="#ef4444" />}
                        iconBg="#fef2f2"
                        title="Logout"
                        subtitle="Sign out of this device"
                        onPress={handleLogout}
                        titleColor="#ef4444"
                        chevronColor="#fca5a5"
                        isLast
                    />
                </View>
            </ScrollView>
        </SafeAreaContainer>
    );
}

function SettingsRow({
    icon,
    iconBg,
    title,
    subtitle,
    onPress,
    isLast,
    titleColor = DC.text,
    chevronColor = '#cbd5e1',
}: {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    subtitle: string;
    onPress: () => void;
    isLast?: boolean;
    titleColor?: string;
    chevronColor?: string;
}) {
    return (
        <TouchableOpacity
            style={[styles.row, !isLast && styles.rowBorder]}
            onPress={onPress}
            activeOpacity={0.65}
        >
            <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>{icon}</View>
                <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: titleColor }]} selectable>
                        {title}
                    </Text>
                    <Text style={styles.rowSubtitle} selectable>
                        {subtitle}
                    </Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={chevronColor} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: DC.canvas,
    },
    loadingText: {
        fontSize: 14,
        color: DC.muted,
        fontWeight: '500',
    },
    scroll: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 32,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: DC.muted,
        letterSpacing: 0.8,
        marginBottom: 4,
        marginTop: 20,
        paddingHorizontal: 4,
    },
    profileCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
        marginBottom: 14,
        boxShadow: ELEV.card,
    },
    profileCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    avatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholder: {
        backgroundColor: DC.surfaceMuted,
    },
    avatarInitials: {
        fontSize: 26,
        fontWeight: '800',
        color: B.accent,
    },
    profileCardText: {
        flex: 1,
        minWidth: 0,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: DC.text,
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    serviceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderCurve: 'continuous',
        backgroundColor: DC.surfaceMuted,
        borderWidth: 1,
        marginBottom: 10,
    },
    serviceBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flex: 1,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: DC.text,
        fontVariant: ['tabular-nums'],
    },
    statCaption: {
        fontSize: 10,
        fontWeight: '700',
        color: DC.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
        marginHorizontal: 12,
    },
    profileHint: {
        fontSize: 12,
        color: DC.muted,
        marginTop: 12,
        textAlign: 'center',
    },
    card: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        boxShadow: ELEV.card,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(15, 23, 42, 0.08)',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flex: 1,
    },
    rowIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    rowTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    rowSubtitle: {
        fontSize: 12,
        color: DC.muted,
    },
});
