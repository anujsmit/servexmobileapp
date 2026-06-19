import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Image,
    ScrollView,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    useServiceRequestQuery,
    useCancelServiceRequest,
    useRatingStatusQuery,
    useCreateRating
} from '../../../../hooks/queries';
import { useServices } from '../../../../context/ServicesContext';
import { RatingStars } from '../../../../components/RatingStars';
import { RatingModal } from '../../../../components/RatingModal';

// Dashed line component since RN doesn't support borderStyle: 'dashed' on individual borders
const DashedLine = ({ style }: { style?: object }) => (
    <View style={[{ flexDirection: 'row', overflow: 'hidden', marginHorizontal: -16 }, style]}>
        {Array.from({ length: 50 }).map((_, i) => (
            <View key={i} style={{ width: 6, height: 1, backgroundColor: '#D1D5DB', marginRight: 4 }} />
        ))}
    </View>
);

export default function RequestDetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const requestId = params.id as string;
    const mistriName = params.mistriName as string;
    const { getServiceByName } = useServices();
    const [previousAssignedMistriId, setPreviousAssignedMistriId] = useState<string | null>(null);
    const [showRatingModal, setShowRatingModal] = useState(false);
    // Poll request every 5 seconds
    const { data: requestData, isLoading, error, isError } = useServiceRequestQuery(requestId, {
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
    });
    const { data: ratingStatus } = useRatingStatusQuery(requestId);
    const { mutateAsync: cancelRequest, status: cancelStatus } = useCancelServiceRequest();
    const { mutateAsync: createRating } = useCreateRating();
    const isCanceling = cancelStatus === 'pending';
    const request = requestData?.request;
    const mistriDetails = requestData?.mistriDetails;
    const selectedServices = requestData?.selectedServices || [];
    // Calculate total price from selected services
    const totalPrice = selectedServices.reduce((sum, service) => sum + parseFloat(service.price), 0);
    // Handle error or missing requestId
    useEffect(() => {
        if (!requestId) {
            Alert.alert('Error', 'Request ID not found', [
                { text: 'OK', onPress: () => router.replace('/(protected)/(customer)') },
            ]);
        }
    }, [requestId, router]);
    useEffect(() => {
        if (isError && error) {
            if (__DEV__) console.error('Error fetching request:', error);
            Alert.alert('Error', 'Failed to load request details. Please try again.', [
                { text: 'Go Back', onPress: () => router.back() },
            ]);
        }
    }, [isError, error, router]);
    // Detect if mistri rejected the request
    useEffect(() => {
        if (!request) return;
        if (previousAssignedMistriId === null && request.assignedMistriId) {
            setPreviousAssignedMistriId(request.assignedMistriId || null);
        }
        if (previousAssignedMistriId && !request.assignedMistriId && request.status === 'pending') {
            Alert.alert('Mistri Unavailable', `${mistriName} declined your request. Please select another mistri.`, [
                { text: 'Select Another', onPress: () => router.replace('/service-request') },
            ]);
        }
        if (request.status === 'assigned' && !previousAssignedMistriId) {
            setPreviousAssignedMistriId(request.assignedMistriId || null);
        }
    }, [request, previousAssignedMistriId, mistriName, router]);
    const handleCancelRequest = async () => {
        Alert.alert('Cancel Request', 'Are you sure you want to cancel this service request?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Cancel',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await cancelRequest(requestId);
                        Alert.alert('Request Canceled', 'Your service request has been canceled.', [
                            { text: 'OK', onPress: () => router.replace('/service-request') },
                        ]);
                    } catch (error) {
                        if (__DEV__) console.error('Error canceling request:', error);
                        Alert.alert('Error', 'Failed to cancel request. Please try again.');
                    }
                },
            },
        ]);
    };
    const handleCallMistri = () => {
        if (mistriDetails?.phone) {
            Linking.openURL(`tel:${mistriDetails.phone}`).catch((err) => {
                if (__DEV__) console.error('Error opening dialer:', err);
                Alert.alert('Error', 'Could not open phone dialer');
            });
        }
    };
    const handleSubmitRating = async (rating: number, review?: string) => {
        await createRating({ serviceRequestId: requestId, rating, review });
        Alert.alert('Success', 'Thank you for your feedback!');
    };
    const getStatusColor = () => {
        switch (request?.status) {
            case 'pending': return '#F59E0B';
            case 'assigned': return '#3B82F6';
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
    const formatDate = (value?: string) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };
    const shortRequestId = requestId ? requestId.slice(0, 8).toUpperCase() : '-';
    if (isLoading || !request) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Request Details"
                    leftElement={
                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaContainer>
        );
    }
    const serviceName = getServiceByName(request.type)?.displayName ||
        request.type.charAt(0).toUpperCase() + request.type.slice(1);
    // Timeline events
    const timelineEvents = [
        { label: 'Requested', timestamp: request.createdAt, completed: true },
        { label: 'Accepted', timestamp: request.assignedAt, completed: !!request.assignedAt },
        { label: 'Completed', timestamp: request.completedAt, completed: !!request.completedAt },
    ];
    return (
        <SafeAreaContainer>
            <PageTitle
                title="Job Details"
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                }
            />
            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 }]} // Space for sticky button
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.receiptCard}>
                    {/* Perforated Top Edge */}
                    <View style={styles.perforatedEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>
                    <View style={styles.receiptHeader}>
                        <View style={styles.receiptBrand}>
                            <Image
                                source={require('../../../../assets/images/logo.png')}
                                style={styles.receiptLogo}
                            />
                            <View>
                                <Text style={styles.receiptTitle}>ServeX</Text>
                                <Text style={styles.receiptSubtitle}>Service Receipt</Text>
                            </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: getStatusColor() }]}>
                            <MaterialIcons name={getStatusIcon()} size={14} color="#FFFFFF" />
                            <Text style={styles.statusPillText}>{getStatusLabel()}</Text>
                            {request.status === 'pending' && (
                                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 4 }} />
                            )}
                        </View>
                    </View>
                    <DashedLine style={{ marginBottom: 10 }} />
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
                            <Text style={styles.metaLabel}>Mistri</Text>
                            <Text style={[styles.metaValue, !mistriDetails?.name && !mistriName && { color: '#9CA3AF' }]}>
                                {mistriDetails?.name || mistriName || 'Pending'}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Contact</Text>
                            <Text style={[styles.metaValue, !mistriDetails?.phone && { color: '#9CA3AF' }]}>
                                {mistriDetails?.phone || '-'}
                            </Text>
                        </View>
                    </View>
                    <DashedLine style={{ marginVertical: 10 }} />
                    <View style={styles.sectionBlock}>
                        <Text style={styles.blockTitle}>Location</Text>
                        <Text style={styles.blockText} numberOfLines={3}>
                            {request.address}
                        </Text>
                    </View>
                    {selectedServices.length > 0 && (
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
                    )}
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
                    {request.unpaid && (
                        <View style={styles.unpaidRow}>
                            <MaterialIcons name="warning" size={18} color="#DC2626" />
                            <Text style={styles.unpaidText}>Payment Pending</Text>
                        </View>
                    )}
                    {request.status === 'assigned' && mistriDetails && (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.blockTitle}>Mistri</Text>
                            <View style={styles.mistriRow}>
                                {mistriDetails.profilePhotoUrl ? (
                                    <Image source={{ uri: mistriDetails.profilePhotoUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialIcons name="person" size={24} color="#9CA3AF" />
                                    </View>
                                )}
                                <View style={styles.mistriInfo}>
                                    <Text style={styles.mistriName}>{mistriDetails.name}</Text>
                                    <View style={styles.mistriMeta}>
                                        <RatingStars
                                            rating={mistriDetails.averageRating ? parseFloat(mistriDetails.averageRating as any) : 0}
                                            size={14}
                                            showNumber
                                        />
                                        <Text style={styles.metaDivider}>-</Text>
                                        <Text style={styles.metaText}>{mistriDetails.jobsCompleted || 0} jobs</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.callIcon} onPress={handleCallMistri}>
                                    <Ionicons name="call" size={20} color="#10B981" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    {request.status === 'completed' && (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.blockTitle}>Rating</Text>
                            {ratingStatus?.isRated ? (
                                <View style={styles.ratedContainer}>
                                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                    <Text style={styles.ratedText}>You rated this job</Text>
                                    <RatingStars rating={ratingStatus.rating?.rating || 0} size={16} />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.ratePrompt}
                                    onPress={() => setShowRatingModal(true)}
                                >
                                    <Ionicons name="star-outline" size={20} color="#F59E0B" />
                                    <Text style={styles.ratePromptText}>Rate your experience</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Perforated Bottom Edge */}
                    <View style={styles.perforatedBottomEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>
                </View>
            </ScrollView>
            {/* Sticky Action Buttons */}
            <View style={styles.stickyActions}>
                {request.status === 'pending' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelActionButton, isCanceling && styles.actionButtonDisabled]}
                        onPress={handleCancelRequest}
                        disabled={isCanceling}
                    >
                        {isCanceling ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                            <>
                                <Ionicons name="close-circle" size={20} color="#DC2626" />
                                <Text style={styles.cancelActionText}>Cancel Request</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
                {request.status === 'assigned' && mistriDetails && (
                    <TouchableOpacity style={styles.actionButton} onPress={handleCallMistri}>
                        <Ionicons name="call" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Call Mistri</Text>
                    </TouchableOpacity>
                )}
                {request.status === 'completed' && !ratingStatus?.isRated && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.ratingActionButton]}
                        onPress={() => setShowRatingModal(true)}
                    >
                        <Ionicons name="star" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Rate Service</Text>
                    </TouchableOpacity>
                )}
            </View>
            {/* Rating Modal */}
            <RatingModal
                visible={showRatingModal}
                onClose={() => setShowRatingModal(false)}
                onSubmit={handleSubmitRating}
                mistriName={mistriDetails?.name}
            />
        </SafeAreaContainer>
    );
}
const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    content: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    contentContainer: {
        padding: 12,
    },
    receiptCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 0,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginBottom: 12,
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    perforatedEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        top: -1,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: '#FFFFFF',
    },
    perforation: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F3F4F6',
        borderWidth: 0.5,
        borderColor: '#D1D5DB',
    },
    perforatedBottomEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: '#FFFFFF',
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
        color: '#111827',
    },
    receiptSubtitle: {
        fontSize: 11,
        color: '#6B7280',
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
        marginTop: 8,
    },
    unpaidText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    mistriRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 2,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mistriInfo: {
        flex: 1,
    },
    mistriName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    mistriMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaDivider: {
        marginHorizontal: 6,
        fontSize: 12,
        color: '#9CA3AF',
    },
    metaText: {
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
    ratedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 2,
        marginTop: 2,
    },
    ratedText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#059669',
    },
    ratePrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 2,
        marginTop: 2,
    },
    ratePromptText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#111827',
    },
    stickyActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    actionButton: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 0,
        gap: 6,
    },
    cancelActionButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#DC2626',
    },
    ratingActionButton: {
        backgroundColor: '#F59E0B',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    cancelActionText: {
        color: '#DC2626',
        fontSize: 15,
        fontWeight: '600',
    },
});
