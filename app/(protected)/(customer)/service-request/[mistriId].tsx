import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    Dimensions,
    Modal,
    Platform,
    StatusBar,
    Pressable,
    LayoutAnimation,
    UIManager,
    Image,
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    useMistriRatingsQuery,
    useCreateServiceRequest,
    usePlatformServicesQuery,
} from '../../../../hooks/queries';
import { RatingStars } from '../../../../components/RatingStars';
import * as Haptics from 'expo-haptics';
import { getServiceConfig } from '../../../../lib/serviceConfig';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const SCREEN_PADDING = 20;
const CARD_BORDER_RADIUS = 16;

// Type definitions
interface Service {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}

interface Rating {
    id: string;
    customerName: string;
    rating: string | number;
    review?: string;
    createdAt: string;
}

interface RatingsData {
    averageRating: string | number;
    totalRatings: number;
    ratings: Rating[];
}

export default function MistriProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse params with type safety
    const mistriId = params.mistriId as string;
    const mistriName = params.name as string;
    const serviceType = params.serviceType as string | undefined;
    const profilePhotoUrl = params.profilePhotoUrl as string | undefined;
    const bio = params.bio as string | undefined;
    const jobsCompleted = parseInt(params.jobsCompleted as string) || 0;
    const paramAverageRating = parseFloat(params.averageRating as string) || 0;
    const latitude = parseFloat(params.latitude as string);
    const longitude = parseFloat(params.longitude as string);
    const address = params.address as string;

    const [showSelectionModal, setShowSelectionModal] = useState(false);
    const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
    const [customerNotes, setCustomerNotes] = useState('');
    const [reviewsToShow, setReviewsToShow] = useState(5);

    // Ref for ScrollView to enable auto-scroll
    const scrollViewRef = React.useRef<ScrollView>(null);

    // Get service type config for dynamic colors
    const serviceConfig = serviceType ? getServiceConfig(serviceType) : null;
    const accentColor = serviceConfig?.defaultColor || '#10B981';

    // Queries
    const { data: platformServicesData, isLoading: isLoadingPlatformServices } = usePlatformServicesQuery();
    const { data: ratingsData, isLoading: isLoadingRatings } = useMistriRatingsQuery(mistriId);
    const { mutateAsync: createRequest, isPending: isCreatingRequest } = useCreateServiceRequest();

    // Memoized computed values
    const relevantPlatformServices = useMemo(() => {
        if (!platformServicesData || !serviceType) return [];
        const category = platformServicesData.find(cat =>
            cat.categoryName.toLowerCase() === serviceType.toLowerCase()
        );
        return category?.services || [];
    }, [platformServicesData, serviceType]);

    const averageRating = useMemo(() => {
        if (ratingsData?.averageRating) return Number(ratingsData.averageRating);
        return paramAverageRating;
    }, [ratingsData, paramAverageRating]);

    const totalReviews = useMemo(() =>
        ratingsData?.totalRatings || 0,
        [ratingsData]
    );

    const recentReviews = useMemo(() =>
        ratingsData?.ratings.slice(0, 5) || [],
        [ratingsData]
    );

    // Handlers with useCallback for optimization
    const handleToggleService = useCallback((serviceId: string) => {
        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedServices((prev) => {
            const next = new Set(prev);
            if (next.has(serviceId)) {
                next.delete(serviceId);
            } else {
                next.add(serviceId);
            }
            return next;
        });
    }, []);

    const handleCloseModal = useCallback(() => {
        setShowSelectionModal(false);
    }, []);

    const selectedServiceCount = selectedServices.size;

    const handleOpenRequestModal = useCallback(() => {
        if (selectedServiceCount === 0) {
            Alert.alert(
                'Select Services',
                'Please select at least one service to continue.',
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }
        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setShowSelectionModal(true);
    }, [selectedServiceCount]);

    const handleRequestServices = async () => {
        // Ensure mistriId is defined
        if (!mistriId) {
            Alert.alert(
                'Error',
                'Mistri ID is missing. Please try again.',
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }


        if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        try {
            const result = await createRequest({
                type: serviceType || 'general',
                platformServiceIds: selectedServices.size > 0 ? Array.from(selectedServices) : undefined,
                coords: {
                    lat: latitude,
                    lng: longitude,
                },
                address,
                source: 'gps' as const,
                selectedMistriId: mistriId,
                customerNotes: customerNotes.trim() || undefined,
            });

            setShowSelectionModal(false);
            setSelectedServices(new Set());
            setCustomerNotes('');

            // Navigate directly to the request details
            router.replace({
                pathname: '/(protected)/(customer)/requests/[id]',
                params: { id: result.requestId, mistriName },
            });
        } catch (error) {
            if (__DEV__) console.error('Error creating request:', error);
            Alert.alert(
                'Request Failed',
                'Unable to send your request. Please try again.',
                [{ text: 'OK', style: 'default' }]
            );
        }
    };

    const handleBack = useCallback(() => {
        if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        router.back();
    }, [router]);

    // Loading state
    if (isLoadingRatings || isLoadingPlatformServices) {
        return (
            <View style={styles.container}>
                <StatusBar
                    barStyle="dark-content"
                    backgroundColor="#F9FAFB"
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
            />

            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    onPress={handleBack}
                    style={({ pressed }) => [
                        styles.backButton,
                        pressed && styles.backButtonPressed,
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </Pressable>
                <Text style={styles.headerTitle}>Professional Profile</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={Platform.OS === 'ios'}
                overScrollMode="never"
            >
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarContainer}>
                            {profilePhotoUrl ? (
                                <Image
                                    source={{ uri: profilePhotoUrl }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <View style={[styles.avatarInner, { backgroundColor: `${accentColor}15` }]}>
                                    <MaterialIcons name="person" size={40} color={accentColor} />
                                </View>
                            )}
                        </View>

                        <View style={styles.profileInfo}>
                            <View style={styles.nameRow}>
                                <Text style={styles.profileName}>{mistriName}</Text>
                                {serviceType && (
                                    <View style={[styles.serviceTypeTag, { backgroundColor: `${accentColor}15` }]}>
                                        <Text style={[styles.serviceTypeTagText, { color: accentColor }]}>
                                            {serviceType}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={14} color="#6B7280" />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {address}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Stats Row - Modern */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <View style={styles.statValueRow}>
                                <Text style={styles.statValue}>{averageRating > 0 ? averageRating.toFixed(1) : 'New'}</Text>
                                <MaterialIcons name="star" size={16} color="#F59E0B" />
                            </View>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{jobsCompleted}</Text>
                            <Text style={styles.statLabel}>Jobs Done</Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalReviews}</Text>
                            <Text style={styles.statLabel}>Reviews</Text>
                        </View>
                    </View>

                    {/* Bio */}
                    {bio && bio.trim() && (
                        <View style={styles.bioSection}>
                            <Text style={styles.bioText}>{bio}</Text>
                        </View>
                    )}
                </View>

                {/* Services Section */}
                {relevantPlatformServices.length > 0 && (
                    <View style={styles.servicesSection}>
                        <Text style={styles.servicesSectionTitle}>Available Services</Text>

                        <View style={styles.servicesContainer}>
                            <View style={styles.servicesList}>
                                {relevantPlatformServices.map((service, index) => (
                                    <TouchableOpacity
                                        key={`platform-${service.id}`}
                                        activeOpacity={0.7}
                            onPress={() => handleToggleService(service.id)}
                            style={[
                                styles.serviceCard,
                                index === relevantPlatformServices.length - 1 && styles.serviceCardLast,
                            ]}
                        >
                                        <View style={styles.serviceCardContent}>
                                            <View style={[styles.serviceIconLarge, { backgroundColor: `${accentColor}10` }]}>
                                                <MaterialIcons name="verified" size={24} color={accentColor} />
                                            </View>
                                            <View style={styles.serviceCardInfo}>
                                                <Text style={styles.serviceCardName}>{service.name}</Text>
                                                <View style={styles.servicePriceRow}>
                                                    <Text style={[styles.servicePriceLabel, { color: accentColor }]}>NPR</Text>
                                                    <Text style={[styles.servicePriceLarge, { color: accentColor }]}>{service.price}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.serviceSelectIcon}>
                                            <MaterialIcons
                                                name={selectedServices.has(service.id) ? 'check-box' : 'check-box-outline-blank'}
                                                size={22}
                                                color={selectedServices.has(service.id) ? accentColor : '#D1D5DB'}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Reviews Section */}
                {recentReviews.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Customer Reviews</Text>
                            <Text style={styles.sectionCount}>{recentReviews.length}</Text>
                        </View>

                        <View style={styles.reviewsGrid}>
                            {recentReviews.slice(0, reviewsToShow).map((review) => (
                                <View key={review.id} style={styles.reviewCardContainer}>
                                    <View style={styles.reviewCardHeader}>
                                        <View style={styles.reviewerInfo}>
                                            <View style={[styles.reviewerAvatar, { backgroundColor: `${accentColor}15` }]}>
                                                <Text style={[styles.reviewerInitial, { color: accentColor }]}>
                                                    {review.customerName.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={styles.reviewerDetails}>
                                                <Text style={styles.reviewerName}>{review.customerName}</Text>
                                                <Text style={styles.reviewDate}>
                                                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </Text>
                                            </View>
                                        </View>
                                        <RatingStars rating={Number(review.rating) || 0} size={16} />
                                    </View>

                                    {review.review && (
                                        <Text style={styles.reviewText} numberOfLines={3}>
                                            {review.review}
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* See More Button */}
                        {recentReviews.length > reviewsToShow && (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setReviewsToShow(prev => prev + 5)}
                                style={styles.seeMoreButton}
                            >
                                <Text style={[styles.seeMoreText, { color: accentColor }]}>
                                    See More Reviews ({recentReviews.length - reviewsToShow} more)
                                </Text>
                                <MaterialIcons name="keyboard-arrow-down" size={20} color={accentColor} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Bottom Spacing */}
                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Request Button */}
            <View style={styles.requestButtonContainer}>
                <Pressable
                    onPress={handleOpenRequestModal}
                    style={({ pressed }) => [
                        styles.requestButton,
                        { backgroundColor: accentColor },
                        pressed && styles.requestButtonPressed,
                    ]}
                    disabled={isCreatingRequest}
                >
                    <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
                    <Text style={styles.requestButtonText}>
                        {selectedServiceCount > 0
                            ? `Request ${selectedServiceCount} ${selectedServiceCount === 1 ? 'Service' : 'Services'}`
                            : 'Request Services'}
                    </Text>
                </Pressable>
            </View>

            {/* Service Selection Modal */}
            <Modal
                visible={showSelectionModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseModal}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <StatusBar
                        barStyle="dark-content"
                        backgroundColor="#FFFFFF"
                    />

                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>Select Services</Text>
                            <Text style={styles.modalSubtitle}>
                                Choose one or more services
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleCloseModal}
                            style={({ pressed }) => [
                                styles.modalCloseButton,
                                pressed && styles.modalCloseButtonPressed,
                            ]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialIcons name="close" size={24} color="#6B7280" />
                        </Pressable>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardAvoidingView}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        {/* Request Details */}
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.modalScrollView}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Selected Service */}
                            {selectedServices.size > 0 && (
                                <View>
                                    <Text style={styles.servicesHeader}>
                                        Selected Services ({selectedServices.size})
                                    </Text>
                                    {relevantPlatformServices
                                        .filter(service => selectedServices.has(service.id))
                                        .map((service) => (
                                            <View
                                                key={service.id}
                                                style={[
                                                    styles.modalServiceItem,
                                                    { borderColor: accentColor, backgroundColor: `${accentColor}10` },
                                                ]}
                                            >
                                                <View style={styles.modalServiceContent}>
                                                    <View style={styles.modalServiceTextContainer}>
                                                        <View style={styles.modalServiceNameRow}>
                                                            <Text style={[styles.modalServiceName, { color: accentColor, fontWeight: '600' }]}>
                                                                {service.name}
                                                            </Text>
                                                            <View style={[styles.priceTag, { backgroundColor: `${accentColor}15`, borderColor: accentColor }]}>
                                                                <Text style={[styles.priceTagText, { color: accentColor }]}>
                                                                    NPR {service.price}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <View style={[styles.checkbox, { backgroundColor: accentColor, borderColor: accentColor }]}>
                                                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                </View>
                            )}

                            {/* Custom Notes Section */}
                            <View style={styles.customNotesContainer}>
                                <Text style={styles.customNotesLabel}>
                                    Additional Notes (Optional)
                                </Text>
                                <TextInput
                                    style={styles.customNotesInput}
                                    placeholder="Describe your requirements or any additional details..."
                                    value={customerNotes}
                                    onChangeText={setCustomerNotes}
                                    onFocus={() => {
                                        setTimeout(() => {
                                            scrollViewRef.current?.scrollToEnd({ animated: true });
                                        }, 100);
                                    }}
                                    multiline
                                    numberOfLines={3}
                                    placeholderTextColor="#9CA3AF"
                                    textAlignVertical="top"
                                />
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <Pressable
                                onPress={handleRequestServices}
                                disabled={isCreatingRequest}
                                style={({ pressed }) => [
                                    styles.modalConfirmButton,
                                    { backgroundColor: accentColor },
                                    isCreatingRequest && styles.modalConfirmButtonDisabled,
                                    pressed && !isCreatingRequest && styles.modalConfirmButtonPressed,
                                ]}
                            >
                                {isCreatingRequest ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Text style={styles.modalConfirmButtonText}>
                                            Send Request
                                        </Text>
                                        <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },

    // Loading State
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: SCREEN_PADDING,
    },
    loadingText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
        letterSpacing: 0.3,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButtonPressed: {
        backgroundColor: '#E5E7EB',
        transform: [{ scale: 0.95 }],
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    headerSpacer: {
        width: 40,
    },

    // ScrollView
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },

    // Profile Card
    profileCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: SCREEN_PADDING,
        marginTop: 16,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatarInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F3F4F6',
    },
    profileInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: -0.3,
    },
    serviceTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    serviceTypeTagText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 13,
        color: '#6B7280',
        flex: 1,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginBottom: 16,
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 4,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#F3F4F6',
    },

    // Bio Section
    bioSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    bioText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 22,
    },

    // Services Section - Priority Design
    servicesSection: {
        marginTop: 16,
        paddingHorizontal: SCREEN_PADDING,
    },
    servicesSectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        letterSpacing: -0.3,
    },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    tabActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    tabTextActive: {
        fontWeight: '700',
    },

    servicesContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },

    // Section Styles
    section: {
        marginTop: 20,
        paddingHorizontal: SCREEN_PADDING,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    sectionCount: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    // Empty State
    emptyState: {
        paddingVertical: 60,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    emptyDescription: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
    },

    // Service Cards - Prominent Design
    servicesList: {
        paddingVertical: 5,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    serviceCardLast: {
        borderBottomWidth: 0,
    },
    serviceCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    serviceIconLarge: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    serviceCardInfo: {
        flex: 1,
    },
    serviceCardName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 5,
        lineHeight: 19,
    },
    serviceCardDescription: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 3,
    },
    servicePriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 3,
    },
    servicePriceLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    servicePriceLarge: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    servicePriceSmall: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    serviceSelectIcon: {
        width: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Reviews - Card Grid
    reviewsGrid: {
        gap: 12,
    },
    reviewCardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    reviewCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    reviewerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    reviewerInitial: {
        fontSize: 16,
        fontWeight: '700',
    },
    reviewerDetails: {
        flex: 1,
    },
    reviewerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    reviewDate: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    reviewText: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 21,
    },
    seeMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    seeMoreText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Request Button
    requestButtonContainer: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    requestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    requestButtonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    requestButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    modalSubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    modalCloseButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseButtonPressed: {
        backgroundColor: '#E5E7EB',
        transform: [{ scale: 0.95 }],
    },

    // Modal Service List
    modalScrollView: {
        flex: 1,
    },
    modalScrollContent: {
        padding: SCREEN_PADDING,
        paddingBottom: 150, // Extra padding for keyboard space
    },
    modalServiceItem: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    modalServiceItemSelected: {
    },
    modalServiceItemPressed: {
        opacity: 0.7,
    },
    modalServiceContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    modalServiceTextContainer: {
        flex: 1,
        marginRight: 12,
    },
    modalServiceName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
        letterSpacing: 0.1,
    },
    modalServiceNameSelected: {
    },
    modalServiceDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxSelected: {
    },

    // Modal Footer
    modalFooter: {
        padding: SCREEN_PADDING,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
        ...Platform.select({
            ios: {
                paddingBottom: 34,
            },
            android: {
                paddingBottom: 20,
            },
        }),
    },
    modalConfirmButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 14,
        gap: 8,
    },
    modalConfirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
        opacity: 0.6,
    },
    modalConfirmButtonPressed: {
        transform: [{ scale: 0.98 }],
    },
    modalConfirmButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 0.3,
    },

    // Services Section
    servicesHeader: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 4,
    },
    modalServiceGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingTop: 16,
    },
    modalServiceGroupHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    modalServiceNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flex: 1,
    },
    priceTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    priceTagText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    // Custom Notes
    customNotesContainer: {
        marginTop: 20,
        marginBottom: 8,
    },
    customNotesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    customNotesInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        minHeight: 80,
    },

    // Utilities
    bottomSpacer: {
        height: 16,
    },
});
