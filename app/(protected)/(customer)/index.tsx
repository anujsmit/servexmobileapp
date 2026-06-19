import React, { useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import {
    customerBrand as B,
    customerDashboardColors as C,
    customerDashboardElevation as ELEV,
} from '../../../lib/customerDashboardTokens';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../context/LocationContext';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useCustomerRequestsQuery } from '../../../hooks/queries';
import { HeroBanner } from '../../../components/HeroBanner';

export default function CustomerDashboard() {
    const { user } = useAuth();
    const { address, isLoading: locationLoading } = useLocation();
    const router = useRouter();

    const brandStyles = useMemo(
        () => ({
            avatar: {
                backgroundColor: B.accent,
                boxShadow: `0 6px 18px rgba(${B.accentRgb}, 0.28), 0 2px 6px rgba(15, 23, 42, 0.06)`,
            },
            accentSoftFill: { backgroundColor: B.accentSoft },
            seeAll: { color: B.accent },
        }),
        []
    );

    // Fetch customer's recent requests
    const { data: requests = [], isLoading: requestsLoading } = useCustomerRequestsQuery();

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    const getStatusStyle = useCallback((status: string) => {
        switch (status) {
            case 'pending':
                return { backgroundColor: '#fef3c7', color: '#d97706' };
            case 'assigned':
                return { backgroundColor: '#dbeafe', color: B.accent };
            case 'completed':
                return { backgroundColor: '#d1fae5', color: '#059669' };
            case 'canceled':
                return { backgroundColor: '#fee2e2', color: '#dc2626' };
            default:
                return { backgroundColor: '#f3f4f6', color: '#6b7280' };
        }
    }, []);

    const quickActions = useMemo(
        () => [
            {
                id: 1,
                title: 'Book a Service',
                subtitle: 'Find skilled mistris near you',
                icon: 'build' as const,
                onPress: () => router.push('/service-request'),
            },
            {
                id: 2,
                title: 'My Bookings',
                subtitle: 'Track your service requests',
                icon: 'event' as const,
                onPress: () => router.push('/(protected)/(customer)/requests'),
            },
        ],
        [router]
    );

    return (
        <SafeAreaContainer style={styles.safeRoot}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.greeting} selectable>
                        {user?.fullName || 'Customer'}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1} selectable>
                        {locationLoading ? 'Detecting location...' : address}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.avatar, brandStyles.avatar]}
                    onPress={() => router.push('/(protected)/(customer)/settings')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.avatarText} selectable>
                        {user?.fullName ? getInitials(user.fullName) : 'U'}
                    </Text>
                </TouchableOpacity>
            </View>
            <HeroBanner />

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollInner}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.sectionTight}>
                    <View style={styles.quickActionsGrid}>
                        {quickActions.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.quickActionCard}
                                onPress={action.onPress}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconContainer, brandStyles.accentSoftFill]}>
                                    <MaterialIcons name={action.icon} size={24} color={B.accent} />
                                </View>
                                <View style={styles.quickActionContent}>
                                    <Text style={styles.quickActionTitle} selectable>
                                        {action.title}
                                    </Text>
                                    <Text style={styles.quickActionSubtitle} selectable>
                                        {action.subtitle}
                                    </Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={22} color={C.muted} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={[styles.sectionTight, styles.lastSection]}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle} selectable>
                            Recent requests
                        </Text>
                        {requests.length > 0 ? (
                            <TouchableOpacity onPress={() => router.push('/(protected)/(customer)/requests')}>
                                <Text style={[styles.seeAllText, brandStyles.seeAll]} selectable>
                                    View all
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {requestsLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={B.accent} />
                            <Text style={styles.loadingText} selectable>
                                Loading requests…
                            </Text>
                        </View>
                    ) : requests.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialIcons name="event-note" size={40} color={C.muted} />
                            <Text style={styles.emptyStateText} selectable>
                                No bookings yet
                            </Text>
                            <Text style={styles.emptyStateSubtext} selectable>
                                Book your first service using the shortcuts above
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.requestsContainer}>
                            {requests.slice(0, 3).map((request: { id: string; status: string; type: string; address: string; createdAt: string }) => {
                                const statusStyle = getStatusStyle(request.status);
                                return (
                                    <TouchableOpacity
                                        key={request.id}
                                        style={styles.requestCard}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/requests/[id]',
                                                params: { id: request.id },
                                            })
                                        }
                                    >
                                        <View style={styles.requestHeader}>
                                            <View style={[styles.requestTypeIcon, brandStyles.accentSoftFill]}>
                                                <MaterialIcons
                                                    name={
                                                        request.type === 'electrician'
                                                            ? 'electrical-services'
                                                            : 'plumbing'
                                                    }
                                                    size={22}
                                                    color={B.accent}
                                                />
                                            </View>
                                            <View style={styles.requestInfo}>
                                                <Text style={styles.requestType} selectable>
                                                    {request.type.charAt(0).toUpperCase() + request.type.slice(1)}
                                                </Text>
                                                <Text style={styles.requestAddress} numberOfLines={1} selectable>
                                                    {request.address}
                                                </Text>
                                            </View>
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    { backgroundColor: statusStyle.backgroundColor },
                                                ]}
                                            >
                                                <Text style={[styles.statusText, { color: statusStyle.color }]} selectable>
                                                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.requestDate} selectable>
                                            {new Date(request.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: C.canvas,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: C.surface,
        borderBottomWidth: 0,
        boxShadow: ELEV.header,
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
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        color: C.muted,
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
        paddingHorizontal: 16,
        paddingBottom: 20,
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
    quickActionsGrid: {
        gap: 0,
    },
    quickActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 0,
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
    requestsContainer: {
        gap: 8,
    },
    requestCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 14,
        borderWidth: 0,
        boxShadow: ELEV.card,
    },
    requestHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    requestTypeIcon: {
        width: 44,
        height: 44,
        borderRadius: 13,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    requestInfo: {
        flex: 1,
        minWidth: 0,
    },
    requestType: {
        fontSize: 15,
        fontWeight: '600',
        color: C.text,
    },
    requestAddress: {
        fontSize: 12,
        color: C.muted,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        borderCurve: 'continuous',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    requestDate: {
        fontSize: 12,
        color: C.muted,
        marginLeft: 56,
        fontVariant: ['tabular-nums'],
    },
    emptyState: {
        backgroundColor: C.surface,
        paddingVertical: 28,
        paddingHorizontal: 18,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 0,
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
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 28,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: C.muted,
    },
});
