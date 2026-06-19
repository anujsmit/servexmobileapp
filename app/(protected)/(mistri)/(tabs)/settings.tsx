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
import { Image } from 'expo-image';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { RatingStars } from '../../../../components/RatingStars';
import { useMistriProfileQuery } from '../../../../hooks/queries';
import { useAuth } from '../../../../context/AuthContext';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../../lib/mistriDashboardTokens';

function SectionLabel({ label }: { label: string }) {
    return (
        <Text style={styles.sectionLabel}>{label}</Text>
    );
}

export default function MistriSettingsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const { user, logout } = useAuth();
    const { data: profile, isLoading } = useMistriProfileQuery();

    const serviceLabel =
        profile?.serviceName?.charAt(0).toUpperCase() + (profile?.serviceName?.slice(1) || '') ||
        'Service';
    const avgRating =
        profile?.averageRating != null && Number(profile.averageRating) > 0
            ? Number(profile.averageRating).toFixed(1)
            : null;

    const openEditProfile = () => {
        router.push('/(protected)/(mistri)/edit-profile');
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

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Settings" variant="mistri" />
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading…</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle title="Settings" variant="mistri" />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    style={styles.profileCard}
                    onPress={openEditProfile}
                    activeOpacity={0.72}
                >
                    <View style={styles.profileCardInner}>
                        {profile?.profilePhotoUrl ? (
                            <Image
                                source={{ uri: profile.profilePhotoUrl }}
                                style={styles.avatar}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <MaterialIcons name="person" size={36} color={DC.muted} />
                            </View>
                        )}
                        <View style={styles.profileCardText}>
                            <Text style={styles.profileName} numberOfLines={1}>
                                {profile?.fullName || user?.fullName || 'Your name'}
                            </Text>
                            <View style={[styles.serviceBadge, { borderColor: `${trade.accent}55` }]}>
                                <MaterialIcons name="verified" size={14} color={trade.accent} />
                                <Text style={[styles.serviceBadgeText, { color: trade.accent }]}>
                                    {serviceLabel}
                                </Text>
                            </View>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    {avgRating ? (
                                        <>
                                            <View style={styles.statTop}>
                                                <Text style={styles.statValue}>{avgRating}</Text>
                                                <RatingStars
                                                    rating={Number(avgRating)}
                                                    size={12}
                                                    color={trade.accent}
                                                />
                                            </View>
                                            <Text style={styles.statCaption}>Rating</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={[styles.statValue, { color: DC.muted }]}>—</Text>
                                            <Text style={styles.statCaption}>Rating</Text>
                                        </>
                                    )}
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{profile?.jobsCompleted ?? 0}</Text>
                                    <Text style={styles.statCaption}>Jobs done</Text>
                                </View>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={DC.muted} />
                    </View>
                    <Text style={styles.profileHint}>Tap to edit profile & availability</Text>
                </TouchableOpacity>

                <View style={styles.card}>
                    <SettingsRow
                        icon={<MaterialIcons name="edit" size={20} color={trade.accent} />}
                        iconBg={trade.accentSoft}
                        title="Edit profile"
                        subtitle="Photo, bio, service & location"
                        onPress={openEditProfile}
                    />
                    <SettingsRow
                        icon={<MaterialIcons name="trending-up" size={20} color={trade.accent} />}
                        iconBg={trade.accentSoft}
                        title="Earnings"
                        subtitle="Income and payouts"
                        onPress={() => router.push('/(protected)/(mistri)/earnings')}
                    />
                    <SettingsRow
                        icon={<MaterialIcons name="star" size={20} color="#f59e0b" />}
                        iconBg="#fef3c7"
                        title="Reviews"
                        subtitle="Customer feedback"
                        onPress={() => router.push('/(protected)/(mistri)/(tabs)/reviews')}
                    />
                    <SettingsRow
                        icon={<MaterialIcons name="work-outline" size={20} color={DC.text} />}
                        iconBg={DC.surfaceMuted}
                        title="My jobs"
                        subtitle="Accepted work"
                        onPress={() => router.push('/(protected)/(mistri)/(tabs)/my-jobs')}
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
                        onPress={() => router.push('/(protected)/(mistri)/account-settings')}
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
                    <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
                    <Text style={styles.rowSubtitle}>{subtitle}</Text>
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
        boxShadow: MISTRI_ELEV.card,
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
    },
    avatarPlaceholder: {
        backgroundColor: DC.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
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
    statTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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
        boxShadow: MISTRI_ELEV.card,
        marginBottom: 0,
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
