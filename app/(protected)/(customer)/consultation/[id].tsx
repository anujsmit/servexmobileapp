// app/(protected)/(customer)/consultation/[id].tsx

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
    Modal,
    FlatList,
    Dimensions,
    RefreshControl,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// ============================================
// BLUE THEME CONSTANTS
// ============================================

const BLUE = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    gradientStart: '#2563eb',
    gradientEnd: '#1d4ed8',
    text: '#000000',
    textSecondary: '#333333',
    textTertiary: '#666666',
    white: '#ffffff',
    background: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.08)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.08)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.08)',
    pending: '#f59e0b',
    assigned: '#2563eb',
    inProgress: '#8b5cf6',
    completed: '#22c55e',
    cancelled: '#ef4444',
    rejected: '#ef4444',
};

// ============================================
// TYPES
// ============================================

interface ConsultationDetails {
    id: string;
    categoryId: number;
    categoryName: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    details: string;
    urgency: 'normal' | 'urgent' | 'emergency';
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
    createdAt: string;
    updatedAt: string;
    assignedAt: string | null;
    completedAt: string | null;
    assignedMistriId: string | null;
    customerNotes: string | null;
    adminNotes: string | null;
}

interface MistriInfo {
    id: string;
    fullName: string;
    phoneNumber: string;
    profilePhotoUrl: string | null;
    averageRating: string;
    jobsCompleted: number;
    specialties: string[];
}

// ============================================
// HELPERS
// ============================================

const getStatusDetails = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
        'pending': { label: 'Pending', color: BLUE.pending, icon: 'hourglass-empty' },
        'assigned': { label: 'Assigned', color: BLUE.assigned, icon: 'person' },
        'in_progress': { label: 'In Progress', color: BLUE.inProgress, icon: 'construct' },
        'completed': { label: 'Completed', color: BLUE.completed, icon: 'done-all' },
        'cancelled': { label: 'Cancelled', color: BLUE.cancelled, icon: 'cancel' },
        'rejected': { label: 'Rejected', color: BLUE.rejected, icon: 'block' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: BLUE.textSecondary, icon: 'help' };
};

const getUrgencyDetails = (urgency: string) => {
    const urgencyMap: Record<string, { label: string; color: string; icon: string }> = {
        'normal': { label: 'Normal', color: BLUE.primary, icon: 'check-circle' },
        'urgent': { label: 'Urgent', color: BLUE.primary, icon: 'alert-circle' },
        'emergency': { label: 'Emergency', color: BLUE.primary, icon: 'warning' },
    };
    return urgencyMap[urgency] || urgencyMap['normal'];
};

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const getInitials = (name: string): string => {
    if (!name) return 'U';
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

// ============================================
// DASHED LINE COMPONENT
// ============================================

const DashedLine = ({ style }: { style?: object }) => (
    <View style={[{ flexDirection: 'row', overflow: 'hidden', marginHorizontal: -16 }, style]}>
        {Array.from({ length: 50 }).map((_, i) => (
            <View key={i} style={{ width: 6, height: 1, backgroundColor: BLUE.border, marginRight: 4 }} />
        ))}
    </View>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function ConsultationDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { token, refreshAccessToken, logout } = useAuth();
    const router = useRouter();

    const [consultation, setConsultation] = useState<ConsultationDetails | null>(null);
    const [mistri, setMistri] = useState<MistriInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

    // Fetch consultation details
    useEffect(() => {
        if (id) {
            fetchConsultationDetails();
        }
    }, [id]);

    // ============================================
    // API FUNCTIONS
    // ============================================

    const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
        let currentToken = token;
        if (!currentToken) {
            throw new Error('No token available');
        }

        const makeRequest = async (authToken: string) => {
            return fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                    'Authorization': `Bearer ${authToken}`,
                },
            });
        };

        let response = await makeRequest(currentToken);

        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                response = await makeRequest(newToken);
            } else {
                Alert.alert(
                    'Session Expired',
                    'Your session has expired. Please login again.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                logout();
                                router.replace('/(auth)/login');
                            },
                        },
                    ]
                );
                throw new Error('Session expired');
            }
        }
        return response;
    };

    const fetchConsultationDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `${API_BASE}/api/users/consultations/${id}`;
            console.log('📡 Fetching consultation from:', url);

            const response = await makeAuthenticatedRequest(url);
            const data = await response.json();

            if (response.ok && data.success) {
                setConsultation(data.consultation);
                if (data.assignedMistri) {
                    setMistri(data.assignedMistri);
                }
            } else {
                setError(data.message || 'Failed to load consultation details');
            }
        } catch (error: any) {
            console.error('Error fetching consultation:', error);
            setError(error.message || 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelConsultation = async () => {
        if (!consultation) return;

        Alert.alert(
            'Cancel Consultation',
            'Are you sure you want to cancel this consultation? This action cannot be undone.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        try {
                            const url = `${API_BASE}/api/users/consultations/${consultation.id}/cancel`;
                            const response = await makeAuthenticatedRequest(url, {
                                method: 'PATCH',
                            });

                            const data = await response.json();
                            if (response.ok && data.success) {
                                Alert.alert('Cancelled', 'Your consultation has been cancelled.');
                                await fetchConsultationDetails();
                            } else {
                                Alert.alert('Error', data.message || 'Failed to cancel consultation');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to cancel consultation');
                        } finally {
                            setCancelling(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCallMistri = () => {
        if (mistri?.phoneNumber) {
            Linking.openURL(`tel:${mistri.phoneNumber}`).catch(() => {
                Alert.alert('Error', 'Could not open phone dialer');
            });
        }
    };

    const handleOpenLocation = () => {
        if (!consultation) return;
        
        if (consultation.latitude && consultation.longitude) {
            const url = `https://www.google.com/maps/search/?api=1&query=${consultation.latitude},${consultation.longitude}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open maps');
            });
        } else if (consultation.location) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultation.location)}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open maps');
            });
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchConsultationDetails();
        setRefreshing(false);
    };

    const goBack = () => {
        router.back();
    };

    const goToDashboard = () => {
        router.push('/(protected)/(customer)');
    };

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    const renderStatusPill = () => {
        if (!consultation) return null;
        const statusInfo = getStatusDetails(consultation.status);

        return (
            <View style={[styles.statusPill, { backgroundColor: statusInfo.color }]}>
                <MaterialIcons name={statusInfo.icon as any} size={14} color="#FFFFFF" />
                <Text style={styles.statusPillText}>{statusInfo.label}</Text>
                {consultation.status === 'pending' && (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
            </View>
        );
    };

    const renderUrgencyBadge = () => {
        if (!consultation) return null;
        const urgencyInfo = getUrgencyDetails(consultation.urgency);

        return (
            <View style={[styles.urgencyBadge, { backgroundColor: BLUE.primary }]}>
                <Ionicons name={urgencyInfo.icon as any} size={14} color="#FFFFFF" />
                <Text style={[styles.urgencyText, { color: '#FFFFFF' }]}>
                    {urgencyInfo.label}
                </Text>
            </View>
        );
    };

    const renderConsultationDetails = () => {
        if (!consultation) return null;

        return (
            <>
                {/* Service Category */}
                <View style={styles.sectionBlock}>
                    <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Service Category</Text>
                    <Text style={[styles.blockText, { color: BLUE.text }]}>{consultation.categoryName}</Text>
                </View>

                <DashedLine style={{ marginVertical: 10 }} />

                {/* Location */}
                <View style={styles.sectionBlock}>
                    <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Location</Text>
                    <TouchableOpacity
                        style={styles.locationRow}
                        onPress={handleOpenLocation}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.blockText, { color: BLUE.text }]} numberOfLines={3}>
                            {consultation.location}
                        </Text>
                        <Ionicons name="open-outline" size={16} color={BLUE.primary} />
                    </TouchableOpacity>
                    
                    {consultation.latitude != null && consultation.longitude != null && (
                        <View style={styles.coordinatesRow}>
                            <Text style={[styles.coordinatesText, { color: BLUE.textTertiary }]}>
                                📍 {Number(consultation.latitude).toFixed(6)}, {Number(consultation.longitude).toFixed(6)}
                            </Text>
                        </View>
                    )}
                </View>

                <DashedLine style={{ marginVertical: 10 }} />

                {/* Details */}
                {consultation.details && (
                    <View style={styles.sectionBlock}>
                        <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Project Details</Text>
                        <Text style={[styles.detailsText, { color: BLUE.text }]}>{consultation.details}</Text>
                    </View>
                )}

                <DashedLine style={{ marginVertical: 10 }} />

                {/* Urgency */}
                <View style={styles.sectionBlock}>
                    <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Urgency Level</Text>
                    {renderUrgencyBadge()}
                </View>

                {/* Admin Notes */}
                {consultation.adminNotes && (
                    <>
                        <DashedLine style={{ marginVertical: 10 }} />
                        <View style={styles.sectionBlock}>
                            <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Admin Notes</Text>
                            <View style={[styles.adminNoteContainer, { backgroundColor: BLUE.primaryBg }]}>
                                <Ionicons name="information-circle" size={18} color={BLUE.primary} />
                                <Text style={[styles.adminNoteText, { color: BLUE.primary }]}>{consultation.adminNotes}</Text>
                            </View>
                        </View>
                    </>
                )}
            </>
        );
    };

    const renderMistri = () => {
        if (!mistri) return null;

        return (
            <View style={styles.sectionBlock}>
                <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Assigned Expert</Text>
                <View style={styles.mistriRow}>
                    {mistri.profilePhotoUrl ? (
                        <Image source={{ uri: mistri.profilePhotoUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: BLUE.primary }]}>
                            <Text style={[styles.avatarInitials, { color: BLUE.white }]}>{getInitials(mistri.fullName)}</Text>
                        </View>
                    )}
                    <View style={styles.mistriInfo}>
                        <Text style={[styles.mistriName, { color: BLUE.text }]}>{mistri.fullName}</Text>
                        <View style={styles.mistriMeta}>
                            <View style={styles.ratingContainer}>
                                <Ionicons name="star" size={14} color={BLUE.warning} />
                                <Text style={[styles.ratingText, { color: BLUE.textSecondary }]}>
                                    {parseFloat(mistri.averageRating).toFixed(1) || 'New'}
                                </Text>
                            </View>
                            <Text style={[styles.metaDivider, { color: BLUE.textTertiary }]}>-</Text>
                            <Text style={[styles.metaText, { color: BLUE.textSecondary }]}>{mistri.jobsCompleted || 0} jobs</Text>
                        </View>
                        {mistri.specialties && mistri.specialties.length > 0 && (
                            <View style={styles.specialtiesRow}>
                                {mistri.specialties.slice(0, 3).map((specialty, index) => (
                                    <View key={index} style={[styles.specialtyTag, { backgroundColor: BLUE.background }]}>
                                        <Text style={[styles.specialtyText, { color: BLUE.textSecondary }]}>{specialty}</Text>
                                    </View>
                                ))}
                                {mistri.specialties.length > 3 && (
                                    <Text style={[styles.specialtyMore, { color: BLUE.textTertiary }]}>+{mistri.specialties.length - 3}</Text>
                                )}
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={[styles.callIcon, { backgroundColor: BLUE.successBg, borderColor: BLUE.success + '30' }]} onPress={handleCallMistri}>
                        <Ionicons name="call" size={20} color={BLUE.success} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderTimeline = () => {
        if (!consultation) return null;

        const events = [
            { label: 'Consultation Requested', timestamp: consultation.createdAt, completed: true },
            { label: 'Assigned to Expert', timestamp: consultation.assignedAt, completed: !!consultation.assignedAt },
            { label: 'Completed', timestamp: consultation.completedAt, completed: consultation.status === 'completed' },
        ];

        return (
            <View style={styles.sectionBlock}>
                <Text style={[styles.blockTitle, { color: BLUE.textTertiary }]}>Timeline</Text>
                <View style={styles.timelineList}>
                    {events.map((event) => (
                        <View key={event.label} style={styles.timelineRow}>
                            <Text style={[styles.timelineLabel, { color: BLUE.text }]}>{event.label}</Text>
                            <Text style={[styles.timelineValue, { color: BLUE.textSecondary }]}>
                                {event.completed ? formatDateTime(event.timestamp) : 'Pending'}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    if (loading && !refreshing) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Consultation Details"
                    leftElement={
                        <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color={BLUE.text} />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={BLUE.primary} />
                    <Text style={[styles.loadingText, { color: BLUE.textSecondary }]}>Loading consultation details...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    if (error || !consultation) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Consultation Details"
                    leftElement={
                        <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color={BLUE.text} />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="error-outline" size={48} color={BLUE.error} />
                    <Text style={[styles.errorTitle, { color: BLUE.text }]}>Something went wrong</Text>
                    <Text style={[styles.errorText, { color: BLUE.textSecondary }]}>{error || 'Consultation not found'}</Text>
                    <TouchableOpacity style={[styles.retryButton, { backgroundColor: BLUE.primary }]} onPress={onRefresh}>
                        <Ionicons name="refresh" size={20} color="#fff" />
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goBackButton} onPress={goBack}>
                        <Text style={[styles.goBackButtonText, { color: BLUE.textSecondary }]}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaContainer>
        );
    }

    const isPending = consultation.status === 'pending' || consultation.status === 'assigned';
    const shortConsultationId = consultation.id.slice(-8).toUpperCase();

    return (
        <SafeAreaContainer>
            <PageTitle
                title="Consultation Details"
                leftElement={
                    <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color={BLUE.text} />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={[styles.content, { backgroundColor: BLUE.background }]}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[BLUE.primary]}
                    />
                }
            >
                <View style={[styles.receiptCard, { backgroundColor: BLUE.white, borderColor: BLUE.border }]}>
                    {/* Perforated Top Edge */}
                    <View style={[styles.perforatedEdge, { backgroundColor: BLUE.white }]}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={[styles.perforation, { backgroundColor: BLUE.background, borderColor: BLUE.border }]} />
                        ))}
                    </View>

                    <View style={styles.receiptHeader}>
                        <View style={styles.receiptBrand}>
                            <Image
                                source={require('../../../../assets/images/logo.png')}
                                style={styles.receiptLogo}
                            />
                            <View>
                                <Text style={[styles.receiptTitle, { color: BLUE.text }]}>ServeX</Text>
                                <Text style={[styles.receiptSubtitle, { color: BLUE.textSecondary }]}>Consultation Receipt</Text>
                            </View>
                        </View>
                        {renderStatusPill()}
                    </View>

                    <DashedLine style={{ marginBottom: 10 }} />

                    <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                            <Text style={[styles.metaLabel, { color: BLUE.textTertiary }]}>Consultation ID</Text>
                            <Text style={[styles.metaValue, { color: BLUE.text }]}>#{shortConsultationId}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={[styles.metaLabel, { color: BLUE.textTertiary }]}>Requested</Text>
                            <Text style={[styles.metaValue, { color: BLUE.text }]}>{formatDateTime(consultation.createdAt)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={[styles.metaLabel, { color: BLUE.textTertiary }]}>Category</Text>
                            <Text style={[styles.metaValue, { color: BLUE.text }]}>{consultation.categoryName}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={[styles.metaLabel, { color: BLUE.textTertiary }]}>Status</Text>
                            <Text style={[styles.metaValue, { color: getStatusDetails(consultation.status).color }]}>
                                {getStatusDetails(consultation.status).label}
                            </Text>
                        </View>
                    </View>

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Consultation Details */}
                    {renderConsultationDetails()}

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Timeline */}
                    {renderTimeline()}

                    {/* Mistri - only show if assigned */}
                    {mistri && (
                        <>
                            <DashedLine style={{ marginVertical: 10 }} />
                            {renderMistri()}
                        </>
                    )}

                    {/* Perforated Bottom Edge */}
                    <View style={[styles.perforatedBottomEdge, { backgroundColor: BLUE.white }]}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={[styles.perforation, { backgroundColor: BLUE.background, borderColor: BLUE.border }]} />
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Action Buttons */}
            <View style={[styles.stickyActions, { backgroundColor: BLUE.white, borderTopColor: BLUE.border }]}>
                {isPending && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelActionButton, cancelling && styles.actionButtonDisabled]}
                        onPress={handleCancelConsultation}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color={BLUE.error} />
                        ) : (
                            <>
                                <Ionicons name="close-circle" size={20} color={BLUE.error} />
                                <Text style={[styles.cancelActionText, { color: BLUE.error }]}>Cancel Consultation</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
                {consultation.status === 'assigned' && mistri && (
                    <TouchableOpacity style={[styles.actionButton, { backgroundColor: BLUE.primary }]} onPress={handleCallMistri}>
                        <Ionicons name="call" size={20} color={BLUE.white} />
                        <Text style={[styles.actionText, { color: BLUE.white }]}>Call Expert</Text>
                    </TouchableOpacity>
                )}
                {consultation.status === 'completed' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.homeActionButton, { backgroundColor: BLUE.primary }]}
                        onPress={goToDashboard}
                    >
                        <Ionicons name="home" size={20} color={BLUE.white} />
                        <Text style={[styles.actionText, { color: BLUE.white }]}>Back to Home</Text>
                    </TouchableOpacity>
                )}
                {!isPending && consultation.status !== 'completed' && consultation.status !== 'assigned' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.homeActionButton, { backgroundColor: BLUE.primary }]}
                        onPress={goToDashboard}
                    >
                        <Ionicons name="home" size={20} color={BLUE.white} />
                        <Text style={[styles.actionText, { color: BLUE.white }]}>Back to Home</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaContainer>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        backgroundColor: BLUE.background,
    },
    loadingText: {
        fontSize: 14,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 12,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    retryButton: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 16,
    },
    goBackButton: {
        marginTop: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    goBackButtonText: {
        fontWeight: '500',
        fontSize: 16,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 12,
    },
    receiptCard: {
        borderRadius: 0,
        padding: 16,
        borderWidth: 1,
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
    },
    perforation: {
        width: 4,
        height: 4,
        borderRadius: 2,
        borderWidth: 0.5,
    },
    perforatedBottomEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 8,
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
    },
    receiptSubtitle: {
        fontSize: 11,
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
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sectionBlock: {
        marginBottom: 8,
    },
    blockTitle: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    blockText: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '500',
    },
    detailsText: {
        fontSize: 14,
        lineHeight: 22,
        fontWeight: '400',
    },
    // Urgency - Blue Theme with White Text
    urgencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 4,
    },
    urgencyText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Location
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    coordinatesRow: {
        marginTop: 4,
    },
    coordinatesText: {
        fontSize: 11,
        fontFamily: 'monospace',
    },
    // Admin Notes
    adminNoteContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 10,
        borderRadius: 8,
        marginTop: 4,
    },
    adminNoteText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    // Timeline
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
        letterSpacing: 0.3,
    },
    timelineValue: {
        fontSize: 11,
        fontWeight: '600',
    },
    // Mistri
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 16,
        fontWeight: '700',
    },
    mistriInfo: {
        flex: 1,
    },
    mistriName: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    mistriMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 12,
    },
    metaDivider: {
        marginHorizontal: 6,
        fontSize: 12,
    },
    metaText: {
        fontSize: 12,
    },
    specialtiesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    specialtyTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    specialtyText: {
        fontSize: 10,
        fontWeight: '500',
    },
    specialtyMore: {
        fontSize: 10,
        fontWeight: '500',
        alignSelf: 'center',
    },
    callIcon: {
        padding: 8,
        borderRadius: 0,
        borderWidth: 1,
    },
    // Sticky Actions
    stickyActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    actionButton: {
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
        borderColor: BLUE.error,
    },
    homeActionButton: {
        backgroundColor: BLUE.primary,
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
        color: BLUE.error,
        fontSize: 15,
        fontWeight: '600',
    },
});