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
    useRatingStatusQuery,
} from '../../../hooks/queries';
import { useServices } from '../../../context/ServicesContext';
import { RatingStars } from '../../../components/RatingStars';
import { useMistriTradeTheme } from '../../../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------
const isValidCoordinate = (lat, lng) => {
    try {
        const latitude = Number(lat);
        const longitude = Number(lng);
        
        return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180 &&
            !(latitude === 0 && longitude === 0)
        );
    } catch {
        return false;
    }
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
    } catch {
        return '-';
    }
};

const safeString = (value, fallback = '-') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    try {
        return String(value);
    } catch {
        return fallback;
    }
};

// ---------------------------------------------------------------------------
// Dashed Line Component
// ---------------------------------------------------------------------------
const DashedLine = React.memo(({ style }) => (
    <View style={[{ flexDirection: 'row', overflow: 'hidden', marginHorizontal: -16 }, style]}>
        {Array.from({ length: 50 }).map((_, i) => (
            <View 
                key={i} 
                style={{ 
                    width: 6, 
                    height: 1, 
                    backgroundColor: 'rgba(15, 23, 42, 0.12)', 
                    marginRight: 4 
                }} 
            />
        ))}
    </View>
));

// ---------------------------------------------------------------------------
// Error Boundary Component
// ---------------------------------------------------------------------------
interface ErrorBoundaryProps {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class JobDetailsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { 
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { 
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('JobDetailsScreen crashed:', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
        });
    }

    handleRetry = () => {
        this.setState({ 
            hasError: false,
            error: null,
        });
    };

    handleGoBack = () => {
        try {
            const router = (global as any).router;
            if (router?.back) {
                router.back();
            }
        } catch (e) {
            console.error('Failed to navigate back:', e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaContainer>
                    <View style={styles.errorContainer}>
                        <MaterialIcons name="error-outline" size={48} color="#DC2626" />
                        <Text style={styles.errorTitle}>Something went wrong</Text>
                        <Text style={styles.errorMessage}>
                            {this.state.error?.message || 'An unexpected error occurred loading this job.'}
                        </Text>
                        <View style={styles.errorActions}>
                            <TouchableOpacity 
                                style={styles.errorButton}
                                onPress={this.handleRetry}
                            >
                                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                                <Text style={styles.errorButtonText}>Try Again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.errorButton, styles.errorButtonSecondary]}
                                onPress={this.handleGoBack}
                            >
                                <MaterialIcons name="arrow-back" size={20} color="#6B7280" />
                                <Text style={styles.errorButtonTextSecondary}>Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaContainer>
            );
        }

        return this.props.children;
    }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function JobDetailsScreen() {
    return (
        <JobDetailsErrorBoundary>
            <JobDetailsScreenContent />
        </JobDetailsErrorBoundary>
    );
}

// ---------------------------------------------------------------------------
// Screen Content Component
// ---------------------------------------------------------------------------
function JobDetailsScreenContent() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const params = useLocalSearchParams();
    const requestId = useMemo(() => safeString(params?.requestId, ''), [params?.requestId]);
    const { getServiceByName } = useServices();
    
    // State management
    const [isCompleting, setIsCompleting] = useState(false);
    const [isTogglingUnpaid, setIsTogglingUnpaid] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);
    const [isMounted, setIsMounted] = useState(true);
    
    // Alert tracking refs
    const hasShownErrorAlertRef = useRef(false);
    const hasShownMissingIdAlertRef = useRef(false);
    const alertTimeoutRef = useRef(null);
    
    // Reset alert flags periodically
    useEffect(() => {
        const interval = setInterval(() => {
            hasShownErrorAlertRef.current = false;
            hasShownMissingIdAlertRef.current = false;
        }, 30000);
        
        return () => clearInterval(interval);
    }, []);
    
    // Component mount/unmount tracking
    useEffect(() => {
        setIsMounted(true);
        return () => {
            setIsMounted(false);
            if (alertTimeoutRef.current) {
                clearTimeout(alertTimeoutRef.current);
            }
        };
    }, []);
    
    // Safe alert wrapper
    const showAlert = useCallback((title, message, buttons) => {
        if (!isMounted) return;
        
        if (alertTimeoutRef.current) {
            clearTimeout(alertTimeoutRef.current);
        }
        
        alertTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
                try {
                    Alert.alert(title, message, buttons);
                } catch (error) {
                    console.error('Failed to show alert:', error);
                }
            }
        }, 100);
    }, [isMounted]);
    
    // Validate request ID
    useEffect(() => {
        if (!requestId && !hasShownMissingIdAlertRef.current) {
            hasShownMissingIdAlertRef.current = true;
            showAlert(
                'Error',
                'Request ID not found',
                [{ text: 'OK', onPress: () => {
                    try { router.back(); } catch (e) { console.error(e); }
                }}]
            );
        }
    }, [requestId, router, showAlert]);
    
    // Queries
    const { 
        data: requestData, 
        isLoading, 
        error, 
        isError,
        refetch 
    } = useServiceRequestQuery(requestId, {
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
        enabled: !!requestId,
        retry: 3,
        retryDelay: 1000,
        onError: (err) => {
            console.error('Query error:', err);
            if (isMounted && !hasShownErrorAlertRef.current) {
                hasShownErrorAlertRef.current = true;
                showAlert(
                    'Connection Error',
                    'Failed to load job details. Please check your connection and try again.',
                    [
                        { text: 'Retry', onPress: () => {
                            hasShownErrorAlertRef.current = false;
                            refetch();
                        }},
                        { text: 'Go Back', onPress: () => {
                            try { router.back(); } catch (e) { console.error(e); }
                        }}
                    ]
                );
            }
        }
    });
    
    const { data: ratingData } = useRatingStatusQuery(requestId, {
        enabled: !!requestId && requestData?.request?.status === 'completed',
    });
    
    // Safe data extraction
    const request = useMemo(() => {
        try {
            return requestData?.request || {};
        } catch {
            return {};
        }
    }, [requestData]);
    
    const customerDetails = useMemo(() => {
        try {
            return requestData?.customerDetails || {};
        } catch {
            return {};
        }
    }, [requestData]);
    
    const selectedServices = useMemo(() => {
        try {
            return Array.isArray(requestData?.selectedServices) 
                ? requestData.selectedServices 
                : [];
        } catch {
            return [];
        }
    }, [requestData]);
    
    // Calculate total price safely
    const totalPrice = useMemo(() => {
        try {
            if (!Array.isArray(selectedServices)) return 0;
            return selectedServices.reduce((sum, service) => {
                const price = Number(service?.price);
                return sum + (Number.isFinite(price) ? price : 0);
            }, 0);
        } catch (error) {
            console.error('Error calculating total price:', error);
            return 0;
        }
    }, [selectedServices]);
    
    // Get service name safely
    const serviceName = useMemo(() => {
        try {
            const rawType = safeString(request?.type, 'service');
            const service = getServiceByName(rawType);
            if (service?.displayName) return service.displayName;
            
            if (typeof rawType === 'string' && rawType.length > 0) {
                return rawType.charAt(0).toUpperCase() + rawType.slice(1);
            }
            return 'Unknown Service';
        } catch (error) {
            console.error('Error getting service name:', error);
            return 'Unknown Service';
        }
    }, [request?.type, getServiceByName]);
    
    // Check if location is valid
    const hasValidLocation = useMemo(() => {
        return isValidCoordinate(request?.lat, request?.lng);
    }, [request?.lat, request?.lng]);
    
    // Mutations
    const completeJobMutation = useCompleteServiceRequest();
    const toggleUnpaidMutation = useToggleUnpaid();
    const acceptJobMutation = useAcceptServiceRequest();
    const declineJobMutation = useDeclineServiceRequest();
    
    // Safe action handlers
    const handleCallCustomer = useCallback(() => {
        try {
            const phone = customerDetails?.phone;
            if (!phone) {
                showAlert('Error', 'Phone number not available');
                return;
            }
            
            Linking.canOpenURL(`tel:${phone}`).then(supported => {
                if (supported) {
                    return Linking.openURL(`tel:${phone}`);
                } else {
                    showAlert('Error', 'Phone calls are not supported on this device');
                }
            }).catch(error => {
                console.error('Error opening dialer:', error);
                showAlert('Error', 'Could not open phone dialer');
            });
        } catch (error) {
            console.error('Error in handleCallCustomer:', error);
            showAlert('Error', 'Failed to initiate call');
        }
    }, [customerDetails?.phone, showAlert]);
    
    const handleOpenMaps = useCallback(() => {
        try {
            if (!isValidCoordinate(request?.lat, request?.lng)) {
                showAlert('Error', 'Location coordinates not available');
                return;
            }
            
            const { lat, lng } = request;
            const label = encodeURIComponent(request?.address || 'Location');
            
            const url = Platform.select({
                ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
                android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
                default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            });
            
            Linking.openURL(url).catch(error => {
                console.error('Error opening maps:', error);
                // Fallback to Google Maps web
                const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                Linking.openURL(fallbackUrl).catch(() => {
                    showAlert('Error', 'Could not open maps');
                });
            });
        } catch (error) {
            console.error('Error in handleOpenMaps:', error);
            showAlert('Error', 'Failed to open maps');
        }
    }, [request?.lat, request?.lng, request?.address, showAlert]);
    
    const handleCompleteJob = useCallback(() => {
        if (isCompleting) return;
        
        Alert.alert(
            'Complete Job',
            'Mark this job as completed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    style: 'default',
                    onPress: async () => {
                        if (!isMounted) return;
                        setIsCompleting(true);
                        
                        try {
                            await completeJobMutation.mutateAsync(requestId);
                            if (isMounted) {
                                showAlert('Success', 'Job marked as completed');
                            }
                        } catch (err) {
                            console.error('Error completing job:', err);
                            if (isMounted) {
                                showAlert('Error', 'Failed to complete job. Please try again.');
                            }
                        } finally {
                            if (isMounted) {
                                setIsCompleting(false);
                            }
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, [isCompleting, isMounted, requestId, completeJobMutation, showAlert]);
    
    const handleToggleUnpaid = useCallback(async () => {
        if (isTogglingUnpaid || !isMounted) return;
        
        setIsTogglingUnpaid(true);
        try {
            await toggleUnpaidMutation.mutateAsync(requestId);
            if (isMounted) {
                const newStatus = !request?.unpaid;
                showAlert('Success', newStatus ? 'Job marked as unpaid' : 'Unpaid status removed');
            }
        } catch (err) {
            console.error('Error toggling unpaid:', err);
            if (isMounted) {
                showAlert('Error', 'Failed to update unpaid status. Please try again.');
            }
        } finally {
            if (isMounted) {
                setIsTogglingUnpaid(false);
            }
        }
    }, [isTogglingUnpaid, isMounted, requestId, request?.unpaid, toggleUnpaidMutation, showAlert]);
    
    const handleAcceptJob = useCallback(() => {
        if (isAccepting) return;
        
        Alert.alert(
            'Accept Job',
            'Accept this job request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    style: 'default',
                    onPress: async () => {
                        if (!isMounted) return;
                        setIsAccepting(true);
                        
                        try {
                            await acceptJobMutation.mutateAsync(requestId);
                            if (isMounted) {
                                showAlert('Success', 'Job accepted successfully');
                            }
                        } catch (err) {
                            console.error('Error accepting job:', err);
                            if (isMounted) {
                                showAlert('Error', 'Failed to accept job. Please try again.');
                            }
                        } finally {
                            if (isMounted) {
                                setIsAccepting(false);
                            }
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, [isAccepting, isMounted, requestId, acceptJobMutation, showAlert]);
    
    const handleDeclineJob = useCallback(() => {
        if (isDeclining) return;
        
        Alert.alert(
            'Decline Job',
            'Are you sure you want to decline this job?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        if (!isMounted) return;
                        setIsDeclining(true);
                        
                        try {
                            await declineJobMutation.mutateAsync(requestId);
                            if (isMounted) {
                                showAlert('Success', 'Job declined');
                                try {
                                    router.back();
                                } catch (e) {
                                    console.error('Navigation error:', e);
                                }
                            }
                        } catch (err) {
                            console.error('Error declining job:', err);
                            if (isMounted) {
                                showAlert('Error', 'Failed to decline job. Please try again.');
                            }
                        } finally {
                            if (isMounted) {
                                setIsDeclining(false);
                            }
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, [isDeclining, isMounted, requestId, declineJobMutation, router, showAlert]);
    
    // Status helpers
    const getStatusColor = useCallback(() => {
        try {
            switch (request?.status) {
                case 'pending': return '#F59E0B';
                case 'assigned': return trade?.accent || '#2563EB';
                case 'completed': return '#10B981';
                case 'canceled': return '#EF4444';
                default: return '#6B7280';
            }
        } catch {
            return '#6B7280';
        }
    }, [request?.status, trade?.accent]);
    
    const getStatusLabel = useCallback(() => {
        try {
            switch (request?.status) {
                case 'pending': return 'Waiting';
                case 'assigned': return 'Accepted';
                case 'completed': return 'Completed';
                case 'canceled': return 'Canceled';
                default: return 'Unknown';
            }
        } catch {
            return 'Unknown';
        }
    }, [request?.status]);
    
    const getStatusIcon = useCallback(() => {
        try {
            switch (request?.status) {
                case 'pending': return 'hourglass-empty';
                case 'assigned': return 'check-circle';
                case 'completed': return 'done-all';
                case 'canceled': return 'cancel';
                default: return 'help';
            }
        } catch {
            return 'help';
        }
    }, [request?.status]);
    
    // Timeline events
    const timelineEvents = useMemo(() => [
        { label: 'Requested', timestamp: request?.createdAt, completed: true },
        { label: 'Accepted', timestamp: request?.assignedAt, completed: !!request?.assignedAt },
        { label: 'Completed', timestamp: request?.completedAt, completed: !!request?.completedAt },
    ], [request?.createdAt, request?.assignedAt, request?.completedAt]);
    
    const shortRequestId = useMemo(() => {
        try {
            return requestId ? requestId.slice(0, 8).toUpperCase() : '-';
        } catch {
            return '-';
        }
    }, [requestId]);
    
    // Loading state
    if (isLoading || !request?.id) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    variant="mistri"
                    title="Job Details"
                    leftElement={
                        <TouchableOpacity 
                            onPress={() => {
                                try { router.back(); } catch (e) { console.error(e); }
                            }} 
                            activeOpacity={0.7}
                        >
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
    
    // Main render
    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Job Details"
                leftElement={
                    <TouchableOpacity 
                        onPress={() => {
                            try { router.back(); } catch (e) { console.error(e); }
                        }} 
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={DC.text} />
                    </TouchableOpacity>
                }
            />
            
            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Receipt Card */}
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
                            <Text style={styles.metaValue}>{formatDateTime(request?.createdAt)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Customer</Text>
                            <Text style={styles.metaValue}>{safeString(customerDetails?.name)}</Text>
                        </View>
                    </View>
                    
                    <DashedLine style={{ marginVertical: 10 }} />
                    
                    {/* Customer Contact - Only for assigned jobs */}
                    {request?.status === 'assigned' && customerDetails?.name && (
                        <>
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Contact</Text>
                                <View style={styles.customerRow}>
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialIcons name="person" size={24} color="#9CA3AF" />
                                    </View>
                                    <View style={styles.customerInfo}>
                                        <Text style={styles.customerName}>
                                            {safeString(customerDetails?.name)}
                                        </Text>
                                        <Text style={styles.customerPhone}>
                                            {safeString(customerDetails?.phone, 'No phone')}
                                        </Text>
                                    </View>
                                    {customerDetails?.phone && (
                                        <TouchableOpacity 
                                            style={styles.callIcon} 
                                            onPress={handleCallCustomer}
                                        >
                                            <Ionicons name="call" size={20} color="#10B981" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            <DashedLine style={{ marginVertical: 10 }} />
                        </>
                    )}
                    
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
                                {hasValidLocation && (
                                    <TouchableOpacity
                                        style={styles.getDirectionsButton}
                                        onPress={handleOpenMaps}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialIcons name="directions" size={16} color="#FFFFFF" />
                                        <Text style={styles.getDirectionsText}>Get Directions</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                    
                    {/* Services with Total */}
                    {selectedServices.length > 0 && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Services & Charges</Text>
                                <View style={styles.itemsList}>
                                    {selectedServices.map((service, index) => {
                                        try {
                                            const priceValue = Number(service?.price);
                                            const safePrice = Number.isFinite(priceValue) ? priceValue : 0;
                                            return (
                                                <View 
                                                    key={service?.id ?? `service-${index}`} 
                                                    style={styles.itemGroup}
                                                >
                                                    <View style={styles.itemRow}>
                                                        <Text style={styles.itemName} numberOfLines={1}>
                                                            {safeString(service?.name, 'Service')}
                                                        </Text>
                                                        <Text style={styles.itemPrice}>
                                                            Rs. {safePrice.toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    {service?.description && (
                                                        <Text style={styles.itemDescription} numberOfLines={2}>
                                                            {safeString(service?.description)}
                                                        </Text>
                                                    )}
                                                </View>
                                            );
                                        } catch (error) {
                                            console.error('Error rendering service item:', error);
                                            return null;
                                        }
                                    })}
                                </View>
                                
                                <DashedLine style={{ marginVertical: 10 }} />
                                
                                {/* Total */}
                                <View style={styles.totalRowReceipt}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={styles.totalPrice}>
                                        Rs. {totalPrice.toLocaleString()}
                                    </Text>
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
                                <Text style={styles.blockText}>
                                    {safeString(request?.customerNotes)}
                                </Text>
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
                    {request?.unpaid && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.unpaidRow}>
                                <MaterialIcons name="warning" size={18} color="#DC2626" />
                                <Text style={styles.unpaidText}>Payment Pending</Text>
                            </View>
                        </>
                    )}
                    
                    {/* Rating - Only for completed jobs */}
                    {request?.status === 'completed' && ratingData?.rating && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.sectionBlock}>
                                <Text style={styles.blockTitle}>Customer Rating</Text>
                                <View style={styles.ratingRow}>
                                    <RatingStars rating={ratingData.rating.rating} size={16} />
                                    <Text style={styles.ratingValue}>
                                        {ratingData.rating.rating.toFixed(1)}
                                    </Text>
                                </View>
                                {ratingData.rating.review && (
                                    <Text style={styles.reviewText}>
                                        {safeString(ratingData.rating.review)}
                                    </Text>
                                )}
                            </View>
                        </>
                    )}
                    
                    {/* Completed Status Banner */}
                    {request?.status === 'completed' && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.completedBanner}>
                                <MaterialIcons name="check-circle" size={24} color="#10B981" />
                                <View style={styles.completedBannerText}>
                                    <Text style={styles.completedBannerTitle}>Job Completed</Text>
                                    <Text style={styles.completedBannerDate}>
                                        Completed on {formatDateTime(request?.completedAt)}
                                    </Text>
                                </View>
                            </View>
                        </>
                    )}
                    
                    {/* Canceled Status Banner */}
                    {request?.status === 'canceled' && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            <View style={styles.canceledBanner}>
                                <MaterialIcons name="cancel" size={24} color="#EF4444" />
                                <View style={styles.completedBannerText}>
                                    <Text style={styles.canceledBannerTitle}>Job Canceled</Text>
                                    <Text style={styles.completedBannerDate}>
                                        This job has been canceled
                                    </Text>
                                </View>
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
            </ScrollView>
            
            {/* Sticky Action Buttons */}
            <View style={styles.stickyActions}>
                {request?.status === 'pending' && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton, 
                                styles.declineButton, 
                                isDeclining && styles.actionButtonDisabled
                            ]}
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
                                { backgroundColor: trade?.accent || '#2563EB' },
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
                
                {request?.status === 'assigned' && (
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[
                                styles.actionButton, 
                                styles.unpaidButton, 
                                isTogglingUnpaid && styles.actionButtonDisabled
                            ]}
                            onPress={handleToggleUnpaid}
                            disabled={isTogglingUnpaid}
                        >
                            {isTogglingUnpaid ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons
                                        name={request?.unpaid ? 'check' : 'payment'}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.actionText}>
                                        {request?.unpaid ? 'Mark Paid' : 'Mark Unpaid'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.completeButton,
                                { backgroundColor: trade?.accent || '#2563EB' },
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
                
                {request?.status === 'completed' && request?.unpaid && (
                    <TouchableOpacity
                        style={[
                            styles.actionButton, 
                            styles.paidButton, 
                            isTogglingUnpaid && styles.actionButtonDisabled
                        ]}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        backgroundColor: DC.canvas,
        gap: 16,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    errorActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    errorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    errorButtonSecondary: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    errorButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    errorButtonTextSecondary: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '600',
    },
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
        borderRadius: 12,
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
    // Location styles
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
    getDirectionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'flex-start',
        gap: 6,
    },
    getDirectionsText: {
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
    unpaidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
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
    completedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#86EFAC',
        gap: 12,
    },
    completedBannerText: {
        flex: 1,
    },
    completedBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#065F46',
    },
    completedBannerDate: {
        fontSize: 12,
        color: '#047857',
        marginTop: 2,
    },
    canceledBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        gap: 12,
    },
    canceledBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#991B1B',
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