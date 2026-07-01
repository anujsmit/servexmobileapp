// app/(protected)/(mistri)/(tabs)/index.tsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    Animated,
    Modal,
    Dimensions,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useAuth } from '../../../../context/AuthContext';
import { useLocation } from '../../../../context/LocationContext';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    useMistriJobsQuery,
    useMistriProfileQuery,
    useMistriAcceptedJobsQuery,
    useUpdateMistriProfile,
    useEarningsQuery,
    type MistriJob,
} from '../../../../hooks/queries';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.7;

type Coordinates = { latitude: number; longitude: number };

const STATUS_COLORS = {
    assigned: { bg: '#e0f2fe', text: '#0284c7' },
    pending: { bg: '#fef3c7', text: '#d97706' },
    completed: { bg: '#d1fae5', text: '#059669' },
    canceled: { bg: '#fee2e2', text: '#dc2626' },
};

export default function MistriDashboard() {
    const insets = useSafeAreaInsets();
    const trade = useMistriTradeTheme();
    const { user } = useAuth();
    const { address: deviceAddress, coordinates: deviceCoords } = useLocation();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [showNewJobsModal, setShowNewJobsModal] = useState(false);
    const [newJobs, setNewJobs] = useState<MistriJob[]>([]);
    const [previousJobCount, setPreviousJobCount] = useState(0);
    
    const slideAnim = useRef(new Animated.Value(BOTTOM_SHEET_MAX_HEIGHT)).current;

    // React Query hooks with background refresh
    const { 
        data: profile, 
        isLoading: isProfileLoading, 
        refetch: refetchProfile,
        isError: profileError,
        isRefetching: isProfileRefetching,
    } = useMistriProfileQuery();
    
    const { 
        data: jobs = [], 
        isFetching: isJobsFetching, 
        refetch: refetchJobs,
        isRefetching: isJobsRefetching,
    } = useMistriJobsQuery();
    
    const { 
        data: acceptedJobs = [], 
        refetch: refetchAcceptedJobs,
        isRefetching: isAcceptedJobsRefetching,
    } = useMistriAcceptedJobsQuery({ enablePolling: true });
    
    const { 
        data: earningsData, 
        refetch: refetchEarnings,
        isLoading: isEarningsLoading,
        isRefetching: isEarningsRefetching,
    } = useEarningsQuery('month', 1, 10);
    
    const updateProfileMutation = useUpdateMistriProfile();

    // Background refresh function
    const backgroundRefresh = useCallback(async () => {
        await Promise.all([
            refetchProfile(),
            refetchJobs(),
            refetchAcceptedJobs(),
            refetchEarnings(),
        ]);
    }, [refetchProfile, refetchJobs, refetchAcceptedJobs, refetchEarnings]);

    // Manual refresh with loading indicator
    const onRefresh = async () => {
        setRefreshing(true);
        await backgroundRefresh();
        setRefreshing(false);
    };

    // Auto-refresh in background every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (profile?.isAvailable !== false) {
                backgroundRefresh();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [backgroundRefresh, profile?.isAvailable]);

    // Monitor new jobs
    useEffect(() => {
        if (!isJobsFetching && jobs.length > previousJobCount && previousJobCount > 0) {
            const newJobItems = jobs.slice(previousJobCount);
            setNewJobs(newJobItems);
            setShowNewJobsModal(true);
            animateBottomSheet(true);
        }
        setPreviousJobCount(jobs.length);
    }, [jobs, isJobsFetching]);

    const animateBottomSheet = (show: boolean) => {
        Animated.timing(slideAnim, {
            toValue: show ? 0 : BOTTOM_SHEET_MAX_HEIGHT,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    const closeBottomSheet = () => {
        animateBottomSheet(false);
        setTimeout(() => setShowNewJobsModal(false), 300);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    slideAnim.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    closeBottomSheet();
                } else {
                    animateBottomSheet(true);
                }
            },
        })
    ).current;

    const todayEarnings = earningsData?.summary?.totalEarnings || 0;
    const completedCount = profile?.jobsCompleted || 0;
    // FIX: Ensure rating is always a number
    const rating = profile?.averageRating ? Number(profile.averageRating) : 0;
    const serviceType = profile?.serviceName || 'Service Provider';
    const isAvailable = profile?.isAvailable ?? true;

    const openJobsCount = jobs.length;
    const activeJobsCount = acceptedJobs.filter(job => job.status === 'assigned' || job.status === 'pending').length;
    const assignedJobs = acceptedJobs.filter(job => job.status === 'assigned');
    const pendingJobs = acceptedJobs.filter(job => job.status === 'pending');

    const isBackgroundUpdating = isJobsRefetching || isAcceptedJobsRefetching || isProfileRefetching || isEarningsRefetching;

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const handleAcceptJob = (jobId: string) => {
        closeBottomSheet();
        router.push({
            pathname: '/(protected)/(mistri)/job-details',
            params: { requestId: jobId, autoAccept: 'true' },
        });
    };

    const handleViewAllJobs = () => {
        closeBottomSheet();
        router.push('/(protected)/(mistri)/(tabs)/requests');
    };

    const toggleAvailability = async () => {
        try {
            await updateProfileMutation.mutateAsync({
                isAvailable: !isAvailable,
                availabilityStatus: !isAvailable ? 'available' : 'unavailable',
            });
            Alert.alert(
                'Status Updated',
                `You are now ${!isAvailable ? 'available' : 'unavailable'} for new jobs`
            );
            backgroundRefresh();
        } catch (error) {
            Alert.alert('Error', 'Failed to update availability status');
        }
    };

    const handleUpdateLocation = async (coords: Coordinates) => {
        try {
            await updateProfileMutation.mutateAsync({
                currentLocation: `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`,
            });
            setShowLocationPicker(false);
            Alert.alert('Success', 'Location updated successfully');
            backgroundRefresh();
        } catch (error) {
            Alert.alert('Error', 'Failed to update location');
        }
    };

    useEffect(() => {
        void SystemUI.setBackgroundColorAsync('#f8fafc');
    }, []);

    if (profileError) {
        return (
            <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={48} color="#ef4444" />
                <Text style={styles.errorText}>Failed to load profile</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: trade.accent }]} onPress={onRefresh}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isLoading = isProfileLoading || isEarningsLoading;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const renderUpdatingIndicator = () => {
        if (!isBackgroundUpdating || refreshing) return null;
        return (
            <View style={[styles.updatingIndicator, { top: insets.top + 8 }]}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.updatingText}>Updating info...</Text>
            </View>
        );
    };

    const renderNewJobCard = (job: MistriJob, index: number) => (
        <TouchableOpacity
            key={job.id}
            style={[styles.newJobCard, { marginTop: index === 0 ? 0 : 12 }]}
            onPress={() => handleAcceptJob(job.id)}
            activeOpacity={0.8}
        >
            <View style={styles.newJobHeader}>
                <View style={[styles.newJobBadge, { backgroundColor: trade.accent + '15' }]}>
                    <MaterialIcons name="work" size={16} color={trade.accent} />
                </View>
                <Text style={[styles.newJobPrice, { color: trade.accent }]}>
                    NPR {job.paymentAmount ? parseInt(job.paymentAmount).toLocaleString() : '0'}
                </Text>
            </View>
            <Text style={styles.newJobTitle}>{job.type.charAt(0).toUpperCase() + job.type.slice(1)}</Text>
            <View style={styles.newJobLocation}>
                <Ionicons name="location-outline" size={14} color="#64748b" />
                <Text style={styles.newJobAddress} numberOfLines={1}>{job.address}</Text>
            </View>
            <View style={styles.newJobCustomer}>
                <Ionicons name="person-outline" size={14} color="#64748b" />
                <Text style={styles.newJobCustomerText}>{job.customerName}</Text>
            </View>
            <TouchableOpacity
                style={[styles.acceptButton, { backgroundColor: trade.accent }]}
                onPress={() => handleAcceptJob(job.id)}
                activeOpacity={0.9}
            >
                <Text style={styles.acceptButtonText}>Accept Job</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderActiveJobsSection = () => {
        if (isLoading && activeJobsCount === 0) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={trade.accent} />
                </View>
            );
        }

        if (activeJobsCount === 0) {
            return (
                <View style={styles.emptyState}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: trade.accent + '10' }]}>
                        <Ionicons name="briefcase-outline" size={32} color={trade.accent} />
                    </View>
                    <Text style={styles.emptyStateTitle}>No Active Jobs</Text>
                    <Text style={styles.emptyStateText}>Toggle online status or check requests below to get started</Text>
                    <TouchableOpacity
                        style={[styles.emptyStateButton, { backgroundColor: trade.accent }]}
                        onPress={() => router.push('/(protected)/(mistri)/(tabs)/requests')}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.emptyStateButtonText}>Find Jobs</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Active Workspace ({activeJobsCount})</Text>
                    <TouchableOpacity onPress={() => router.push('/(protected)/(mistri)/(tabs)/my-jobs')}>
                        <Text style={[styles.seeAllText, { color: trade.accent }]}>See All</Text>
                    </TouchableOpacity>
                </View>

                {assignedJobs.length > 0 && (
                    <View style={styles.jobCategory}>
                        <Text style={styles.jobCategoryTitle}>Assigned Pipeline</Text>
                        {assignedJobs.slice(0, 3).map((job) => (
                            <TouchableOpacity
                                key={job.id}
                                style={styles.jobCard}
                                onPress={() => router.push({ pathname: '/(protected)/(mistri)/job-details', params: { requestId: job.id } })}
                                activeOpacity={0.8}
                            >
                                <View style={styles.jobCardHeader}>
                                    <View style={[styles.jobStatusBadge, { backgroundColor: STATUS_COLORS.assigned.bg }]}>
                                        <Text style={[styles.jobStatusText, { color: STATUS_COLORS.assigned.text }]}>Assigned</Text>
                                    </View>
                                    <Text style={[styles.jobPrice, { color: trade.accent }]}>
                                        NPR {job.paymentAmount ? parseInt(job.paymentAmount).toLocaleString() : '0'}
                                    </Text>
                                </View>
                                <Text style={styles.jobTitle}>{job.type.charAt(0).toUpperCase() + job.type.slice(1)}</Text>
                                <Text style={styles.jobCustomer}>{job.customerName}</Text>
                                <View style={styles.jobCardFooter}>
                                    <View style={styles.jobLocation}>
                                        <Ionicons name="location-outline" size={14} color="#64748b" />
                                        <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
                                    </View>
                                    <View style={styles.jobTime}>
                                        <Ionicons name="time-outline" size={13} color="#94a3b8" />
                                        <Text style={styles.jobTimeText}>{formatTimeAgo(job.assignedAt || job.createdAt)}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {pendingJobs.length > 0 && (
                    <View style={styles.jobCategory}>
                        <Text style={styles.jobCategoryTitle}>Pending Confirmation</Text>
                        {pendingJobs.slice(0, 2).map((job) => (
                            <TouchableOpacity
                                key={job.id}
                                style={styles.jobCard}
                                onPress={() => router.push({ pathname: '/(protected)/(mistri)/job-details', params: { requestId: job.id } })}
                                activeOpacity={0.8}
                            >
                                <View style={styles.jobCardHeader}>
                                    <View style={[styles.jobStatusBadge, { backgroundColor: STATUS_COLORS.pending.bg }]}>
                                        <Text style={[styles.jobStatusText, { color: STATUS_COLORS.pending.text }]}>Pending</Text>
                                    </View>
                                    <Text style={[styles.jobPrice, { color: trade.accent }]}>
                                        NPR {job.paymentAmount ? parseInt(job.paymentAmount).toLocaleString() : '0'}
                                    </Text>
                                </View>
                                <Text style={styles.jobTitle}>{job.type.charAt(0).toUpperCase() + job.type.slice(1)}</Text>
                                <Text style={styles.jobCustomer}>{job.customerName}</Text>
                                <View style={styles.jobCardFooter}>
                                    <View style={styles.jobLocation}>
                                        <Ionicons name="location-outline" size={14} color="#64748b" />
                                        <Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>
                                    </View>
                                    <View style={styles.jobTime}>
                                        <Ionicons name="time-outline" size={13} color="#94a3b8" />
                                        <Text style={styles.jobTimeText}>{formatTimeAgo(job.assignedAt || job.createdAt)}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.screenRoot}>
            <StatusBar style="dark" backgroundColor="#ffffff" translucent={false} />
            
            {renderUpdatingIndicator()}
            
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        colors={[trade.accent]} 
                        tintColor={trade.accent}
                    />
                }
            >
                {/* Header Section */}
                <LinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    style={[styles.header, { paddingTop: insets.top + 16 }]}
                >
                    <View style={styles.headerTop}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.greeting}>{getGreeting()},</Text>
                            <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Mistri'}</Text>
                            <View style={styles.serviceBadge}>
                                <View style={[styles.serviceDot, { backgroundColor: trade.accent }]} />
                                <Text style={styles.serviceName}>{serviceType}</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={styles.locationButton}
                            onPress={() => setShowLocationPicker(true)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="location-sharp" size={15} color={trade.accent} />
                            <Text style={styles.locationText} numberOfLines={1}>
                                {deviceAddress || 'Set location'}
                            </Text>
                            <Feather name="chevron-down" size={14} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Availability Status Card */}
                    <View style={[styles.availabilityCard, { backgroundColor: isAvailable ? '#10b98108' : '#ef444408', borderColor: isAvailable ? '#10b98120' : '#ef444420' }]}>
                        <View style={styles.availabilityLeft}>
                            <View style={[styles.availabilityDot, { backgroundColor: isAvailable ? '#10b981' : '#ef4444' }]} />
                            <View>
                                <Text style={styles.availabilityTitle}>
                                    You are {isAvailable ? 'Available' : 'Offline'}
                                </Text>
                                <Text style={styles.availabilitySubtitle}>
                                    {isAvailable ? 'Accepting new live tasks' : 'Resting / Out of workspace'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={[styles.availabilityButton, { backgroundColor: isAvailable ? '#ef4444' : trade.accent }]}
                            onPress={toggleAvailability}
                            disabled={updateProfileMutation.isPending}
                            activeOpacity={0.8}
                        >
                            {updateProfileMutation.isPending ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.availabilityButtonText}>
                                    {isAvailable ? 'Go Offline' : 'Go Online'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Active Jobs Section */}
                <View style={styles.section}>
                    {renderActiveJobsSection()}
                </View>

                {/* Earnings Summary */}
                <View style={styles.sectionTitleWrapper}>
                    <Text style={styles.sectionTitle}>Overview Ledger</Text>
                </View>
                
                <View style={styles.earningsRow}>
                    <View style={styles.earningsCard}>
                        <Text style={styles.earningsLabel}>Total Earnings</Text>
                        <Text style={styles.earningsAmount}>NPR {todayEarnings.toLocaleString()}</Text>
                        <View style={styles.trendContainer}>
                            <Ionicons name="trending-up" size={12} color="#059669" />
                            <Text style={styles.trendText}>This Month</Text>
                        </View>
                    </View>
                    <View style={styles.earningsCard}>
                        <Text style={styles.earningsLabel}>Jobs Completed</Text>
                        <Text style={styles.earningsAmount}>{completedCount}</Text>
                        <View style={styles.trendContainer}>
                            <Ionicons name="checkmark-circle-outline" size={12} color="#0284c7" />
                            <Text style={styles.trendText}>All Time</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#e0f2fe' }]}>
                            <MaterialIcons name="work-outline" size={20} color="#0284c7" />
                        </View>
                        <Text style={styles.statValue}>{openJobsCount}</Text>
                        <Text style={styles.statLabel}>Open Jobs</Text>
                        <Text style={styles.statSubtext}>Available nearby</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                            <MaterialIcons name="assignment" size={20} color="#d97706" />
                        </View>
                        <Text style={styles.statValue}>{activeJobsCount}</Text>
                        <Text style={styles.statLabel}>Active Jobs</Text>
                        <Text style={styles.statSubtext}>Currently managing</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#d1fae5' }]}>
                            <MaterialIcons name="check-circle" size={20} color="#059669" />
                        </View>
                        <Text style={styles.statValue}>{completedCount}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                        <Text style={styles.statSubtext}>Successful dispatches</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                            <MaterialIcons name="star" size={20} color="#f59e0b" />
                        </View>
                        {/* FIX: Safely handle rating display */}
                        <Text style={styles.statValue}>
                            {rating > 0 ? Number(rating).toFixed(1) : 'New'}
                        </Text>
                        <Text style={styles.statLabel}>Rating Profile</Text>
                        {rating > 0 ? (
                            <View style={styles.ratingStars}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                        key={star}
                                        name={star <= Math.floor(rating) ? 'star' : 'star-outline'}
                                        size={11}
                                        color="#fbbf24"
                                    />
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.statSubtext}>No ratings yet</Text>
                        )}
                    </View>
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* New Jobs Bottom Sheet Modal */}
            <Modal
                visible={showNewJobsModal}
                transparent={true}
                animationType="none"
                onRequestClose={closeBottomSheet}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeBottomSheet} />
                    <Animated.View
                        style={[
                            styles.bottomSheet,
                            { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 16 }
                        ]}
                        {...panResponder.panHandlers}
                    >
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                        </View>

                        <View style={styles.bottomSheetHeader}>
                            <View style={[styles.headerIcon, { backgroundColor: trade.accent + '15' }]}>
                                <Ionicons name="flash" size={22} color={trade.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bottomSheetTitle}>Live Order Broadcast!</Text>
                                <Text style={styles.bottomSheetSubtitle}>
                                    {newJobs.length} market match{newJobs.length !== 1 ? 'es' : ''} close to your radius
                                </Text>
                            </View>
                        </View>

                        <ScrollView 
                            style={styles.bottomSheetContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {newJobs.map((job, index) => renderNewJobCard(job, index))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.viewAllButton, { borderColor: trade.accent + '40' }]}
                            onPress={handleViewAllJobs}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.viewAllButtonText, { color: trade.accent }]}>View Discovery Feed</Text>
                            <Ionicons name="arrow-forward" size={16} color={trade.accent} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            <ExpandableMapSelector
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onConfirm={handleUpdateLocation}
                initialLocation={deviceCoords || undefined}
                accentColor={trade.accent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screenRoot: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    greeting: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    userName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        marginVertical: 2,
        letterSpacing: -0.5,
    },
    serviceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    serviceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    serviceName: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },
    locationText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#334155',
        maxWidth: 110,
    },
    availabilityCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
    },
    availabilityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    availabilityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    availabilityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    availabilitySubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    availabilityButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 100,
    },
    availabilityButtonText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    section: {
        paddingHorizontal: 20,
        marginTop: 8,
    },
    sectionTitleWrapper: {
        paddingHorizontal: 20,
        marginBottom: 12,
        marginTop: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    jobCategory: {
        marginBottom: 8,
    },
    jobCategoryTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    jobCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    jobCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    jobStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    jobStatusText: {
        fontSize: 11,
        fontWeight: '700',
    },
    jobPrice: {
        fontSize: 15,
        fontWeight: '700',
    },
    jobTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    jobCustomer: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 12,
    },
    jobCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
        marginTop: 4,
    },
    jobLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        marginRight: 8,
    },
    jobAddress: {
        fontSize: 12,
        color: '#64748b',
    },
    jobTime: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    jobTimeText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    earningsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
    },
    earningsCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    earningsLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 4,
    },
    earningsAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        marginTop: 2,
    },
    statSubtext: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 1,
    },
    ratingStars: {
        flexDirection: 'row',
        marginTop: 4,
        gap: 1,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyState: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    emptyIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    emptyStateText: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 16,
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    emptyStateButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 100,
    },
    emptyStateButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 20,
    },
    errorText: {
        fontSize: 15,
        color: '#ef4444',
        fontWeight: '500',
        marginTop: 12,
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 100,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    updatingIndicator: {
        position: 'absolute',
        alignSelf: 'center',
        backgroundColor: '#0f172acc',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    updatingText: {
        fontSize: 12,
        color: '#ffffff',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
        maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
    },
    dragHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
    },
    bottomSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 14,
        paddingTop: 6,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomSheetTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    bottomSheetSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 1,
    },
    bottomSheetContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        maxHeight: SCREEN_HEIGHT * 0.45,
    },
    newJobCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    newJobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    newJobBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newJobPrice: {
        fontSize: 16,
        fontWeight: '700',
    },
    newJobTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 6,
    },
    newJobLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    newJobAddress: {
        fontSize: 12,
        color: '#64748b',
        flex: 1,
    },
    newJobCustomer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14,
    },
    newJobCustomerText: {
        fontSize: 12,
        color: '#64748b',
    },
    acceptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 11,
        borderRadius: 12,
    },
    acceptButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        marginHorizontal: 20,
        marginTop: 6,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 100,
    },
    viewAllButtonText: {
        fontSize: 13,
        fontWeight: '700',
    },
});