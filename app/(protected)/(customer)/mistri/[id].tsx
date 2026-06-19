import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    useMistriServicesQuery,
    useMistriRatingsQuery,
    useCreateServiceRequest,
} from '../../../../hooks/queries';
import { RatingStars } from '../../../../components/RatingStars';
import { ServiceCard } from '../../../../components/ServiceCard';
import * as Location from 'expo-location';
import { getServiceConfig } from '../../../../lib/serviceConfig';

export default function MistriProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mistriId = params.id as string;
    const mistriName = params.name as string;
    const serviceType = params.serviceType as string | undefined;
    const profilePhotoUrl = params.profilePhotoUrl as string | undefined;

    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);

    // Get service type config for dynamic colors
    const serviceConfig = serviceType ? getServiceConfig(serviceType) : null;
    const accentColor = serviceConfig?.defaultColor || '#10B981';

    const { data: services, isLoading: isLoadingServices } = useMistriServicesQuery(mistriId);
    const { data: ratingsData, isLoading: isLoadingRatings } = useMistriRatingsQuery(mistriId);
    const { mutateAsync: createRequest, isPending: isCreatingRequest } = useCreateServiceRequest();

    const activeServices = services?.filter(s => s.isActive) || [];
    const totalPrice = activeServices
        .filter(s => selectedServices.includes(s.id))
        .reduce((sum, s) => sum + parseFloat(s.price), 0);

    const handleToggleService = (serviceId: string) => {
        setSelectedServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const handleRequestServices = async () => {
        if (selectedServices.length === 0) {
            Alert.alert('Error', 'Please select at least one service');
            return;
        }

        try {
            setIsRequestingLocation(true);

            // Request location permission
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to request services');
                setIsRequestingLocation(false);
                return;
            }

            // Get current location
            const location = await Location.getCurrentPositionAsync({});

            // Get address from coordinates
            const addresses = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            const address = addresses[0]
                ? `${addresses[0].street || ''}, ${addresses[0].city || ''}, ${addresses[0].region || ''}`
                : `${location.coords.latitude}, ${location.coords.longitude}`;

            setIsRequestingLocation(false);

            // Create service request with selected services
            const result = await createRequest({
                type: 'custom', // Legacy field, can be any value
                serviceIds: selectedServices,
                coords: {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                },
                address: address.trim(),
                source: 'gps' as const,
                selectedMistriId: mistriId,
            });

            Alert.alert(
                'Success',
                'Service request sent successfully!',
                [
                    {
                        text: 'View Request',
                        onPress: () => router.push({
                            pathname: '/(protected)/(customer)/requests/[id]',
                            params: { id: result.requestId, mistriName },
                        }),
                    },
                ]
            );

            // Reset selection
            setSelectedServices([]);
        } catch (error) {
            if (__DEV__) console.error('Error creating request:', error);
            Alert.alert('Error', 'Failed to create service request. Please try again.');
            setIsRequestingLocation(false);
        }
    };

    if (isLoadingServices || isLoadingRatings) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Mistri Profile"
                    leftElement={
                        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle
                title={mistriName || 'Mistri Profile'}
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingBottom: selectedServices.length > 0 ? 160 : 20 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Mistri Info Card - COMPACT */}
                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        {profilePhotoUrl ? (
                            <Image
                                source={{ uri: profilePhotoUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <MaterialIcons name="person" size={32} color="#9CA3AF" />
                            </View>
                        )}
                        <View style={styles.profileInfo}>
                            <Text style={styles.mistriName}>{mistriName}</Text>
                            {serviceType && (
                                <View style={styles.serviceTypeRow}>
                                    <MaterialIcons name="verified" size={14} color={accentColor} />
                                    <Text style={[styles.serviceTypeText, { color: accentColor }]}>
                                        Verified {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)}
                                    </Text>
                                </View>
                            )}
                            {ratingsData && ratingsData.averageRating != null && (
                                <View style={styles.ratingRow}>
                                    <RatingStars
                                        rating={Number(ratingsData.averageRating)}
                                        size={16}
                                        showNumber
                                    />
                                    <Text style={styles.ratingCount}>
                                        ({ratingsData.totalRatings || 0} {ratingsData.totalRatings === 1 ? 'review' : 'reviews'})
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Services Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Available Services ({activeServices.length})
                    </Text>

                    {activeServices.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="construct-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>
                                This mistri hasn't added any services yet
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.servicesTable}>
                            {/* Table Header */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, styles.serviceNameColumn]}>Service</Text>
                                <Text style={[styles.tableHeaderText, styles.descriptionColumn]}>Description</Text>
                                <Text style={[styles.tableHeaderText, styles.priceColumn]}>Price</Text>
                            </View>

                            {/* Table Rows */}
                            {activeServices.map((service, index) => (
                                <TouchableOpacity
                                    key={service.id}
                                    style={[
                                        styles.tableRow,
                                        index % 2 === 1 && styles.tableRowStriped,
                                        selectedServices.includes(service.id) && {
                                            ...styles.tableRowSelected,
                                            backgroundColor: `${accentColor}10`,
                                            borderLeftColor: accentColor,
                                        },
                                    ]}
                                    onPress={() => handleToggleService(service.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.checkboxContainer}>
                                        <View style={[
                                            styles.checkbox,
                                            selectedServices.includes(service.id) && {
                                                ...styles.checkboxChecked,
                                                backgroundColor: accentColor,
                                                borderColor: accentColor,
                                            }
                                        ]}>
                                            {selectedServices.includes(service.id) && (
                                                <MaterialIcons name="check" size={14} color="#FFFFFF" />
                                            )}
                                        </View>
                                    </View>
                                    <Text style={[styles.tableCellText, styles.serviceNameColumn]} numberOfLines={2}>
                                        {service.name}
                                    </Text>
                                    <Text style={[styles.tableCellTextSecondary, styles.descriptionColumn]} numberOfLines={2}>
                                        {service.description || '-'}
                                    </Text>
                                    <Text style={[styles.tableCellPrice, styles.priceColumn, { color: accentColor }]}>
                                        Rs. {parseFloat(service.price).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Recent Reviews */}
                {ratingsData && ratingsData.ratings.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Recent Reviews ({ratingsData.ratings.length})
                        </Text>
                        {ratingsData.ratings.slice(0, 5).map((review) => (
                            <View key={review.id} style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewerName}>{review.customerName}</Text>
                                    <RatingStars rating={Number(review.rating) || 0} size={14} />
                                </View>
                                {review.review && (
                                    <Text style={styles.reviewText} numberOfLines={3}>
                                        {review.review}
                                    </Text>
                                )}
                                <Text style={styles.reviewDate}>
                                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Sticky Selection Summary + Request Button */}
            {selectedServices.length > 0 && (
                <View style={styles.stickyFooter}>
                    {/* Selection Summary */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>
                                {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'} selected
                            </Text>
                            <Text style={[styles.summaryPrice, { color: accentColor }]}>Rs. {totalPrice.toLocaleString()}</Text>
                        </View>
                    </View>

                    {/* Request Button */}
                    <TouchableOpacity
                        style={[
                            styles.requestButton,
                            { backgroundColor: accentColor },
                            (isCreatingRequest || isRequestingLocation) && styles.requestButtonDisabled,
                        ]}
                        onPress={handleRequestServices}
                        disabled={isCreatingRequest || isRequestingLocation}
                    >
                        {isCreatingRequest || isRequestingLocation ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Ionicons name="send" size={20} color="#FFFFFF" />
                                <Text style={styles.requestButtonText}>Request Services</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
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
        backgroundColor: '#F9FAFB',
    },
    contentContainer: {
        padding: 12,
    },
    profileCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    profileInfo: {
        flex: 1,
    },
    mistriName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    serviceTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    serviceTypeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ratingCount: {
        fontSize: 12,
        color: '#6B7280',
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
    },
    reviewCard: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    reviewerName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    reviewText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
        marginBottom: 6,
    },
    reviewDate: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    stickyFooter: {
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
    summaryCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    summaryPrice: {
        fontSize: 16,
        fontWeight: '700',
    },
    requestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    requestButtonDisabled: {
        opacity: 0.5,
    },
    requestButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    servicesTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#D1D5DB',
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        minHeight: 50,
    },
    tableRowStriped: {
        backgroundColor: '#F9FAFB',
    },
    tableRowSelected: {
        borderLeftWidth: 3,
    },
    checkboxContainer: {
        width: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxChecked: {
    },
    serviceNameColumn: {
        flex: 2,
        paddingHorizontal: 6,
    },
    descriptionColumn: {
        flex: 3,
        paddingHorizontal: 6,
    },
    priceColumn: {
        flex: 1.5,
        paddingHorizontal: 6,
        textAlign: 'right',
    },
    tableCellText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        lineHeight: 18,
    },
    tableCellTextSecondary: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    tableCellPrice: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'right',
    },
});
