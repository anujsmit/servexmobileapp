// app/(protected)/(mistri)/job-details.tsx
import React, {
    useEffect,
    useState,
    useRef,
    Component,
    ErrorInfo,
    ReactNode,
    useMemo,
    useCallback,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    Platform,
    Image,
    Modal,
    TextInput,
    Vibration,
    Dimensions,
    FlatList,
} from 'react-native';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
    useServiceRequestQuery,
    useRatingStatusQuery,
    useStartWork,
    useMarkArrived,
    useCompleteJobWithPhotos,
    useCompletionPhotosQuery,
} from '../../../hooks/queries';
import { useServices } from '../../../context/ServicesContext';
import { RatingStars } from '../../../components/RatingStars';
import { useMistriTradeTheme } from '../../../context/MistriTradeThemeContext';
import { mistriDashboardColors as DC } from '../../../lib/mistriDashboardTokens';

const { width, height } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------
const safeString = (value, fallback = '-') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    try { return String(value); } catch { return fallback; }
};

const formatDateTime = (value) => {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch { return '-'; }
};

const formatDate = (value) => {
    if (!value) return '-';
    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch { return '-'; }
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// ---------------------------------------------------------------------------
// Dashed Line Component
// ---------------------------------------------------------------------------
const DashedLine = React.memo(({ style }) => (
    <View style={[{ flexDirection: 'row', overflow: 'hidden', marginHorizontal: -16 }, style]}>
        {Array.from({ length: 50 }).map((_, i) => (
            <View key={i} style={{ width: 6, height: 1, backgroundColor: 'rgba(15, 23, 42, 0.12)', marginRight: 4 }} />
        ))}
    </View>
));

// ---------------------------------------------------------------------------
// Status Timeline Component
// ---------------------------------------------------------------------------
const StatusTimeline = ({ 
    status, 
    createdAt, 
    assignedAt, 
    startedAt, 
    arrivedAt, 
    completedAt,
    isArrived,
    isNavigating,
}) => {
    const steps = [
        { 
            key: 'created', 
            label: 'Job Created', 
            timestamp: createdAt,
            icon: 'add-circle-outline',
            completed: !!createdAt,
        },
        { 
            key: 'accepted', 
            label: 'Job Accepted', 
            timestamp: assignedAt,
            icon: 'checkmark-circle-outline',
            completed: !!assignedAt,
        },
        { 
            key: 'navigating', 
            label: 'Navigating', 
            timestamp: null,
            icon: 'navigate-outline',
            completed: status === 'assigned' || status === 'in_progress' || status === 'completed',
            active: status === 'assigned' && !isArrived,
        },
        { 
            key: 'arrived', 
            label: 'Arrived at Location', 
            timestamp: arrivedAt,
            icon: 'location-outline',
            completed: !!arrivedAt || isArrived,
            active: isArrived && status !== 'completed',
        },
        { 
            key: 'work_started', 
            label: 'Work Started', 
            timestamp: startedAt,
            icon: 'construct-outline',
            completed: !!startedAt,
            active: status === 'in_progress' && !completedAt,
        },
        { 
            key: 'completed', 
            label: 'Job Completed', 
            timestamp: completedAt,
            icon: 'checkmark-done-circle-outline',
            completed: !!completedAt,
            active: status === 'completed',
        },
    ];

    const getStepStatus = (step) => {
        if (step.completed) return 'completed';
        if (step.active) return 'active';
        return 'pending';
    };

    const getStepColor = (stepStatus) => {
        switch (stepStatus) {
            case 'completed': return '#10B981';
            case 'active': return '#2563EB';
            default: return '#D1D5DB';
        }
    };

    const getStepIcon = (step, stepStatus) => {
        if (stepStatus === 'completed') {
            return <Ionicons name="checkmark-circle" size={20} color="#10B981" />;
        }
        if (stepStatus === 'active') {
            return <Ionicons name={step.icon} size={20} color="#2563EB" />;
        }
        return <Ionicons name="ellipse-outline" size={20} color="#D1D5DB" />;
    };

    return (
        <View style={styles.timelineContainer}>
            {steps.map((step, index) => {
                const stepStatus = getStepStatus(step);
                const stepColor = getStepColor(stepStatus);
                const isLast = index === steps.length - 1;

                return (
                    <View key={step.key} style={styles.timelineStep}>
                        <View style={styles.timelineStepLeft}>
                            <View style={[styles.timelineDot, { backgroundColor: stepColor }]}>
                                {getStepIcon(step, stepStatus)}
                            </View>
                            {!isLast && (
                                <View style={[styles.timelineLine, { backgroundColor: stepStatus === 'completed' ? '#10B981' : '#D1D5DB' }]} />
                            )}
                        </View>
                        <View style={styles.timelineStepRight}>
                            <View style={styles.timelineStepHeader}>
                                <Text style={[
                                    styles.timelineStepLabel,
                                    stepStatus === 'completed' && styles.timelineStepCompleted,
                                    stepStatus === 'active' && styles.timelineStepActive,
                                ]}>
                                    {step.label}
                                </Text>
                                {stepStatus === 'completed' && (
                                    <View style={styles.timelineStepBadge}>
                                        <Text style={styles.timelineStepBadgeText}>Done</Text>
                                    </View>
                                )}
                                {stepStatus === 'active' && (
                                    <View style={[styles.timelineStepBadge, styles.timelineStepBadgeActive]}>
                                        <Text style={[styles.timelineStepBadgeText, styles.timelineStepBadgeTextActive]}>In Progress</Text>
                                    </View>
                                )}
                            </View>
                            {step.timestamp && (
                                <Text style={styles.timelineStepTime}>{formatDateTime(step.timestamp)}</Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// ---------------------------------------------------------------------------
// Image Viewer Modal Component
// ---------------------------------------------------------------------------
const ImageViewerModal = ({ 
    visible, 
    photos, 
    onClose, 
    initialIndex = 0 
}: { 
    visible: boolean; 
    photos: string[]; 
    onClose: () => void; 
    initialIndex?: number;
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                    index: initialIndex,
                    animated: false,
                });
            }, 100);
        }
    }, [visible, initialIndex]);

    if (!visible || photos.length === 0) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.imageViewerOverlay}>
                <TouchableOpacity 
                    style={styles.imageViewerClose}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
                
                <FlatList
                    ref={flatListRef}
                    data={photos}
                    renderItem={({ item }) => (
                        <View style={styles.imageViewerSlide}>
                            <Image 
                                source={{ uri: item }} 
                                style={styles.imageViewerImage}
                                resizeMode="contain"
                            />
                        </View>
                    )}
                    keyExtractor={(_, index) => `photo-${index}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={initialIndex}
                    getItemLayout={(_, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    onScroll={(event) => {
                        const index = Math.round(event.nativeEvent.contentOffset.x / width);
                        setCurrentIndex(index);
                    }}
                    scrollEventThrottle={16}
                />

                {photos.length > 1 && (
                    <View style={styles.imageViewerCounter}>
                        <Text style={styles.imageViewerCounterText}>
                            {currentIndex + 1} / {photos.length}
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function JobDetailsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const params = useLocalSearchParams();
    const requestId = useMemo(() => safeString(params?.requestId, ''), [params?.requestId]);
    const { getServiceByName } = useServices();

    // State management
    const [isMounted, setIsMounted] = useState(true);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completionNote, setCompletionNote] = useState('');
    const [jobStatus, setJobStatus] = useState<'pending' | 'assigned' | 'in_progress' | 'completed' | 'canceled'>('pending');
    const [isOpeningMaps, setIsOpeningMaps] = useState(false);
    const [isArrived, setIsArrived] = useState(false);
    const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
    const [locationWatchId, setLocationWatchId] = useState<Location.LocationSubscription | null>(null);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

    // Mutations
    const startWorkMutation = useStartWork();
    const markArrivedMutation = useMarkArrived();
    const completeJobMutation = useCompleteJobWithPhotos();

    // Queries
    const {
        data: requestData,
        isLoading,
        refetch,
    } = useServiceRequestQuery(requestId, {
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
        enabled: !!requestId,
        retry: 3,
        retryDelay: 1000,
    });

    const { data: ratingData } = useRatingStatusQuery(requestId, {
        enabled: !!requestId && requestData?.request?.status === 'completed',
    });

    const { data: completionPhotosData } = useCompletionPhotosQuery(
        requestData?.request?.status === 'completed' ? requestId : null
    );

    // Safe data extraction
    const request = useMemo(() => requestData?.request || {}, [requestData]);
    const customerDetails = useMemo(() => requestData?.customerDetails || {}, [requestData]);
    const selectedServices = useMemo(() => requestData?.selectedServices || [], [requestData]);
    const completionPhotos = completionPhotosData?.photos || [];
    const warrantyInfo = completionPhotosData?.warranty;

    // Update job status from query
    useEffect(() => {
        if (request?.status) {
            setJobStatus(request.status);
        }
        if (request?.arrivedAt) {
            setIsArrived(true);
        }
    }, [request?.status, request?.arrivedAt]);

    // Calculate total price
    const totalPrice = useMemo(() => {
        try {
            if (!Array.isArray(selectedServices)) return 0;
            return selectedServices.reduce((sum, service) => {
                const price = Number(service?.price);
                return sum + (Number.isFinite(price) ? price : 0);
            }, 0);
        } catch { return 0; }
    }, [selectedServices]);

    // Service name
    const serviceName = useMemo(() => {
        try {
            const rawType = safeString(request?.type, 'service');
            const service = getServiceByName(rawType);
            if (service?.displayName) return service.displayName;
            if (typeof rawType === 'string' && rawType.length > 0) {
                return rawType.charAt(0).toUpperCase() + rawType.slice(1);
            }
            return 'Unknown Service';
        } catch { return 'Unknown Service'; }
    }, [request?.type, getServiceByName]);

    // Status helpers
    const getStatusColor = useCallback(() => {
        switch (jobStatus) {
            case 'pending': return '#F59E0B';
            case 'assigned': return '#2563EB';
            case 'in_progress': return '#8B5CF6';
            case 'completed': return '#10B981';
            case 'canceled': return '#EF4444';
            default: return '#6B7280';
        }
    }, [jobStatus]);

    const getStatusLabel = useCallback(() => {
        switch (jobStatus) {
            case 'pending': return 'Pending';
            case 'assigned': return 'Assigned';
            case 'in_progress': return 'In Progress';
            case 'completed': return 'Completed ✅';
            case 'canceled': return 'Canceled';
            default: return 'Unknown';
        }
    }, [jobStatus]);

    const getStatusIcon = useCallback(() => {
        switch (jobStatus) {
            case 'pending': return 'hourglass-empty';
            case 'assigned': return 'check-circle';
            case 'in_progress': return 'work';
            case 'completed': return 'done-all';
            case 'canceled': return 'cancel';
            default: return 'help';
        }
    }, [jobStatus]);

    // ---------------------------------------------------------------------------
    // STEP 1: Start & Navigate - Open Google Maps
    // ---------------------------------------------------------------------------
    const openGoogleMaps = useCallback(async () => {
        const lat = request?.lat;
        const lng = request?.lng;
        const address = request?.address;

        if (!lat || !lng) {
            Alert.alert('Error', 'Location coordinates not available');
            return;
        }

        if (isOpeningMaps) return;
        setIsOpeningMaps(true);

        try {
            const destination = `${lat},${lng}`;
            const destinationLabel = encodeURIComponent(address || 'Customer Location');

            let url: string;

            if (Platform.OS === 'ios') {
                url = `https://maps.apple.com/?daddr=${destination}&q=${destinationLabel}`;
            } else {
                url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
            }

            console.log('Opening maps with URL:', url);

            const supported = await Linking.canOpenURL(url);

            if (supported) {
                await Linking.openURL(url);
                startArrivalTracking();

                Alert.alert(
                    '📍 Navigation Started',
                    'Google Maps is guiding you to the customer\'s location.\n\nWe\'ll detect when you arrive and show the start work option.',
                    [{ text: 'OK', style: 'default' }]
                );
            } else {
                const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${destination}`;
                await Linking.openURL(fallbackUrl);
            }
        } catch (error) {
            console.error('Error opening maps:', error);
            Alert.alert(
                'Error',
                'Could not open maps. Please make sure Google Maps is installed.',
                [
                    {
                        text: 'Try Again',
                        onPress: () => {
                            setIsOpeningMaps(false);
                            openGoogleMaps();
                        }
                    },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } finally {
            setIsOpeningMaps(false);
        }
    }, [request?.lat, request?.lng, request?.address, isOpeningMaps]);

    // ---------------------------------------------------------------------------
    // STEP 2: Track Arrival - Start Location Tracking
    // ---------------------------------------------------------------------------
    const startArrivalTracking = useCallback(async () => {
        if (locationWatchId) return;

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Location permission denied');
                return;
            }

            const watch = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 10,
                    timeInterval: 5000,
                },
                (newLocation) => {
                    const lat = parseFloat(request?.lat || '0');
                    const lng = parseFloat(request?.lng || '0');

                    if (lat && lng) {
                        const distance = calculateDistance(
                            newLocation.coords.latitude,
                            newLocation.coords.longitude,
                            lat,
                            lng
                        );
                        setDistanceToDestination(distance);

                        if (distance < 50 && !isArrived) {
                            setIsArrived(true);
                            Vibration.vibrate(500);

                            Alert.alert(
                                '📍 You\'ve Arrived!',
                                'You have reached the customer\'s location. Ready to start work?',
                                [
                                    {
                                        text: 'Start Work',
                                        onPress: handleStartWork,
                                    },
                                    {
                                        text: 'Not Yet',
                                        style: 'cancel',
                                    }
                                ]
                            );

                            if (locationWatchId) {
                                locationWatchId.remove();
                                setLocationWatchId(null);
                            }
                        }
                    }
                }
            );

            setLocationWatchId(watch);
        } catch (error) {
            console.error('Error starting location tracking:', error);
        }
    }, [request?.lat, request?.lng, isArrived, locationWatchId]);

    // Cleanup location tracking on unmount
    useEffect(() => {
        return () => {
            if (locationWatchId) {
                locationWatchId.remove();
                setLocationWatchId(null);
            }
        };
    }, [locationWatchId]);

    // ---------------------------------------------------------------------------
    // STEP 3: Start Work - Mark as In Progress
    // ---------------------------------------------------------------------------
    const handleStartWork = useCallback(async () => {
        try {
            // Mark arrived first if not already marked
            if (!request?.arrivedAt) {
                await markArrivedMutation.mutateAsync({
                    id: requestId,
                    coords: undefined,
                });
            }

            await startWorkMutation.mutateAsync(requestId);
            setJobStatus('in_progress');
            
            Alert.alert(
                '✅ Work Started',
                'You have started working on this job. Complete the work and then submit completion photos.',
                [{ text: 'OK', style: 'default' }]
            );

            refetch();
        } catch (error) {
            console.error('Error starting work:', error);
            Alert.alert('Error', 'Failed to start work. Please try again.');
        }
    }, [requestId, request?.arrivedAt, startWorkMutation, markArrivedMutation, refetch]);

    // ---------------------------------------------------------------------------
    // STEP 4: Complete Job - Open Modal for Photos
    // ---------------------------------------------------------------------------
    const handleCompleteJobPress = useCallback(() => {
        if (distanceToDestination !== null && distanceToDestination > 100 && !isArrived) {
            Alert.alert(
                '📍 Not at Location',
                `You are ${Math.round(distanceToDestination)} meters away from the customer's location. Please reach the location first.`,
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        setShowCompleteModal(true);
    }, [distanceToDestination, isArrived]);

    // ---------------------------------------------------------------------------
    // STEP 5: Submit Photos - Complete with Photos
    // ---------------------------------------------------------------------------
    const handleSubmitPhotos = useCallback(async (photos: string[], note: string) => {
        if (photos.length === 0) {
            Alert.alert('Photos Required', 'Please upload at least one completion photo.');
            return;
        }

        try {
            setIsSubmitting(true);

            const result = await completeJobMutation.mutateAsync({
                id: requestId,
                photos,
                note,
            });

            Alert.alert(
                '🎉 Job Completed!',
                'Thank you for completing this job. The customer has been notified.\n\n📸 7-Day Warranty has been activated for this job.',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowCompleteModal(false);
                            setSelectedPhotos([]);
                            setCompletionNote('');
                            setJobStatus('completed');
                            refetch();
                            router.back();
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('Error completing job:', error);
            Alert.alert('Error', 'Failed to complete job. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [requestId, completeJobMutation, refetch, router]);

    // ---------------------------------------------------------------------------
    // Photo Selection Handlers
    // ---------------------------------------------------------------------------
    const pickPhotos = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const newPhotos = result.assets.map(asset => asset.base64 || asset.uri);
                setSelectedPhotos(prev => [...prev, ...newPhotos]);
            }
        } catch (error) {
            console.error('Error picking images:', error);
            Alert.alert('Error', 'Failed to select images');
        }
    };

    const takePhoto = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Required', 'Camera permission is required to take photos');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const photo = result.assets[0].base64 || result.assets[0].uri;
                setSelectedPhotos(prev => [...prev, photo]);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    const removePhoto = (index: number) => {
        setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handlePhotoPress = (index: number) => {
        setSelectedPhotoIndex(index);
        setShowImageViewer(true);
    };

    const shortRequestId = useMemo(() => {
        try { return requestId ? requestId.slice(0, 8).toUpperCase() : '-'; } catch { return '-'; }
    }, [requestId]);

    const formatDistance = (meters: number) => {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    };

    // Loading state
    if (isLoading || !request?.id) {
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
                    <ActivityIndicator size="large" color={trade?.accent || '#2563EB'} />
                    <Text style={styles.loadingText}>Loading job details...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    const isCompleted = jobStatus === 'completed';

    // Main render
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
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 180 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Job Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: getStatusColor() + '15', borderColor: getStatusColor() + '30' }]}>
                    <View style={[styles.statusBannerIcon, { backgroundColor: getStatusColor() }]}>
                        <MaterialIcons name={getStatusIcon()} size={20} color="#FFFFFF" />
                    </View>
                    <View style={styles.statusBannerContent}>
                        <View style={styles.statusBannerHeader}>
                            <Text style={styles.statusBannerTitle}>Job {getStatusLabel()}</Text>
                            {isCompleted && (
                                <View style={styles.completedCheckmark}>
                                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                </View>
                            )}
                        </View>
                        <Text style={styles.statusBannerSubtitle}>
                            {jobStatus === 'pending' && 'Awaiting your acceptance'}
                            {jobStatus === 'assigned' && 'Ready to navigate to location'}
                            {jobStatus === 'in_progress' && 'Work in progress'}
                            {jobStatus === 'completed' && 'Successfully completed ✅'}
                            {jobStatus === 'canceled' && 'Job has been canceled'}
                        </Text>
                        {jobStatus === 'assigned' && isArrived && (
                            <View style={styles.arrivedBadge}>
                                <Ionicons name="location" size={12} color="#FFFFFF" />
                                <Text style={styles.arrivedBadgeText}>You've arrived!</Text>
                            </View>
                        )}
                        {jobStatus === 'assigned' && distanceToDestination !== null && !isArrived && (
                            <View style={styles.distanceBadge}>
                                <Ionicons name="location-outline" size={12} color="#FFFFFF" />
                                <Text style={styles.distanceBadgeText}>
                                    {formatDistance(distanceToDestination)} away
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Status Timeline - DETAILED CHECKLIST */}
                <View style={styles.timelineCard}>
                    <Text style={styles.timelineCardTitle}>📋 Job Progress</Text>
                    <StatusTimeline
                        status={jobStatus}
                        createdAt={request?.createdAt}
                        assignedAt={request?.assignedAt}
                        startedAt={request?.startedAt}
                        arrivedAt={request?.arrivedAt || (isArrived ? new Date().toISOString() : null)}
                        completedAt={request?.completedAt}
                        isArrived={isArrived}
                        isNavigating={jobStatus === 'assigned' && !isArrived}
                    />
                </View>

                {/* Receipt Card */}
                <View style={styles.receiptCard}>
                    <View style={styles.receiptHeader}>
                        <View style={styles.receiptBrand}>
                            <Text style={styles.receiptTitle}>ServeX</Text>
                            <Text style={styles.receiptSubtitle}>Job Receipt</Text>
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
                            <Text style={styles.metaValue}>{formatDateTime(request?.createdAt)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Customer</Text>
                            <Text style={styles.metaValue}>{safeString(customerDetails?.name)}</Text>
                        </View>
                    </View>

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Customer Contact */}
                    {customerDetails?.name && (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.blockTitle}>Customer Contact</Text>
                            <View style={styles.customerRow}>
                                <View style={styles.avatarPlaceholder}>
                                    <MaterialIcons name="person" size={24} color="#9CA3AF" />
                                </View>
                                <View style={styles.customerInfo}>
                                    <Text style={styles.customerName}>{safeString(customerDetails?.name)}</Text>
                                    <Text style={styles.customerPhone}>{safeString(customerDetails?.phone, 'No phone')}</Text>
                                </View>
                                {customerDetails?.phone && (
                                    <TouchableOpacity
                                        style={styles.callIcon}
                                        onPress={() => {
                                            Linking.openURL(`tel:${customerDetails.phone}`).catch(() => {
                                                Alert.alert('Error', 'Could not open phone dialer');
                                            });
                                        }}
                                    >
                                        <Ionicons name="call" size={20} color="#10B981" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Location Section */}
                    <View style={styles.sectionBlock}>
                        <Text style={styles.blockTitle}>Service Location</Text>
                        <View style={styles.locationContainer}>
                            <View style={styles.locationIconContainer}>
                                <MaterialIcons name="location-on" size={20} color="#DC2626" />
                            </View>
                            <View style={styles.locationTextContainer}>
                                <Text style={styles.locationAddress} numberOfLines={3}>
                                    {safeString(request?.address, 'No address provided')}
                                </Text>
                                {(jobStatus === 'assigned' || jobStatus === 'in_progress') && (
                                    <TouchableOpacity
                                        style={styles.directionsButton}
                                        onPress={openGoogleMaps}
                                        disabled={isOpeningMaps}
                                        activeOpacity={0.8}
                                    >
                                        {isOpeningMaps ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="navigate" size={16} color="#FFFFFF" />
                                                <Text style={styles.directionsText}>Open Google Maps</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Services */}
                    {selectedServices.length > 0 && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Services & Charges</Text>
                                {selectedServices.map((service, index) => (
                                    <View key={service?.id ?? `service-${index}`} style={styles.itemGroup}>
                                        <View style={styles.itemRow}>
                                            <Text style={styles.itemName} numberOfLines={1}>
                                                {safeString(service?.name, 'Service')}
                                            </Text>
                                            <Text style={styles.itemPrice}>
                                                Rs. {Number(service?.price || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                <DashedLine style={{ marginVertical: 8 }} />
                                <View style={styles.totalRowReceipt}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalPrice}>Rs. {totalPrice.toLocaleString()}</Text>
                                </View>
                            </View>
                        </>
                    )}

                    {/* Customer Notes */}
                    {request?.customerNotes && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Notes</Text>
                                <Text style={styles.blockText}>{safeString(request?.customerNotes)}</Text>
                            </View>
                        </>
                    )}

                    {/* Completion Photos - Show when completed */}
                    {isCompleted && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <View style={styles.photoHeader}>
                                    <Text style={styles.blockTitle}>Completion Photos</Text>
                                    <Text style={styles.photoCount}>{completionPhotos.length} photos</Text>
                                </View>
                                {completionPhotos.length > 0 ? (
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.photoScrollView}
                                    >
                                        {completionPhotos.map((photo, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.photoThumbnail}
                                                onPress={() => handlePhotoPress(index)}
                                                activeOpacity={0.8}
                                            >
                                                <Image 
                                                    source={{ uri: photo }} 
                                                    style={styles.photoThumbnailImage}
                                                />
                                                <View style={styles.photoOverlay}>
                                                    <Ionicons name="expand" size={20} color="#FFFFFF" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    <View style={styles.noPhotosContainer}>
                                        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                                        <Text style={styles.noPhotosText}>No photos uploaded</Text>
                                    </View>
                                )}
                                {warrantyInfo?.isActive && (
                                    <View style={styles.warrantyBadge}>
                                        <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
                                        <Text style={styles.warrantyBadgeText}>
                                            7-Day Warranty Active ({warrantyInfo.daysRemaining || 0} days left)
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}

                    {/* Payment Status */}
                    {request?.unpaid && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.unpaidRow}>
                                <MaterialIcons name="warning" size={18} color="#DC2626" />
                                <Text style={styles.unpaidText}>Payment Pending</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Distance info when navigating */}
                {jobStatus === 'assigned' && distanceToDestination !== null && !isArrived && (
                    <View style={styles.distanceInfoCard}>
                        <Ionicons name="location-sharp" size={20} color={GREEN.primary} />
                        <Text style={styles.distanceInfoText}>
                            {formatDistance(distanceToDestination)} from destination
                        </Text>
                        <Text style={styles.distanceInfoSubtext}>
                            We'll notify you when you arrive
                        </Text>
                    </View>
                )}

                {jobStatus === 'assigned' && isArrived && (
                    <View style={styles.arrivedInfoCard}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        <View>
                            <Text style={styles.arrivedInfoTitle}>You've Arrived!</Text>
                            <Text style={styles.arrivedInfoSubtext}>
                                Tap "Start Work" to begin the job
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Sticky Action Buttons */}
            <View style={styles.stickyActions}>
                {jobStatus === 'pending' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton, { backgroundColor: trade?.accent || '#2563EB' }]}
                        onPress={() => {
                            router.push({
                                pathname: '/(protected)/(mistri)/accept-job',
                                params: { requestId },
                            });
                        }}
                    >
                        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Accept Job</Text>
                    </TouchableOpacity>
                )}

                {jobStatus === 'assigned' && !isArrived && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.navigateButton, { backgroundColor: '#2563EB' }]}
                        onPress={openGoogleMaps}
                        disabled={isOpeningMaps}
                    >
                        {isOpeningMaps ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="navigate" size={22} color="#FFFFFF" />
                                <Text style={styles.actionText}>Start & Navigate</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {jobStatus === 'assigned' && isArrived && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.startButton, { backgroundColor: '#10B981' }]}
                        onPress={handleStartWork}
                        disabled={startWorkMutation.isPending}
                    >
                        {startWorkMutation.isPending ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="play-circle" size={22} color="#FFFFFF" />
                                <Text style={styles.actionText}>Start Work</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {jobStatus === 'in_progress' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.completeButton, { backgroundColor: '#10B981' }]}
                        onPress={handleCompleteJobPress}
                    >
                        <Ionicons name="checkmark-done-circle" size={22} color="#FFFFFF" />
                        <Text style={styles.actionText}>Complete & Submit Photos</Text>
                    </TouchableOpacity>
                )}

                {jobStatus === 'completed' && (
                    <View style={styles.completedActions}>
                        <View style={styles.completedBadge}>
                            <MaterialIcons name="check-circle" size={18} color="#10B981" />
                            <Text style={styles.completedBadgeText}>Job Completed ✅</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.backButton]}
                            onPress={() => router.back()}
                        >
                            <MaterialIcons name="arrow-back" size={20} color="#6B7280" />
                            <Text style={styles.backButtonText}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Completion Modal - Submit Photos */}
            <Modal
                visible={showCompleteModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    if (!isSubmitting) {
                        setShowCompleteModal(false);
                        setSelectedPhotos([]);
                        setCompletionNote('');
                    }
                }}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => {
                            if (!isSubmitting) {
                                setShowCompleteModal(false);
                                setSelectedPhotos([]);
                                setCompletionNote('');
                            }
                        }}
                    />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <View style={styles.modalHeaderIcon}>
                                    <MaterialIcons name="check-circle" size={24} color="#10B981" />
                                </View>
                                <View>
                                    <Text style={styles.modalTitle}>Complete Job</Text>
                                    <Text style={styles.modalSubtitle}>Upload completion photos</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => {
                                    if (!isSubmitting) {
                                        setShowCompleteModal(false);
                                        setSelectedPhotos([]);
                                        setCompletionNote('');
                                    }
                                }}
                                disabled={isSubmitting}
                            >
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.photoSection}>
                                <View style={styles.photoHeader}>
                                    <Text style={styles.photoLabel}>Completion Photos</Text>
                                    <Text style={styles.photoCount}>
                                        {selectedPhotos.length}/5
                                    </Text>
                                </View>
                                <Text style={styles.photoSubtext}>
                                    Upload photos of the completed work (max 5 photos)
                                </Text>

                                {selectedPhotos.length > 0 ? (
                                    <View style={styles.photoGrid}>
                                        {selectedPhotos.map((photo, index) => (
                                            <View key={index} style={styles.photoGridItem}>
                                                <Image
                                                    source={{ uri: photo.startsWith('data:image') ? photo : `data:image/jpeg;base64,${photo}` }}
                                                    style={styles.photoGridImage}
                                                />
                                                <TouchableOpacity
                                                    style={styles.photoRemoveButton}
                                                    onPress={() => removePhoto(index)}
                                                    disabled={isSubmitting}
                                                >
                                                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        {selectedPhotos.length < 5 && (
                                            <TouchableOpacity
                                                style={[styles.addPhotoButton, isSubmitting && styles.disabledButton]}
                                                onPress={pickPhotos}
                                                disabled={isSubmitting}
                                            >
                                                <MaterialIcons name="add-photo-alternate" size={32} color="#94A3B8" />
                                                <Text style={styles.addPhotoText}>Add Photo</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.emptyPhotoState}>
                                        <View style={styles.emptyPhotoIconContainer}>
                                            <MaterialIcons name="photo-camera" size={40} color="#94A3B8" />
                                        </View>
                                        <Text style={styles.emptyPhotoTitle}>No photos uploaded</Text>
                                        <Text style={styles.emptyPhotoSubtext}>
                                            Take photos or select from gallery to show completed work
                                        </Text>
                                        <View style={styles.photoActionRow}>
                                            <TouchableOpacity
                                                style={[styles.photoActionButton, styles.cameraButton]}
                                                onPress={takePhoto}
                                                disabled={isSubmitting}
                                            >
                                                <Ionicons name="camera" size={20} color="#FFFFFF" />
                                                <Text style={styles.photoActionText}>Take Photo</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.photoActionButton, styles.galleryButton]}
                                                onPress={pickPhotos}
                                                disabled={isSubmitting}
                                            >
                                                <MaterialIcons name="photo-library" size={20} color="#FFFFFF" />
                                                <Text style={styles.photoActionText}>Choose from Gallery</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {selectedPhotos.length > 0 && selectedPhotos.length < 5 && (
                                    <View style={styles.quickPhotoActions}>
                                        <TouchableOpacity
                                            style={[styles.quickPhotoButton, styles.cameraButton]}
                                            onPress={takePhoto}
                                            disabled={isSubmitting}
                                        >
                                            <Ionicons name="camera" size={16} color="#FFFFFF" />
                                            <Text style={styles.quickPhotoText}>Take More</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.quickPhotoButton, styles.galleryButton]}
                                            onPress={pickPhotos}
                                            disabled={isSubmitting}
                                        >
                                            <MaterialIcons name="photo-library" size={16} color="#FFFFFF" />
                                            <Text style={styles.quickPhotoText}>Add from Gallery</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={styles.noteSection}>
                                <Text style={styles.noteLabel}>Completion Note</Text>
                                <TextInput
                                    style={styles.noteInput}
                                    placeholder="Add a note about the completed work (optional)"
                                    placeholderTextColor="#94A3B8"
                                    multiline
                                    numberOfLines={4}
                                    value={completionNote}
                                    onChangeText={setCompletionNote}
                                    editable={!isSubmitting}
                                />
                            </View>

                            <View style={styles.warrantyInfo}>
                                <MaterialIcons name="verified" size={20} color="#F59E0B" />
                                <View style={styles.warrantyTextContainer}>
                                    <Text style={styles.warrantyTitle}>7-Day Warranty</Text>
                                    <Text style={styles.warrantySubtext}>
                                        Photos uploaded will be used for warranty claims. The customer can claim warranty within 7 days.
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => {
                                    if (!isSubmitting) {
                                        setShowCompleteModal(false);
                                        setSelectedPhotos([]);
                                        setCompletionNote('');
                                    }
                                }}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalSubmitButton,
                                    selectedPhotos.length === 0 && styles.modalSubmitDisabled,
                                    isSubmitting && styles.modalSubmitDisabled,
                                ]}
                                onPress={() => handleSubmitPhotos(selectedPhotos, completionNote)}
                                disabled={selectedPhotos.length === 0 || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons name="check" size={18} color="#FFFFFF" />
                                        <Text style={styles.modalSubmitText}>Submit & Complete</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Image Viewer Modal */}
            <ImageViewerModal
                visible={showImageViewer}
                photos={completionPhotos}
                onClose={() => setShowImageViewer(false)}
                initialIndex={selectedPhotoIndex}
            />
        </SafeAreaContainer>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const GREEN = {
    primary: '#0d9488',
    primaryDark: '#0f766e',
    primaryLight: '#14b8a6',
    primaryMuted: '#ccfbf1',
    primaryBg: '#f0fdfa',
    success: '#10b981',
    successDark: '#059669',
    accent: '#0d9488',
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: DC.canvas,
        paddingHorizontal: 24,
    },
    loadingText: {
        fontSize: 14,
        color: DC.muted,
        textAlign: 'center',
    },
    content: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 20,
    },
    // Status Banner
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 14,
        borderWidth: 1,
        gap: 12,
    },
    statusBannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusBannerContent: {
        flex: 1,
    },
    statusBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    statusBannerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 1,
    },
    completedCheckmark: {
        marginLeft: 4,
    },
    arrivedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    arrivedBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#2563EB',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    distanceBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Timeline Card
    timelineCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    timelineCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 12,
    },
    timelineContainer: {
        paddingVertical: 4,
    },
    timelineStep: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    timelineStepLeft: {
        alignItems: 'center',
        marginRight: 14,
        width: 28,
    },
    timelineDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#D1D5DB',
        zIndex: 2,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginVertical: 2,
        backgroundColor: '#D1D5DB',
    },
    timelineStepRight: {
        flex: 1,
        paddingBottom: 8,
    },
    timelineStepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    timelineStepLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    timelineStepCompleted: {
        color: '#10B981',
        fontWeight: '600',
    },
    timelineStepActive: {
        color: '#2563EB',
        fontWeight: '600',
    },
    timelineStepBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    timelineStepBadgeActive: {
        backgroundColor: '#DBEAFE',
    },
    timelineStepBadgeText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    timelineStepBadgeTextActive: {
        color: '#2563EB',
    },
    timelineStepTime: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 2,
    },
    // Receipt Card
    receiptCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    receiptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    receiptBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
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
    locationContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    locationIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationAddress: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        lineHeight: 20,
        marginBottom: 8,
    },
    directionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'flex-start',
        gap: 6,
        minWidth: 120,
    },
    directionsText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
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
        borderRadius: 8,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#D1FAE5',
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
        marginRight: 8,
        letterSpacing: 0.2,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.5,
        minWidth: 80,
        textAlign: 'right',
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
        color: '#10B981',
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
    distanceInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#EFF6FF',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#93C5FD',
        marginTop: 8,
        marginBottom: 8,
    },
    distanceInfoText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1D4ED8',
        flex: 1,
    },
    distanceInfoSubtext: {
        fontSize: 11,
        color: '#3B82F6',
    },
    arrivedInfoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F0FDF4',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#86EFAC',
        marginTop: 8,
        marginBottom: 8,
    },
    arrivedInfoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    arrivedInfoSubtext: {
        fontSize: 11,
        color: '#047857',
    },
    unpaidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        marginTop: 8,
        gap: 6,
    },
    unpaidText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    // Photo styles
    photoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    photoCount: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    photoScrollView: {
        marginTop: 4,
        marginBottom: 8,
    },
    photoThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 8,
        marginRight: 10,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    photoThumbnailImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    photoOverlay: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 4,
    },
    noPhotosContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        gap: 8,
    },
    noPhotosText: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    warrantyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    warrantyBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    // Image Viewer
    imageViewerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    imageViewerClose: {
        position: 'absolute',
        top: 44,
        right: 20,
        zIndex: 10,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    imageViewerSlide: {
        width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageViewerImage: {
        width: width - 32,
        height: height - 120,
        borderRadius: 8,
    },
    imageViewerCounter: {
        position: 'absolute',
        bottom: 44,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    imageViewerCounterText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    // Sticky Actions
    stickyActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: DC.surface,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(15, 23, 42, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    acceptButton: {},
    navigateButton: {},
    startButton: {},
    completeButton: {},
    backButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    backButtonText: {
        color: '#6B7280',
        fontSize: 15,
        fontWeight: '600',
    },
    completedActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        flex: 1,
    },
    completedBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#065F46',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        minHeight: '60%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalHeaderIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 1,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        padding: 20,
        maxHeight: '70%',
    },
    photoSection: {
        marginBottom: 20,
    },
    photoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    photoLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    photoCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    photoSubtext: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 12,
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    photoGridItem: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    photoGridImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    photoRemoveButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPhotoButton: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
    },
    addPhotoText: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
    },
    emptyPhotoState: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    emptyPhotoIconContainer: {
        marginBottom: 12,
    },
    emptyPhotoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 4,
    },
    emptyPhotoSubtext: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 24,
    },
    photoActionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    photoActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    cameraButton: {
        backgroundColor: '#2563EB',
    },
    galleryButton: {
        backgroundColor: '#10B981',
    },
    photoActionText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    quickPhotoActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    quickPhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    quickPhotoText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    noteSection: {
        marginBottom: 16,
    },
    noteLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 8,
    },
    noteInput: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#0F172A',
        minHeight: 80,
        textAlignVertical: 'top',
        backgroundColor: '#F8FAFC',
    },
    warrantyInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#FFFBEB',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginTop: 8,
    },
    warrantyTextContainer: {
        flex: 1,
    },
    warrantyTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    warrantySubtext: {
        fontSize: 11,
        color: '#78350F',
        lineHeight: 16,
        marginTop: 2,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 10,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    modalButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 6,
    },
    modalCancelButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    modalSubmitButton: {
        backgroundColor: '#10B981',
    },
    modalSubmitDisabled: {
        opacity: 0.5,
    },
    modalSubmitText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    disabledButton: {
        opacity: 0.5,
    },
});