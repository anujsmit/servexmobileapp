import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    ScrollView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NearbyMistri, useMistriRatingsQuery, useMistriServicesQuery } from '../hooks/queries';
import { StatusBar } from 'expo-status-bar';
import { getLightBgColor } from '../lib/serviceColors';
import { RatingStars } from './RatingStars';

interface MistriSelectionModalProps {
    visible: boolean;
    mistri: NearbyMistri | null;
    onClose: () => void;
    onConfirm: (mistri: NearbyMistri, serviceIds: string[]) => void;
    isLoading?: boolean;
}

export const MistriSelectionModal: React.FC<MistriSelectionModalProps> = ({
    visible,
    mistri,
    onClose,
    onConfirm,
    isLoading = false,
}) => {
    if (!mistri) return null;

    const serviceColor = mistri.serviceMapIconColor;
    const serviceBgColor = getLightBgColor(serviceColor);

    // Fetch mistri ratings
    const { data: ratingsData, isLoading: ratingsLoading } = useMistriRatingsQuery(mistri.id);
    const reviews = ratingsData?.ratings || [];
    const averageRating = Number(ratingsData?.averageRating || mistri.averageRating || 0);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialIcons name="close" size={28} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Mistri Profile</Text>
                        <View style={styles.headerPlaceholder} />
                    </View>

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Profile Section */}
                        <View style={styles.profileSection}>
                            <View style={styles.avatarContainer}>
                                {mistri.profilePhotoUrl ? (
                                    <Image
                                        source={{ uri: mistri.profilePhotoUrl }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialIcons name="person" size={48} color="#9ca3af" />
                                    </View>
                                )}
                            </View>

                            <Text style={styles.name}>{mistri.fullName}</Text>
                            <Text style={[styles.service, { color: serviceColor }]}>{mistri.serviceName}</Text>

                            {/* Stats */}
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <MaterialIcons name="star" size={20} color="#fbbf24" />
                                    <Text style={styles.statValue}>
                                        {mistri.averageRating && mistri.averageRating > 0
                                            ? Number(mistri.averageRating).toFixed(1)
                                            : 'New'}
                                    </Text>
                                    <Text style={styles.statLabel}>Rating</Text>
                                </View>

                                <View style={styles.statDivider} />

                                <View style={styles.statItem}>
                                    <MaterialIcons name="work" size={20} color={serviceColor} />
                                    <Text style={styles.statValue}>{mistri.jobsCompleted || 0}</Text>
                                    <Text style={styles.statLabel}>Jobs Done</Text>
                                </View>

                                <View style={styles.statDivider} />

                                <View style={styles.statItem}>
                                    <MaterialIcons name="location-on" size={20} color="#6b7280" />
                                    <Text style={styles.statValue}>{mistri.distance}km</Text>
                                    <Text style={styles.statLabel}>Away</Text>
                                </View>
                            </View>
                        </View>

                        {/* Bio Section */}
                        {mistri.bio && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>About</Text>
                                <Text style={styles.bioText}>{mistri.bio}</Text>
                            </View>
                        )}

                        {/* Service Info */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Service Information</Text>
                            <View style={styles.infoRow}>
                                <MaterialIcons name="build" size={20} color={serviceColor} />
                                <Text style={styles.infoText}>
                                    Specializes in {mistri.serviceName.toLowerCase()} services
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <MaterialIcons name="verified" size={20} color={serviceColor} />
                                <Text style={styles.infoText}>Verified professional</Text>
                            </View>
                        </View>

                        {/* Reviews Section */}
                        <View style={styles.section}>
                            <View style={styles.reviewsHeader}>
                                <Text style={styles.sectionTitle}>
                                    Recent Reviews {reviews.length > 0 && `(${reviews.length})`}
                                </Text>
                                <View style={styles.ratingBadge}>
                                    <MaterialIcons name="star" size={16} color="#fbbf24" />
                                    <Text style={styles.ratingBadgeText}>
                                        {averageRating > 0 ? Number(averageRating).toFixed(1) : 'New'}
                                    </Text>
                                </View>
                            </View>

                            {ratingsLoading ? (
                                <View style={styles.reviewsLoading}>
                                    <ActivityIndicator size="small" color="#6b7280" />
                                    <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
                                </View>
                            ) : reviews.length === 0 ? (
                                <View style={styles.noReviewsContainer}>
                                    <MaterialIcons name="rate-review" size={48} color="#d1d5db" />
                                    <Text style={styles.noReviewsText}>No reviews yet</Text>
                                    <Text style={styles.noReviewsSubtext}>
                                        Be the first to review this mistri!
                                    </Text>
                                </View>
                            ) : (
                                reviews.slice(0, 3).map((review) => (
                                <View key={review.id} style={styles.reviewCard}>
                                    <View style={styles.reviewHeader}>
                                        <View style={[styles.reviewerAvatar, { backgroundColor: serviceColor }]}>
                                            <Text style={styles.reviewerInitial}>
                                                {review.customerName.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.reviewerInfo}>
                                            <Text style={styles.reviewerName}>{review.customerName}</Text>
                                            <View style={styles.reviewRating}>
                                                <RatingStars rating={review.rating} size={14} />
                                                <Text style={styles.reviewDate}>
                                                    {new Date(review.createdAt).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {review.review && (
                                        <Text style={styles.reviewComment} numberOfLines={3}>
                                            {review.review}
                                        </Text>
                                    )}
                                </View>
                            )))}
                        </View>

                        {/* Note */}
                        <View style={[styles.noteContainer, { backgroundColor: serviceBgColor }]}>
                            <MaterialIcons name="info" size={20} color={serviceColor} />
                            <Text style={[styles.noteText, { color: serviceColor }]}>
                                Your request will be sent to this mistri. They can accept or decline.
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={onClose}
                            disabled={isLoading}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
                            onPress={() => onConfirm(mistri)}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            {isLoading ? (
                                <Text style={styles.confirmButtonText}>Sending...</Text>
                            ) : (
                                <>
                                    <Text style={styles.confirmButtonText}>Send Request</Text>
                                    <MaterialIcons name="send" size={18} color="#fff" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        backgroundColor: '#ffffff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    headerPlaceholder: {
        width: 36,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 20,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
        backgroundColor: '#f9fafb',
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        borderColor: '#fff',
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    name: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    service: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 24,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#e5e7eb',
        marginHorizontal: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    bioText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 24,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 15,
        color: '#374151',
        marginLeft: 12,
        flex: 1,
    },
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        marginHorizontal: 20,
        marginTop: 12,
        borderRadius: 12,
    },
    noteText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 12,
        flex: 1,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#ffffff',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    confirmButton: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: '#16a34a',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    // Reviews Section Styles
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    ratingBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#d97706',
    },
    reviewCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    reviewHeader: {
        flexDirection: 'row',
        marginBottom: 12,
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
        color: '#ffffff',
    },
    reviewerInfo: {
        flex: 1,
    },
    reviewerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    reviewRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    reviewDate: {
        fontSize: 12,
        color: '#9ca3af',
        marginLeft: 8,
    },
    reviewComment: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    reviewsLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 32,
    },
    reviewsLoadingText: {
        fontSize: 14,
        color: '#6b7280',
    },
    noReviewsContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    noReviewsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6b7280',
        marginTop: 12,
    },
    noReviewsSubtext: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 4,
    },
});
