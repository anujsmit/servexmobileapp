import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons } from '@expo/vector-icons';
import { RatingStars } from '../../../../components/RatingStars';
import { useMistriReceivedRatingsQuery } from '../../../../hooks/queries';
import { useRouter } from 'expo-router';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../../lib/mistriDashboardTokens';

type FilterType = 'all' | '5' | '4' | '3' | '2' | '1';

export default function ReviewsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const filterBrand = useMemo(
        () => ({
            on: { borderColor: trade.accent, backgroundColor: trade.accentSoft },
            textOn: { color: trade.accent },
        }),
        [trade]
    );
    const [filter, setFilter] = useState<FilterType>('all');
    const { data: ratingsData, isLoading, error } = useMistriReceivedRatingsQuery();

    const ratings = ratingsData?.ratings || [];
    const averageRating = ratingsData?.averageRating || 0;
    const totalRatings = ratingsData?.totalRatings || 0;

    // Filter ratings based on selected filter
    const filteredRatings = ratings.filter(rating => {
        if (filter === 'all') return true;
        return rating.rating === parseInt(filter);
    });

    const getRatingCounts = () => {
        const counts = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
        ratings.forEach(rating => {
            const stars = rating.rating.toString() as keyof typeof counts;
            if (counts[stars] !== undefined) {
                counts[stars]++;
            }
        });
        return counts;
    };

    const ratingCounts = getRatingCounts();

    const handleViewJob = (requestId: string) => {
        router.push({
            pathname: '/(protected)/(mistri)/job-details',
            params: { requestId },
        });
    };

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Reviews" variant="mistri" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading reviews...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    if (error) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Reviews" variant="mistri" />
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={64} color="#ef4444" />
                    <Text style={styles.errorText}>Failed to load reviews</Text>
                    <Text style={styles.errorSubtext}>Please try again later</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Reviews"
                subtitle={`${totalRatings} ${totalRatings === 1 ? 'review' : 'reviews'}`}
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Rating Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryLeft}>
                        <Text style={styles.avgRatingNumber}>
                            {averageRating > 0 ? Number(averageRating).toFixed(1) : 'N/A'}
                        </Text>
                        <RatingStars rating={averageRating || 0} size={20} />
                        <Text style={styles.totalReviews}>
                            {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
                        </Text>
                    </View>

                    <View style={styles.summaryRight}>
                        {[5, 4, 3, 2, 1].map(stars => {
                            const count = ratingCounts[stars.toString() as keyof typeof ratingCounts];
                            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                            return (
                                <View key={stars} style={styles.ratingBarRow}>
                                    <Text style={styles.ratingBarLabel}>{stars}</Text>
                                    <MaterialIcons name="star" size={14} color="#fbbf24" />
                                    <View style={styles.ratingBarTrack}>
                                        <View
                                            style={[
                                                styles.ratingBarFill,
                                                { width: `${percentage}%` },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.ratingBarCount}>{count}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Filter Chips */}
                <View style={styles.filtersContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filtersContent}
                    >
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                filter === 'all' && styles.filterChipActive,
                                filter === 'all' && filterBrand.on,
                            ]}
                            onPress={() => setFilter('all')}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    filter === 'all' && styles.filterChipTextActive,
                                    filter === 'all' && filterBrand.textOn,
                                ]}
                            >
                                All ({ratings.length})
                            </Text>
                        </TouchableOpacity>

                        {[5, 4, 3, 2, 1].map(stars => (
                            <TouchableOpacity
                                key={stars}
                                style={[
                                    styles.filterChip,
                                    filter === stars.toString() && styles.filterChipActive,
                                    filter === stars.toString() && filterBrand.on,
                                ]}
                                onPress={() => setFilter(stars.toString() as FilterType)}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="star" size={16} color={filter === stars.toString() ? '#fbbf24' : DC.muted} />
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        filter === stars.toString() && styles.filterChipTextActive,
                                        filter === stars.toString() && filterBrand.textOn,
                                    ]}
                                >
                                    {stars} ({ratingCounts[stars.toString() as keyof typeof ratingCounts]})
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Reviews List */}
                {filteredRatings.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="rate-review" size={48} color={DC.muted} />
                        <Text style={styles.emptyTitle}>
                            {filter === 'all' ? 'No Reviews Yet' : `No ${filter}-Star Reviews`}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {filter === 'all'
                                ? 'Reviews from customers will appear here'
                                : 'No reviews with this rating'}
                        </Text>
                    </View>
                ) : (
                    filteredRatings.map((rating) => (
                        <View key={rating.id} style={styles.reviewCard}>
                            {/* Review Header */}
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewHeaderLeft}>
                                    <Text style={styles.customerName}>{rating.customerName || 'Customer'}</Text>
                                    <RatingStars rating={rating.rating} size={16} />
                                </View>
                                <Text style={styles.reviewDate}>
                                    {new Date(rating.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </Text>
                            </View>

                            {/* Review Text */}
                            {rating.review && (
                                <Text style={styles.reviewText}>{rating.review}</Text>
                            )}

                            {/* Job Reference */}
                            <TouchableOpacity
                                style={styles.jobReference}
                                onPress={() => handleViewJob(rating.requestId)}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="work-outline" size={16} color={trade.accent} />
                                <Text style={[styles.jobReferenceText, { color: trade.accent }]}>
                                    View Job Details
                                </Text>
                                <MaterialIcons name="arrow-forward-ios" size={14} color={DC.muted} />
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </ScrollView>
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
        fontSize: 16,
        color: DC.muted,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: DC.canvas,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ef4444',
        marginTop: 16,
    },
    errorSubtext: {
        fontSize: 14,
        color: DC.muted,
        marginTop: 8,
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
    summaryCard: {
        flexDirection: 'row',
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 20,
        marginBottom: 14,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
        gap: 24,
    },
    summaryLeft: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: 'rgba(15, 23, 42, 0.08)',
        paddingRight: 24,
    },
    avgRatingNumber: {
        fontSize: 48,
        fontWeight: '700',
        color: DC.text,
        lineHeight: 56,
    },
    totalReviews: {
        fontSize: 12,
        color: DC.muted,
        marginTop: 8,
    },
    summaryRight: {
        flex: 1,
        justifyContent: 'center',
        gap: 6,
    },
    ratingBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ratingBarLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: DC.text,
        width: 8,
    },
    ratingBarTrack: {
        flex: 1,
        height: 8,
        backgroundColor: DC.surfaceMuted,
        borderRadius: 4,
        overflow: 'hidden',
    },
    ratingBarFill: {
        height: '100%',
        backgroundColor: '#fbbf24',
        borderRadius: 4,
    },
    ratingBarCount: {
        fontSize: 13,
        fontWeight: '500',
        color: DC.muted,
        width: 24,
        textAlign: 'right',
    },
    filtersContainer: {
        marginBottom: 14,
    },
    filtersContent: {
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: DC.surface,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        gap: 6,
    },
    filterChipActive: {},
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: DC.muted,
    },
    filterChipTextActive: {
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: DC.text,
        marginTop: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 12,
        color: DC.muted,
        marginTop: 6,
        textAlign: 'center',
        lineHeight: 16,
    },
    reviewCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 14,
        marginBottom: 10,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    reviewHeaderLeft: {
        flex: 1,
        gap: 6,
    },
    customerName: {
        fontSize: 15,
        fontWeight: '600',
        color: DC.text,
    },
    reviewDate: {
        fontSize: 12,
        color: DC.muted,
    },
    reviewText: {
        fontSize: 14,
        color: DC.text,
        lineHeight: 20,
        marginBottom: 12,
    },
    jobReference: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(15, 23, 42, 0.06)',
    },
    jobReferenceText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
});
