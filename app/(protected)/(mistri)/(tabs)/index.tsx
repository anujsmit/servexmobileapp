import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Image,
    useWindowDimensions,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar, setStatusBarBackgroundColor, setStatusBarTranslucent } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { MistriDashboardCharts } from '../../../../components/mistri-dashboard-charts';
import * as Location from 'expo-location';
import { useAuth } from '../../../../context/AuthContext';
import { useLocation } from '../../../../context/LocationContext';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
    useMistriJobsQuery,
    useMistriProfileQuery,
    useMistriAcceptedJobsQuery,
    useUpdateMistriProfile,
    type MistriJob,
} from '../../../../hooks/queries';
import { useUIStore } from '../../../../store/useUIStore';
import { RatingStars } from '../../../../components/RatingStars';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as C,
    mistriDashboardElevation as ELEV,
} from '../../../../lib/mistriDashboardTokens';

type Coordinates = { latitude: number; longitude: number };

const parseCoordinates = (value?: string | null): Coordinates | null => {
    if (!value) return null;
    const [lat, lng] = value.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
    }
    return null;
};

const haversineDistanceKm = (a: Coordinates, b: Coordinates): number => {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

const addressCache = new Map<string, string>();
const coordsKey = (coords: Coordinates) => `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;

const resolveAddressLabel = async (coords: Coordinates): Promise<string> => {
    const key = coordsKey(coords);
    const cached = addressCache.get(key);
    if (cached) return cached;
    try {
        const result = await Location.reverseGeocodeAsync(coords);
        if (result.length > 0) {
            const { name, street, city, region, country } = result[0];
            const label = [name || street, city || region, country].filter(Boolean).join(', ');
            if (label) addressCache.set(key, label);
            return label;
        }
    } catch (error) {
        if (__DEV__) console.log('reverse geocode failed', error);
    }
    const fallback = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    addressCache.set(key, fallback);
    return fallback;
};

const LOCATION_CHANGE_THRESHOLD_KM = 0.5;
const LOCATION_COORDS_THRESHOLD_KM = 0.05;

const STATUS_LABEL_SHORT: Record<MistriJob['status'], string> = {
    assigned: 'Asgn',
    pending: 'Wait',
    completed: 'Done',
    canceled: 'Off',
};

export default function MistriDashboard() {
    const insets = useSafeAreaInsets();
    const trade = useMistriTradeTheme();
    const tradeStyles = useMemo(
        () => ({
            avatar: {
                backgroundColor: trade.accent,
                boxShadow: `0 6px 18px rgba(${trade.accentRgb}, 0.28), 0 2px 6px rgba(15, 23, 42, 0.06)`,
            },
            accentSoftFill: { backgroundColor: trade.accentSoft },
            seeAll: { color: trade.accent },
        }),
        [trade.accent, trade.accentSoft, trade.accentRgb]
    );

    const { user } = useAuth();
    const {
        address: deviceAddress,
        coordinates: deviceCoords,
        isLoading: locationLoading,
    } = useLocation();
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const chartWidth = Math.max(280, windowWidth - 32);

    // React Query for mistri profile (fetch first to determine polling status)
    const { data: profile, isLoading: isProfileLoading } = useMistriProfileQuery();

    // Only poll when mistri is available (not unavailable or on_work)
    const shouldPoll = profile?.availabilityStatus === 'available';

    // React Query for available jobs
    const { data: jobs = [], isFetching: isJobsLoading } = useMistriJobsQuery();

    // React Query for accepted jobs (disable polling when unavailable/on_work)
    const { data: acceptedJobs = [], isFetching: isAcceptedJobsLoading } = useMistriAcceptedJobsQuery({ enablePolling: shouldPoll });

    // UI state for toggling jobs panel
    const isJobsPanelOpen = useUIStore(state => state.isMistriPanelOpen);

    // Mutation for updating profile
    const updateProfileMutation = useUpdateMistriProfile();
    const [serviceCoords, setServiceCoords] = useState<Coordinates | null>(null);
    const [serviceAddress, setServiceAddress] = useState<string>('');
    const [isResolvingServiceAddress, setIsResolvingServiceAddress] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [hasPromptedLocationChange, setHasPromptedLocationChange] = useState(false);
    const lastResolvedCoords = useRef<Coordinates | null>(null);
    const lastDeviceCoords = useRef<Coordinates | null>(null);
    const hasDeviceMovedSignificantly = useRef(false);

    const { statusLabels, statusData } = useMemo(() => {
        const order: MistriJob['status'][] = ['assigned', 'pending', 'completed', 'canceled'];
        const counts: Partial<Record<MistriJob['status'], number>> = {};
        for (const j of acceptedJobs) {
            counts[j.status] = (counts[j.status] ?? 0) + 1;
        }
        const present = order.filter((k) => (counts[k] ?? 0) > 0);
        return {
            statusLabels: present.map((s) => STATUS_LABEL_SHORT[s]),
            statusData: present.map((s) => counts[s] ?? 0),
        };
    }, [acceptedJobs]);

    const chartsLoading = isJobsLoading || isAcceptedJobsLoading || isProfileLoading;
    const jobsDoneCount = profile?.jobsCompleted ?? 0;

    useEffect(() => {
        const coords = parseCoordinates(profile?.currentLocation);
        const nextCoords = coords || deviceCoords || null;
        if (!nextCoords) return;
        if (serviceCoords) {
            const deltaKm = haversineDistanceKm(serviceCoords, nextCoords);
            if (deltaKm < LOCATION_COORDS_THRESHOLD_KM) return;
        }
        setServiceCoords(nextCoords);
    }, [profile?.currentLocation, deviceCoords, serviceCoords]);

    useEffect(() => {
        let isActive = true;
        if (!serviceCoords) {
            setServiceAddress('');
            return;
        }
        if (deviceCoords && deviceAddress) {
            const deltaKm = haversineDistanceKm(serviceCoords, deviceCoords);
            if (deltaKm < LOCATION_COORDS_THRESHOLD_KM) {
                setServiceAddress(deviceAddress);
                lastResolvedCoords.current = serviceCoords;
                return;
            }
        }
        if (lastResolvedCoords.current) {
            const deltaKm = haversineDistanceKm(lastResolvedCoords.current, serviceCoords);
            if (deltaKm < LOCATION_COORDS_THRESHOLD_KM) return;
        }
        setIsResolvingServiceAddress(true);
        resolveAddressLabel(serviceCoords)
            .then(label => {
                if (isActive) setServiceAddress(label);
            })
            .catch(() => {
                if (isActive) setServiceAddress('');
            })
            .finally(() => {
                if (isActive) setIsResolvingServiceAddress(false);
            });
        lastResolvedCoords.current = serviceCoords;
        return () => { isActive = false; };
    }, [serviceCoords, deviceCoords, deviceAddress]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const quickActions = [
        {
            id: 1,
            title: 'Available jobs',
            subtitle: 'Browse and accept work',
            icon: 'search' as const,
            onPress: () => router.push('/(protected)/(mistri)/(tabs)/requests'),
        },
        {
            id: 2,
            title: 'Earnings',
            subtitle: 'Income and payouts',
            icon: 'trending-up' as const,
            onPress: () => router.push('/(protected)/(mistri)/earnings'),
        },
    ];

    const persistServiceLocation = async (coords: Coordinates) => {
        try {
            await updateProfileMutation.mutateAsync({
                currentLocation: `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`,
            });
            setServiceCoords(coords);
            const label = await resolveAddressLabel(coords);
            setServiceAddress(label);
            Alert.alert('Location updated', 'Your service location has been updated.');
        } catch (error: any) {
            Alert.alert('Update failed', error?.message || 'Could not update location. Please try again.');
        }
    };

    const handleManualLocationConfirm = async (coords: Coordinates) => {
        await persistServiceLocation(coords);
        setHasPromptedLocationChange(false);
        hasDeviceMovedSignificantly.current = false;
    };

    const handleUseDetectedLocation = async (coords: Coordinates) => {
        await persistServiceLocation(coords);
        setHasPromptedLocationChange(false);
        hasDeviceMovedSignificantly.current = false;
    };

    useEffect(() => {
        if (!deviceCoords) return;
        if (lastDeviceCoords.current) {
            const deltaKm = haversineDistanceKm(lastDeviceCoords.current, deviceCoords);
            if (deltaKm >= LOCATION_CHANGE_THRESHOLD_KM) {
                hasDeviceMovedSignificantly.current = true;
            }
        }
        lastDeviceCoords.current = deviceCoords;
    }, [deviceCoords]);

    useEffect(() => {
        if (locationLoading || hasPromptedLocationChange || !deviceCoords || !profile?.currentLocation) return;
        const savedCoords = parseCoordinates(profile.currentLocation);
        if (!savedCoords) return;
        if (!hasDeviceMovedSignificantly.current) return;
        const distance = haversineDistanceKm(savedCoords, deviceCoords);
        if (distance < LOCATION_CHANGE_THRESHOLD_KM) return;
        setHasPromptedLocationChange(true);
        Alert.alert(
            'Use your new location?',
            deviceAddress
                ? `We found you're now at ${deviceAddress}. Update your service location to this place?`
                : 'We detected a new location. Update your service location to it?',
            [
                { text: 'Keep current', style: 'cancel' },
                { text: 'Use this location', onPress: () => handleUseDetectedLocation(deviceCoords) },
            ],
        );
    }, [locationLoading, deviceCoords, profile?.currentLocation, hasPromptedLocationChange, deviceAddress]);

    const isLocationUpdating = updateProfileMutation.isPending || isResolvingServiceAddress;
    const locationLabel = isLocationUpdating
        ? 'Updating location...'
        : serviceAddress || (locationLoading ? 'Detecting location...' : deviceAddress || 'Location not set');
    const initialPickerLocation = serviceCoords || deviceCoords || undefined;


    const getStatusColor = useCallback(
        (status: string) => {
            switch (status) {
                case 'pending':
                    return C.muted;
                case 'assigned':
                    return C.text;
                case 'completed':
                    return trade.accent;
                case 'canceled':
                    return '#b91c1c';
                default:
                    return C.muted;
            }
        },
        [trade.accent]
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    useEffect(() => {
        void SystemUI.setBackgroundColorAsync(C.canvas);
        if (Platform.OS === 'android') {
            setStatusBarTranslucent(false);
            setStatusBarBackgroundColor(C.greetingBand);
        }
    }, []);

    const insetPad = {
        paddingLeft: 16 + insets.left,
        paddingRight: 16 + insets.right,
    };

    return (
        <View style={styles.screenRoot}>
            <StatusBar style="dark" backgroundColor={C.greetingBand} translucent={Platform.OS === 'android' ? false : undefined} />
            {/* Greeting, location, avatar */}
            <View
                style={[
                    styles.greetingBand,
                    insetPad,
                    { paddingTop: insets.top + 14, paddingBottom: 14 },
                ]}
            >
                <View style={styles.greetingRowMain}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.greeting} selectable>
                            {user?.fullName || 'Mistri'}
                        </Text>
                        <View style={styles.locationRow}>
                            <Text style={styles.subtitleOnGreeting} numberOfLines={1} selectable>
                                {locationLabel}
                            </Text>
                            <TouchableOpacity
                                style={styles.editLocationButton}
                                onPress={() => setShowLocationPicker(true)}
                                disabled={isLocationUpdating}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                {isLocationUpdating ? (
                                    <ActivityIndicator size="small" color={trade.accent} />
                                ) : (
                                    <MaterialIcons name="edit-location-alt" size={18} color={trade.accent} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.avatar, tradeStyles.avatar]}
                        onPress={() => router.push('/(protected)/(mistri)/(tabs)/settings')}
                        activeOpacity={0.7}
                    >
                        {isProfileLoading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : profile?.profilePhotoUrl ? (
                            <Image
                                source={{ uri: profile.profilePhotoUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarText} selectable>
                                {user?.fullName ? getInitials(user.fullName) : 'M'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Page / cards */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.scrollInner,
                    {
                        paddingLeft: 16 + insets.left,
                        paddingRight: 16 + insets.right,
                        paddingBottom: 20 + insets.bottom,
                    },
                ]}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.sectionTight}>
                    <View style={styles.metricGrid}>
                        <View style={styles.metricCell}>
                            <View style={styles.metricRow}>
                                <View style={[styles.metricIconBadge, tradeStyles.accentSoftFill]}>
                                    <MaterialIcons name="work-outline" size={22} color={trade.accent} />
                                </View>
                                <View style={styles.metricTextBlock}>
                                    <Text
                                        style={styles.metricValue}
                                        selectable
                                        numberOfLines={1}
                                    >
                                        {isJobsLoading ? '…' : jobs.length}
                                    </Text>
                                    <Text style={styles.metricLabel} selectable>Open jobs</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.metricCell}>
                            <View style={styles.metricRow}>
                                <View style={[styles.metricIconBadge, tradeStyles.accentSoftFill]}>
                                    <MaterialIcons name="assignment" size={22} color={trade.accent} />
                                </View>
                                <View style={styles.metricTextBlock}>
                                    <Text
                                        style={styles.metricValue}
                                        selectable
                                        numberOfLines={1}
                                    >
                                        {isAcceptedJobsLoading ? '…' : acceptedJobs.length}
                                    </Text>
                                    <Text style={styles.metricLabel} selectable>Active</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.metricCell}>
                            <View style={styles.metricRow}>
                                <View style={[styles.metricIconBadge, tradeStyles.accentSoftFill]}>
                                    <MaterialIcons name="check-circle" size={22} color={trade.accent} />
                                </View>
                                <View style={styles.metricTextBlock}>
                                    <Text
                                        style={styles.metricValue}
                                        selectable
                                        numberOfLines={1}
                                    >
                                        {isProfileLoading ? '…' : jobsDoneCount}
                                    </Text>
                                    <Text style={styles.metricLabel} selectable>Completed</Text>
                                </View>
                            </View>
                        </View>
                        <View style={styles.metricCell}>
                            <View style={styles.metricRow}>
                                <View style={[styles.metricIconBadge, tradeStyles.accentSoftFill]}>
                                    <MaterialIcons name="star" size={22} color={trade.accent} />
                                </View>
                                <View style={styles.metricTextBlock}>
                                    {profile?.averageRating && Number(profile.averageRating) > 0 ? (
                                        <>
                                            <Text style={styles.metricValue} selectable>
                                                {Number(profile.averageRating).toFixed(1)}
                                            </Text>
                                            <View style={styles.ratingStarsRow}>
                                                <RatingStars
                                                    rating={Number(profile.averageRating)}
                                                    size={12}
                                                    color={trade.accent}
                                                />
                                            </View>
                                            <Text style={styles.metricLabel} selectable>Rating</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={[styles.metricValue, styles.metricMuted]} selectable>
                                                —
                                            </Text>
                                            <Text style={styles.metricLabel} selectable>Rating</Text>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionTight}>
                    <MistriDashboardCharts
                        chartWidth={chartWidth}
                        available={jobs.length}
                        active={acceptedJobs.length}
                        completed={jobsDoneCount}
                        statusLabels={statusLabels}
                        statusData={statusData}
                        isLoading={chartsLoading}
                        accentHex={trade.accent}
                        accentRgb={trade.accentRgb}
                    />
                </View>

                <View style={styles.sectionTight}>
                    {quickActions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={styles.quickActionCard}
                            onPress={action.onPress}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconContainer, tradeStyles.accentSoftFill]}>
                                <MaterialIcons name={action.icon} size={24} color={trade.accent} />
                            </View>
                            <View style={styles.quickActionContent}>
                                <Text style={styles.quickActionTitle} selectable>{action.title}</Text>
                                <Text style={styles.quickActionSubtitle} selectable>{action.subtitle}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={22} color={C.muted} />
                        </TouchableOpacity>
                    ))}
                </View>

                {isJobsPanelOpen && (
                    <View style={styles.sectionTight}>
                        <Text style={styles.sectionTitle} selectable>Available jobs</Text>
                        {isJobsLoading ? (
                            <ActivityIndicator color={trade.accent} />
                        ) : (
                            jobs.map((job) => (
                                <View key={job.id} style={styles.jobCard}>
                                    <Text style={styles.peekJobText} selectable>
                                        {job.type} — {job.address}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                )}

                <View style={[styles.sectionTight, styles.lastSection]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle} selectable>Active jobs</Text>
                        {acceptedJobs.length > 0 ? (
                            <TouchableOpacity onPress={() => router.push('/(protected)/(mistri)/(tabs)/my-jobs')}>
                                <Text style={[styles.seeAllText, tradeStyles.seeAll]} selectable>View all</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    {isAcceptedJobsLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={trade.accent} />
                        </View>
                    ) : acceptedJobs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="work-outline" size={40} color={C.muted} />
                            <Text style={styles.emptyStateText} selectable>No active jobs</Text>
                            <Text style={styles.emptyStateSubtext} selectable>
                                Open the Requests tab to find work nearby
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.jobsContainer}>
                            {acceptedJobs.slice(0, 3).map((job) => (
                                <TouchableOpacity
                                    key={job.id}
                                    style={styles.jobCard}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/(protected)/(mistri)/job-details',
                                            params: { requestId: job.id },
                                        })
                                    }
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.jobHeader}>
                                        <View style={[styles.jobTypeIcon, tradeStyles.accentSoftFill]}>
                                            <MaterialIcons name="build" size={20} color={trade.accent} />
                                        </View>
                                        <View style={styles.jobInfo}>
                                            <Text style={styles.jobService} selectable>
                                                {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                                            </Text>
                                            <Text style={styles.jobCustomer} selectable>
                                                {job.customerName}
                                            </Text>
                                        </View>
                                        <View style={styles.statusBadge}>
                                            <Text
                                                style={[styles.statusText, { color: getStatusColor(job.status) }]}
                                                selectable
                                            >
                                                {job.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.jobDetails}>
                                        <View style={styles.detailRow}>
                                            <MaterialIcons name="schedule" size={14} color={C.muted} />
                                            <Text style={styles.detailText} selectable>
                                                {job.assignedAt
                                                    ? formatDate(job.assignedAt)
                                                    : formatDate(job.createdAt)}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <MaterialIcons name="location-on" size={14} color={C.muted} />
                                            <Text style={styles.detailText} numberOfLines={1} selectable>
                                                {job.address}
                                            </Text>
                                        </View>
                                    </View>
                                    {job.unpaid ? (
                                        <View style={styles.unpaidBanner}>
                                            <MaterialIcons name="payment" size={14} color="#b91c1c" />
                                            <Text style={styles.unpaidText} selectable>Payment pending</Text>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
            <ExpandableMapSelector
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onConfirm={handleManualLocationConfirm}
                initialLocation={initialPickerLocation || undefined}
                accentColor={trade.accent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screenRoot: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    greetingBand: {
        backgroundColor: C.greetingBand,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(15, 23, 42, 0.08)',
    },
    greetingRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flex: 1,
        marginRight: 10,
    },
    greeting: {
        fontSize: 21,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.45,
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    subtitleOnGreeting: {
        fontSize: 12,
        color: C.muted,
        flexShrink: 1,
    },
    editLocationButton: {
        padding: 6,
        borderRadius: 10,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.cardBorder,
        borderCurve: 'continuous',
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        overflow: 'hidden',
        borderCurve: 'continuous',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    content: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    scrollInner: {
        gap: 0,
    },
    sectionTight: {
        marginTop: 14,
    },
    lastSection: {
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.3,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    metricCell: {
        width: '48%',
        flexGrow: 1,
        minWidth: '47%',
        backgroundColor: C.cardFill,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: C.cardBorder,
        paddingVertical: 12,
        paddingHorizontal: 12,
        boxShadow: ELEV.card,
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    metricIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricTextBlock: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-end',
    },
    metricValue: {
        fontSize: 22,
        fontWeight: '800',
        color: C.text,
        fontVariant: ['tabular-nums'],
        marginBottom: 2,
        textAlign: 'right',
        letterSpacing: -0.5,
    },
    metricMuted: {
        color: C.muted,
    },
    metricLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.55,
        textAlign: 'right',
    },
    ratingStarsRow: {
        marginTop: 2,
        marginBottom: 4,
        alignSelf: 'flex-end',
    },
    quickActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.cardFill,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: C.cardBorder,
        marginBottom: 10,
        gap: 12,
        boxShadow: ELEV.card,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionContent: {
        flex: 1,
    },
    quickActionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: C.text,
        marginBottom: 2,
        letterSpacing: -0.2,
    },
    quickActionSubtitle: {
        fontSize: 11,
        color: C.muted,
        lineHeight: 14,
    },
    jobsContainer: {
        gap: 8,
    },
    jobCard: {
        backgroundColor: C.cardFill,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 14,
        borderWidth: 1,
        borderColor: C.cardBorder,
        boxShadow: ELEV.card,
    },
    peekJobText: {
        fontSize: 13,
        color: C.text,
        lineHeight: 18,
    },
    jobHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    jobTypeIcon: {
        width: 44,
        height: 44,
        borderRadius: 13,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    jobInfo: {
        flex: 1,
    },
    jobService: {
        fontSize: 15,
        fontWeight: '600',
        color: C.text,
    },
    jobCustomer: {
        fontSize: 12,
        color: C.muted,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.05)',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    jobDetails: {
        gap: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        fontSize: 12,
        color: C.text,
        marginLeft: 6,
        flex: 1,
    },
    unpaidBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderCurve: 'continuous',
        marginTop: 10,
        gap: 8,
        boxShadow: '0 2px 8px rgba(185, 28, 28, 0.08)',
    },
    unpaidText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#b91c1c',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 28,
    },
    emptyState: {
        backgroundColor: C.cardFill,
        paddingVertical: 28,
        paddingHorizontal: 18,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.cardBorder,
        boxShadow: ELEV.card,
    },
    emptyStateText: {
        fontSize: 14,
        fontWeight: '600',
        color: C.text,
        marginTop: 8,
    },
    emptyStateSubtext: {
        fontSize: 12,
        color: C.muted,
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 16,
    },
});
