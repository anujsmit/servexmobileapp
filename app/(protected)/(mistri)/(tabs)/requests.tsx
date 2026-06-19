import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons } from '@expo/vector-icons';
import { JobCard } from '../../../../components/JobCard';
import {
    useTargetedRequestsQuery,
    useMistriProfileQuery,
    useAcceptServiceRequest,
    useDeclineServiceRequest,
    useNotificationsQuery,
    useMarkNotificationAsRead,
} from '../../../../hooks/queries';
import { useRouter } from 'expo-router';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';
import { softTintFromHex } from '../../../../lib/mistriTradeTheme';
import { mistriDashboardColors as DC } from '../../../../lib/mistriDashboardTokens';

export default function RequestsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const requestsBrand = useMemo(
        () => ({
            badge: { backgroundColor: trade.accent },
            emptyC1: { backgroundColor: trade.accentSoft },
            emptyC2: { backgroundColor: trade.accentSoft },
            emptyIconSh: { shadowColor: trade.accent },
            emptyStat: {
                backgroundColor: trade.accentSoft,
                borderColor: softTintFromHex(trade.accent, 0.3),
            },
            emptyStatDot: { backgroundColor: trade.accent },
            emptyStatTxt: { color: trade.accent },
        }),
        [trade]
    );

    const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
    const [decliningJobId, setDecliningJobId] = useState<string | null>(null);

    const { data: profile } = useMistriProfileQuery();
    const shouldPoll = profile?.availabilityStatus === 'available';

    const {
        data: targetedRequests = [],
        isLoading,
        refetch,
        isRefetching,
    } = useTargetedRequestsQuery({ enablePolling: shouldPoll });

    const pulseAnim1 = useRef(new Animated.Value(1)).current;
    const pulseAnim2 = useRef(new Animated.Value(1)).current;
    const dotPulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (targetedRequests.length > 0) {
            fadeAnim.setValue(0);
            pulseAnim1.setValue(1);
            pulseAnim2.setValue(1);
            dotPulseAnim.setValue(1);
            return;
        }

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();

        const pulse1 = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim1, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
                Animated.timing(pulseAnim1, { toValue: 1, duration: 2000, useNativeDriver: true }),
            ])
        );
        const pulse2 = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim2, { toValue: 1.2, duration: 2000, useNativeDriver: true }),
                Animated.timing(pulseAnim2, { toValue: 1, duration: 2000, useNativeDriver: true }),
            ])
        );
        const dotPulse = Animated.loop(
            Animated.sequence([
                Animated.timing(dotPulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
                Animated.timing(dotPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        );

        pulse1.start();
        pulse2.start();
        dotPulse.start();

        return () => {
            pulse1.stop();
            pulse2.stop();
            dotPulse.stop();
        };
    }, [targetedRequests.length]);

    const { data: notificationData } = useNotificationsQuery();
    const notifications = notificationData?.notifications || [];

    const { mutateAsync: acceptJob } = useAcceptServiceRequest();
    const { mutateAsync: declineJob } = useDeclineServiceRequest();
    const { mutateAsync: markNotificationRead } = useMarkNotificationAsRead();

    const handleViewDetails = (jobId: string) => {
        router.push({
            pathname: '/(protected)/(mistri)/job-details',
            params: { requestId: jobId },
        });
    };

    const handleAcceptJob = async (jobId: string) => {
        setAcceptingJobId(jobId);
        try {
            await acceptJob(jobId);
            const relatedNotification = notifications.find(
                (n: any) => n.relatedRequestId === jobId && !n.isRead
            );
            if (relatedNotification) {
                await markNotificationRead(relatedNotification.id);
            }
            router.push({
                pathname: '/(protected)/(mistri)/job-details',
                params: { requestId: jobId },
            });
        } catch (error) {
            if (__DEV__) console.error('Error accepting job:', error);
            Alert.alert('Error', 'Failed to accept job. Please try again.');
        } finally {
            setAcceptingJobId(null);
        }
    };

    const handleDeclineJob = async (jobId: string) => {
        Alert.alert(
            'Decline Job',
            'Are you sure you want to decline this job? The customer will be notified.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setDecliningJobId(jobId);
                        try {
                            await declineJob(jobId);
                            const relatedNotification = notifications.find(
                                (n: any) => n.relatedRequestId === jobId && !n.isRead
                            );
                            if (relatedNotification) {
                                await markNotificationRead(relatedNotification.id);
                            }
                            Alert.alert(
                                'Job Declined',
                                'The job has been declined. The customer can select another mistri.',
                                [{ text: 'OK' }]
                            );
                        } catch (error) {
                            if (__DEV__) console.error('Error declining job:', error);
                            Alert.alert('Error', 'Failed to decline job. Please try again.');
                        } finally {
                            setDecliningJobId(null);
                        }
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Requests" variant="mistri" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading requests...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    const subtitle =
        targetedRequests.length > 0
            ? `${targetedRequests.length} pending ${targetedRequests.length === 1 ? 'request' : 'requests'}`
            : 'No pending requests';

    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Requests"
                subtitle={subtitle}
                rightElement={
                    targetedRequests.length > 0 ? (
                        <View style={[styles.badge, requestsBrand.badge]}>
                            <Text style={styles.badgeText}>{targetedRequests.length}</Text>
                        </View>
                    ) : undefined
                }
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={trade.accent}
                        colors={[trade.accent]}
                    />
                }
            >
                {targetedRequests.length === 0 ? (
                    <Animated.View
                        style={[
                            styles.emptyContainer,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    {
                                        translateY: fadeAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [20, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.emptyIllustration}>
                            <Animated.View
                                style={[
                                    styles.emptyCircle1,
                                    shouldPoll && requestsBrand.emptyC1,
                                    profile?.availabilityStatus === 'unavailable' && styles.emptyCircle1Gray,
                                    profile?.availabilityStatus === 'on_work_available' && styles.emptyCircle1Orange,
                                    shouldPoll && { transform: [{ scale: pulseAnim1 }] },
                                ]}
                            />
                            <Animated.View
                                style={[
                                    styles.emptyCircle2,
                                    shouldPoll && requestsBrand.emptyC2,
                                    profile?.availabilityStatus === 'unavailable' && styles.emptyCircle2Gray,
                                    profile?.availabilityStatus === 'on_work_available' && styles.emptyCircle2Orange,
                                    shouldPoll && { transform: [{ scale: pulseAnim2 }] },
                                ]}
                            />
                            <View
                                style={[
                                    styles.emptyIconWrapper,
                                    shouldPoll && requestsBrand.emptyIconSh,
                                    profile?.availabilityStatus === 'unavailable' && styles.emptyIconWrapperGray,
                                    profile?.availabilityStatus === 'on_work_available' && styles.emptyIconWrapperOrange,
                                ]}
                            >
                                <MaterialIcons
                                    name="assignment"
                                    size={56}
                                    color={
                                        profile?.availabilityStatus === 'unavailable'
                                            ? DC.muted
                                            : profile?.availabilityStatus === 'on_work_available'
                                              ? '#d97706'
                                              : trade.accent
                                    }
                                />
                            </View>
                        </View>
                        <Text style={styles.emptyTitle}>Waiting for Requests</Text>
                        <Text style={styles.emptySubtitle}>
                            New requests will appear here automatically
                        </Text>
                        <View
                            style={[
                                styles.emptyStatus,
                                shouldPoll && requestsBrand.emptyStat,
                                !shouldPoll && styles.emptyStatusInactive,
                            ]}
                        >
                            <Animated.View
                                style={[
                                    styles.emptyStatusDot,
                                    shouldPoll && requestsBrand.emptyStatDot,
                                    !shouldPoll && styles.emptyStatusDotInactive,
                                    shouldPoll && { transform: [{ scale: dotPulseAnim }] },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.emptyStatusText,
                                    shouldPoll && requestsBrand.emptyStatTxt,
                                    !shouldPoll && styles.emptyStatusTextInactive,
                                ]}
                            >
                                {shouldPoll
                                    ? 'Checking for new jobs every 10 seconds'
                                    : 'Set status to Available to receive job updates'}
                            </Text>
                        </View>
                    </Animated.View>
                ) : (
                    targetedRequests.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            onAccept={handleAcceptJob}
                            onDecline={handleDeclineJob}
                            onViewDetails={handleViewDetails}
                            isAccepting={acceptingJobId === job.id}
                            isDeclining={decliningJobId === job.id}
                            showActions
                        />
                    ))
                )}
            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    badge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        minWidth: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: DC.canvas,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: DC.muted,
    },
    content: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyIllustration: {
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        position: 'relative',
    },
    emptyCircle1: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        opacity: 0.6,
    },
    emptyCircle1Gray: { backgroundColor: '#f3f4f6' },
    emptyCircle1Orange: { backgroundColor: '#fef3c7' },
    emptyCircle2: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        opacity: 0.4,
    },
    emptyCircle2Gray: { backgroundColor: '#e5e7eb' },
    emptyCircle2Orange: { backgroundColor: '#fde68a' },
    emptyIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: DC.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        zIndex: 1,
    },
    emptyIconWrapperGray: { shadowColor: DC.muted },
    emptyIconWrapperOrange: { shadowColor: '#d97706' },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: DC.text,
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    emptySubtitle: {
        fontSize: 16,
        color: DC.muted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
        paddingHorizontal: 16,
        maxWidth: 280,
    },
    emptyStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 24,
        borderWidth: 1,
    },
    emptyStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    emptyStatusText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyStatusInactive: {
        backgroundColor: DC.surfaceMuted,
        borderColor: 'rgba(15, 23, 42, 0.08)',
    },
    emptyStatusDotInactive: {
        backgroundColor: DC.muted,
    },
    emptyStatusTextInactive: {
        color: DC.muted,
    },
});
