import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    useServiceRequestQuery,
    useCompleteServiceRequest,
    useToggleUnpaid,
    useAcceptServiceRequest,
    useDeclineServiceRequest,
    useRatingStatusQuery
} from '../../../hooks/queries';
import MapView, { Marker } from 'react-native-maps';
import { useServices } from '../../../context/ServicesContext';
import { RatingStars } from '../../../components/RatingStars';
import { useMistriTradeTheme } from '../../../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';

// Dashed line component
const DashedLine = ({ style }: { style?: object }) => (
    <View style={[{ flexDirection: 'row', overflow: 'hidden', marginHorizontal: -16 }, style]}>
        {Array.from({ length: 50 }).map((_, i) => (
            <View key={i} style={{ width: 6, height: 1, backgroundColor: 'rgba(15, 23, 42, 0.12)', marginRight: 4 }} />
        ))}
    </View>
);

export default function JobDetailsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const params = useLocalSearchParams();
    const requestId = params.requestId as string;
    const { getServiceByName } = useServices();

    const [isCompleting, setIsCompleting] = useState(false);
    const [isTogglingUnpaid, setIsTogglingUnpaid] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);

    const { data: requestData, isLoading, error, isError } = useServiceRequestQuery(requestId, {
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
    });

    const { data: ratingData } = useRatingStatusQuery(requestId);

    const request = requestData?.request;
    const customerDetails = requestData?.customerDetails;
    const selectedServices = requestData?.selectedServices || [];

    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);

    const completeJobMutation = useCompleteServiceRequest();
    const toggleUnpaidMutation = useToggleUnpaid();
    const acceptJobMutation = useAcceptServiceRequest();
    const declineJobMutation = useDeclineServiceRequest();

    useEffect(() => {
        if (!requestId) {
            Alert.alert('Error', 'Request ID not found', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        }
    }, [requestId, router]);

    useEffect(() => {
        if (isError && error) {
            if (__DEV__) console.error('Error fetching request:', error);
            Alert.alert('Error', 'Failed to load job details. Please try again.', [
                { text: 'Go Back', onPress: () => router.back() },
            ]);
        }
    }, [isError, error, router]);

    const handleCallCustomer = () => {
        if (customerDetails?.phone) {
            Linking.openURL(`tel:${customerDetails.phone}`).catch((err) => {
                if (__DEV__) console.error('Error opening dialer:', err);
                Alert.alert('Error', 'Could not open phone dialer');
            });
        }
    };

    const handleOpenMaps = () => {
        if (request?.lat && request?.lng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${request.lat},${request.lng}`;
            Linking.openURL(url).catch((err) => {
                if (__DEV__) console.error('Error opening maps:', err);
                Alert.alert('Error', 'Could not open maps');
            });
        }
    };

    const handleCompleteJob = () => {
        Alert.alert('Complete Job', 'Mark this job as completed?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Complete',
                style: 'default',
                onPress: async () => {
                    setIsCompleting(true);
                    try {
                        await completeJobMutation.mutateAsync(requestId);
                        Alert.alert('Success', 'Job marked as completed');
                    } catch (err) {
                        if (__DEV__) console.error('Error completing job:', err);
                        Alert.alert('Error', 'Failed to complete job. Please try again.');
                    } finally {
                        setIsCompleting(false);
                    }
                },
            },
        ], { cancelable: true });
    };

    const handleToggleUnpaid = async () => {
        setIsTogglingUnpaid(true);
        try {
            await toggleUnpaidMutation.mutateAsync(requestId);
            const newStatus = !request?.unpaid;
            Alert.alert('Success', newStatus ? 'Job marked as unpaid' : 'Unpaid status removed');
        } catch (err) {
            if (__DEV__) console.error('Error toggling unpaid:', err);
            Alert.alert('Error', 'Failed to update unpaid status. Please try again.');
        } finally {
            setIsTogglingUnpaid(false);
        }
    };

    const handleAcceptJob = () => {
        Alert.alert('Accept Job', 'Accept this job request?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Accept',
                style: 'default',
                onPress: async () => {
                    setIsAccepting(true);
                    try {
                        await acceptJobMutation.mutateAsync(requestId);
                        Alert.alert('Success', 'Job accepted successfully');
                    } catch (err) {
                        if (__DEV__) console.error('Error accepting job:', err);
                        Alert.alert('Error', 'Failed to accept job. Please try again.');
                    } finally {
                        setIsAccepting(false);
                    }
                },
            },
        ], { cancelable: true });
    };

    const handleDeclineJob = () => {
        Alert.alert('Decline Job', 'Are you sure you want to decline this job?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    setIsDeclining(true);
                    try {
                        await declineJobMutation.mutateAsync(requestId);
                        Alert.alert('Success', 'Job declined');
                        router.back();
                    } catch (err) {
                        if (__DEV__) console.error('Error declining job:', err);
                        Alert.alert('Error', 'Failed to decline job. Please try again.');
                    } finally {
                        setIsDeclining(false);
                    }
                },
            },
        ], { cancelable: true });
    };

    const getStatusColor = () => {
        switch (request?.status) {
            case 'pending': return '#F59E0B';
            case 'assigned': return trade.accent;
            case 'completed': return '#10B981';
            case 'canceled': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getStatusLabel = () => {
        switch (request?.status) {
            case 'pending': return 'Waiting';
            case 'assigned': return 'Accepted';
            case 'completed': return 'Completed';
            case 'canceled': return 'Canceled';
            default: return 'Unknown';
        }
    };

    const getStatusIcon = () => {
        switch (request?.status) {
            case 'pending': return 'hourglass-empty';
            case 'assigned': return 'check-circle';
            case 'completed': return 'done-all';
            case 'canceled': return 'cancel';
            default: return 'help';
        }
    };

    const formatDateTime = (value?: string) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const shortRequestId = requestId ? requestId.slice(0, 8).toUpperCase() : '-';

    if (isLoading || !request) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    variant="mistri"
                    title="Job Details"
                    leftElement={
                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                            <MaterialIcons name="arrow-back" size={24} color={DC.text} />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    const mapRegion = request.lat && request.lng ? {
        latitude: parseFloat(request.lat),
        longitude: parseFloat(request.lng),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    } : null;

    const serviceName = getServiceByName(request.type)?.displayName ||
        request.type.charAt(0).toUpperCase() + request.type.slice(1);

    const timelineEvents = [
        { label: 'Requested', timestamp: request.createdAt, completed: true },
        { label: 'Accepted', timestamp: request.assignedAt, completed: !!request.assignedAt },
        { label: 'Completed', timestamp: request.completedAt, completed: !!request.completedAt },
    ];

    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Job Details"
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <MaterialIcons name="arrow-back" size={24} color={DC.text} />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.receiptCard}>
                    {/* Perforated Top Edge */}
                    <View style={styles.perforatedEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>

                    {/* Receipt Header */}
                    <View style={styles.receiptHeader}>
                        <View style={styles.receiptBrand}>
                            <Image
                                source={require('../../../assets/images/logo.png')}
                                style={styles.receiptLogo}
                            />
                            <View>
                                <Text style={styles.receiptTitle}>ServeX</Text>
                                <Text style={styles.receiptSubtitle}>Job Receipt</Text>
                            </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: getStatusColor() }]}>
                            <MaterialIcons name={getStatusIcon()} size={14} color="#FFFFFF" />
                            <Text style={styles.statusPillText}>{getStatusLabel()}</Text>
                        </View>
                    </View>

                    <DashedLine style={{ marginBottom: 10 }} />

                    {/* Meta Grid */}
                    <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Job ID</Text>
                            <Text style={styles.metaValue}>{shortRequestId}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Service</Text>
                            <Text style={styles.metaValue}>{serviceName}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Requested</Text>
                            <Text style={styles.metaValue}>{formatDateTime(request.createdAt)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Customer</Text>
                            <Text style={styles.metaValue}>{customerDetails?.name || '-'}</Text>
                        </View>
                    </View>

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Customer Info (for assigned jobs) */}
                    {request.status === 'assigned' && customerDetails && (
                        <>
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Contact</Text>
                                <View style={styles.customerRow}>
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialIcons name="person" size={24} color="#9CA3AF" />
                                    </View>
                                    <View style={styles.customerInfo}>
                                        <Text style={styles.customerName}>{customerDetails.name}</Text>
                                        <Text style={styles.customerPhone}>{customerDetails.phone}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.callIcon} onPress={handleCallCustomer}>
                                        <Ionicons name="call" size={20} color="#10B981" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <DashedLine style={{ marginVertical: 10 }} />
                        </>
                    )}

                    {/* Location */}
                    <View style={styles.sectionBlock}>
                        <Text style={styles.blockTitle}>Location</Text>
                        <Text style={styles.blockText} numberOfLines={3}>
                            {request.address}
                        </Text>
                    </View>

                    {/* Services */}
                    {selectedServices.length > 0 && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Services</Text>
                                <View style={styles.itemsList}>
                                    {selectedServices.map((service: any) => (
                                        <View key={service.id} style={styles.itemGroup}>
                                            <View style={styles.itemRow}>
                                                <Text style={styles.itemName} numberOfLines={1}>{service.name}</Text>
                                                <View style={styles.itemLeader} />
                                                <Text style={styles.itemPrice}>Rs. {Number(service.price).toLocaleString()}</Text>
                                            </View>
                                            {service.description ? (
                                                <Text style={styles.itemDescription} numberOfLines={2}>
                                                    {service.description}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                </View>
                                <DashedLine style={{ marginVertical: 10 }} />
                                <View style={styles.totalRowReceipt}>
                                    <Text style={styles.totalLabel}>Total Estimate</Text>
                                    <Text style={styles.totalPrice}>Rs. {totalPrice.toLocaleString()}</Text>
                                </View>
                            </View>
                        </>
                    )}

                    {/* Customer Notes */}
                    {request.customerNotes && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Notes</Text>
                                <Text style={styles.blockText}>{request.customerNotes}</Text>
                            </View>
                        </>
                    )}

                    {/* Timeline */}
                    <DashedLine style={{ marginVertical: 10 }} />
                    <View style={styles.sectionBlock}>
                        <Text style={styles.blockTitle}>Timeline</Text>
                        <View style={styles.timelineList}>
                            {timelineEvents.map((event) => (
                                <View key={event.label} style={styles.timelineRow}>
                                    <Text style={styles.timelineLabel}>{event.label}</Text>
                                    <Text style={styles.timelineValue}>
                                        {event.completed ? formatDateTime(event.timestamp) : 'Pending'}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Payment Status */}
                    {request.unpaid && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.unpaidRow}>
                                <MaterialIcons name="warning" size={18} color="#DC2626" />
                                <Text style={styles.unpaidText}>Payment Pending</Text>
                            </View>
                        </>
                    )}

                    {/* Rating Received (if job is completed and customer rated) */}
                    {request.status === 'completed' && ratingData?.rating && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Rating</Text>
                                <View style={styles.ratingRow}>
                                    <RatingStars rating={ratingData.rating.rating} size={16} />
                                    <Text style={styles.ratingValue}>{ratingData.rating.rating.toFixed(1)}</Text>
                                </View>
                                {ratingData.rating.review && (
                                    <Text style={styles.reviewText}>{ratingData.rating.review}</Text>
                                )}
                            </View>
                        </>
                    )}

                    {/* Perforated Bottom Edge */}
                    <View style={styles.perforatedBottomEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>
                </View>

                {/* Map Card - Outside receipt */}
                {mapRegion && (
                    <View style={styles.mapCard}>
                        <MapView
                            style={styles.map}
                            region={mapRegion}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                        >
                            <Marker
                                coordinate={{
                                    latitude: mapRegion.latitude,
                                    longitude: mapRegion.longitude,
                                }}
                                title="Job Location"
                                description={request.address}
                            >
                                <MaterialIcons name="location-on" size={40} color="#dc2626" />
                            </Marker>
                        </MapView>
                        <TouchableOpacity
                            style={[styles.directionsBtn, { backgroundColor: trade.accent }]}
                            onPress={handleOpenMaps}
                        >
                            <MaterialIcons name="directions" size={18} color="#ffffff" />
                            <Text style={styles.directionsBtnText}>Get Directions</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Sticky Action Buttons */}
            <View style={styles.stickyActions}>
                {request.status === 'pending' && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.declineButton, isDeclining && styles.actionButtonDisabled]}
                            onPress={handleDeclineJob}
                            disabled={isDeclining}
                        >
                            {isDeclining ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                                <>
                                    <MaterialIcons name="cancel" size={20} color="#DC2626" />
                                    <Text style={styles.declineText}>Decline</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.acceptButton,
                                { backgroundColor: trade.accent },
                                isAccepting && styles.actionButtonDisabled,
                            ]}
                            onPress={handleAcceptJob}
                            disabled={isAccepting}
                        >
                            {isAccepting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                                    <Text style={styles.actionText}>Accept Job</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {request.status === 'assigned' && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.unpaidButton, isTogglingUnpaid && styles.actionButtonDisabled]}
                            onPress={handleToggleUnpaid}
                            disabled={isTogglingUnpaid}
                        >
                            {isTogglingUnpaid ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons
                                        name={request.unpaid ? 'check' : 'payment'}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.actionText}>
                                        {request.unpaid ? 'Mark Paid' : 'Mark Unpaid'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.completeButton,
                                { backgroundColor: trade.accent },
                                isCompleting && styles.actionButtonDisabled,
                            ]}
                            onPress={handleCompleteJob}
                            disabled={isCompleting}
                        >
                            {isCompleting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="done-all" size={20} color="#FFFFFF" />
                                    <Text style={styles.actionText}>Complete Job</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {request.status === 'completed' && request.unpaid && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.paidButton, isTogglingUnpaid && styles.actionButtonDisabled]}
                        onPress={handleToggleUnpaid}
                        disabled={isTogglingUnpaid}
                    >
                        {isTogglingUnpaid ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <MaterialIcons name="check" size={20} color="#FFFFFF" />
                                <Text style={styles.actionText}>Mark as Paid</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: DC.canvas,
    },
    loadingText: {
        fontSize: 14,
        color: DC.muted,
    },
    content: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    receiptCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 16,
        borderWidth: 0,
        marginBottom: 14,
        marginHorizontal: 0,
        boxShadow: MISTRI_ELEV.card,
        elevation: 2,
    },
    perforatedEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        top: -1,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: DC.surface,
    },
    perforation: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: DC.canvas,
        borderWidth: 0.5,
        borderColor: 'rgba(15, 23, 42, 0.1)',
    },
    perforatedBottomEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: DC.surface,
    },
    receiptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 0,
    },
    receiptBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    receiptLogo: {
        width: 28,
        height: 28,
        marginTop: 2,
    },
    receiptTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 1,
        color: DC.text,
    },
    receiptSubtitle: {
        fontSize: 11,
        color: DC.muted,
        marginTop: 0,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 0,
    },
    statusPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 0,
        paddingTop: 4,
    },
    metaItem: {
        width: '48%',
        marginTop: 6,
    },
    metaLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.3,
    },
    sectionBlock: {
        marginBottom: 8,
    },
    blockTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    blockText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 19,
        fontWeight: '500',
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 2,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customerInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    customerPhone: {
        fontSize: 12,
        color: '#6B7280',
    },
    callIcon: {
        padding: 8,
        borderRadius: 0,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    itemsList: {
        marginTop: 2,
    },
    itemGroup: {
        marginTop: 4,
        paddingBottom: 2,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        letterSpacing: 0.2,
    },
    itemLeader: {
        flex: 1,
        height: 1,
        backgroundColor: '#D1D5DB',
        marginHorizontal: 10,
        alignSelf: 'center',
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.5,
        minWidth: 80,
        textAlign: 'right',
    },
    itemDescription: {
        marginTop: 2,
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
    },
    totalRowReceipt: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 0,
        paddingTop: 0,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    totalPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.5,
    },
    timelineList: {
        marginTop: 2,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    timelineLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.3,
    },
    timelineValue: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
    },
    unpaidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 0,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        marginTop: 4,
        gap: 6,
    },
    unpaidText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 2,
    },
    ratingValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    reviewText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 19,
        marginTop: 6,
        fontStyle: 'italic',
    },
    mapCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        marginHorizontal: 0,
        marginBottom: 14,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: 180,
        borderRadius: 8,
    },
    directionsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderCurve: 'continuous',
        marginTop: 8,
        gap: 6,
    },
    directionsBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    stickyActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: DC.surface,
        padding: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(15, 23, 42, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 5,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderCurve: 'continuous',
        gap: 6,
    },
    acceptButton: {},
    declineButton: {
        backgroundColor: DC.surface,
        borderWidth: 2,
        borderColor: '#DC2626',
    },
    completeButton: {},
    unpaidButton: {
        backgroundColor: '#F59E0B',
    },
    paidButton: {
        backgroundColor: '#10B981',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    declineText: {
        color: '#DC2626',
        fontSize: 15,
        fontWeight: '600',
    },
});
