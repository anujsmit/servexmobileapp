import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../../lib/mistriDashboardTokens';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useMistriAcceptedJobsQuery, useMistriProfileQuery, MistriJob } from '../../../../hooks/queries';
import { useRouter } from 'expo-router';
import { useServices } from '../../../../context/ServicesContext';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';

type SortOrder = 'newest' | 'oldest';
type JobFilter = 'all' | 'active' | 'completed';

export default function MyJobsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const jobsBrand = useMemo(
        () => ({
            filterOn: { borderColor: trade.accent, backgroundColor: trade.accentSoft },
            filterTextOn: { color: trade.accent },
        }),
        [trade]
    );

    // Fetch mistri profile to determine polling status
    const { data: profile } = useMistriProfileQuery();
    // Only poll when mistri is available (not unavailable or on_work)
    const shouldPoll = profile?.availabilityStatus === 'available';
    const { data: jobs = [], isLoading, error, refetch } = useMistriAcceptedJobsQuery({ enablePolling: shouldPoll });
    const { activeServices } = useServices();
    const [jobFilter, setJobFilter] = useState<JobFilter>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [showFilters, setShowFilters] = useState(false);

    const filteredAndSortedJobs = useMemo(() => {
        let filtered = jobs;

        if (jobFilter === 'active') {
            filtered = filtered.filter(job => job.status === 'assigned' || job.status === 'pending');
        } else if (jobFilter === 'completed') {
            filtered = filtered.filter(job => job.status === 'completed');
        }

        if (filterType !== 'all') {
            filtered = filtered.filter(job => job.type.toLowerCase() === filterType.toLowerCase());
        }

        filtered = [...filtered].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return filtered;
    }, [jobs, jobFilter, filterType, sortOrder]);

    const getSubtitle = () => {
        const n = filteredAndSortedJobs.length;
        if (jobFilter === 'all') {
            if (filterType === 'all') {
                return `${jobs.length} accepted ${jobs.length === 1 ? 'job' : 'jobs'}`;
            }
            return `${n} ${n === 1 ? 'job' : 'jobs'}`;
        }
        if (jobFilter === 'active') return `${n} active ${n === 1 ? 'job' : 'jobs'}`;
        if (jobFilter === 'completed') return `${n} completed ${n === 1 ? 'job' : 'jobs'}`;
        return '';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return '#f59e0b';
            case 'assigned':
                return '#0284c7';
            case 'completed':
                return trade.accent;
            case 'canceled':
                return '#ef4444';
            default:
                return DC.muted;
        }
    };

    const getStatusBgColor = (status: string) => {
        switch (status) {
            case 'pending':
                return '#fef3c7';
            case 'assigned':
                return '#e0f2fe';
            case 'completed':
                return trade.accentSoft;
            case 'canceled':
                return '#fee2e2';
            default:
                return DC.surfaceMuted;
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderFilterButton = (type: string, label: string) => (
        <TouchableOpacity
            key={type}
            style={[
                styles.filterButton,
                filterType === type && { backgroundColor: trade.accent, borderColor: trade.accent },
            ]}
            onPress={() => setFilterType(type)}
            activeOpacity={0.7}
        >
            <Text style={[
                styles.filterButtonText,
                filterType === type && styles.filterButtonTextActive,
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderSortButton = (order: SortOrder, label: string) => (
        <TouchableOpacity
            key={order}
            style={[
                styles.sortButton,
                sortOrder === order && { backgroundColor: trade.accent, borderColor: trade.accent },
            ]}
            onPress={() => setSortOrder(order)}
            activeOpacity={0.7}
        >
            <Text style={[
                styles.sortButtonText,
                sortOrder === order && styles.sortButtonTextActive,
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const handleJobPress = (job: MistriJob) => {
        router.push({
            pathname: '/(protected)/(mistri)/job-details',
            params: { requestId: job.id },
        });
    };

    const renderJobItem = ({ item }: { item: MistriJob }) => {
        const statusColor = getStatusColor(item.status);
        const statusBgColor = getStatusBgColor(item.status);
        
        return (
            <TouchableOpacity
                style={styles.jobCard}
                onPress={() => handleJobPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.jobHeader}>
                    <View style={[styles.jobTypeIcon, { backgroundColor: trade.accentSoft }]}>
                        <MaterialIcons name="build" size={20} color={trade.accent} />
                    </View>
                    <View style={styles.jobInfo}>
                        <Text style={styles.jobType} numberOfLines={1}>
                            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Text>
                        <Text style={styles.jobCustomerHint} numberOfLines={1}>
                            {item.customerName}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                </View>

                <Text style={styles.address} numberOfLines={2}>
                    <Ionicons name="location-outline" size={14} color={DC.muted} />
                    {' '}{item.address}
                </Text>

                <View style={styles.timestampContainer}>
                    <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={14} color={DC.muted} />
                        <Text style={styles.date}>Requested: {formatDate(item.createdAt)}</Text>
                    </View>
                    {item.assignedAt && (
                        <View style={styles.acceptedInfo}>
                            <Ionicons name="checkmark-circle" size={14} color={trade.accent} />
                            <Text style={[styles.acceptedText, { color: trade.accent }]}>
                                Accepted {formatDate(item.assignedAt)}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.jobFooter}>
                    <View style={styles.priceContainer}>
                        <Text style={[styles.priceText, { color: trade.accent }]}>
                            NPR {item.paymentAmount ? parseInt(item.paymentAmount).toLocaleString() : '0'}
                        </Text>
                    </View>
                    <View style={styles.viewDetailsHint}>
                        <Text style={[styles.viewDetailsText, { color: trade.accent }]}>View Details</Text>
                        <Ionicons name="arrow-forward" size={14} color={trade.accent} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle title="My Jobs" variant="mistri" />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading jobs...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle variant="mistri" title="My Jobs" subtitle={getSubtitle()} />

            <View style={styles.statusFiltersWrap}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.statusFiltersContent}
                >
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            jobFilter === 'all' && styles.filterChipActive,
                            jobFilter === 'all' && jobsBrand.filterOn,
                        ]}
                        onPress={() => setJobFilter('all')}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                jobFilter === 'all' && styles.filterChipTextActive,
                                jobFilter === 'all' && jobsBrand.filterTextOn,
                            ]}
                        >
                            All ({jobs.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            jobFilter === 'active' && styles.filterChipActive,
                            jobFilter === 'active' && jobsBrand.filterOn,
                        ]}
                        onPress={() => setJobFilter('active')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.filterDot, { backgroundColor: '#0284c7' }]} />
                        <Text
                            style={[
                                styles.filterChipText,
                                jobFilter === 'active' && styles.filterChipTextActive,
                                jobFilter === 'active' && jobsBrand.filterTextOn,
                            ]}
                        >
                            Active ({jobs.filter(j => j.status === 'assigned' || j.status === 'pending').length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            jobFilter === 'completed' && styles.filterChipActive,
                            jobFilter === 'completed' && jobsBrand.filterOn,
                        ]}
                        onPress={() => setJobFilter('completed')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.filterDot, { backgroundColor: trade.accent }]} />
                        <Text
                            style={[
                                styles.filterChipText,
                                jobFilter === 'completed' && styles.filterChipTextActive,
                                jobFilter === 'completed' && jobsBrand.filterTextOn,
                            ]}
                        >
                            Completed ({jobs.filter(j => j.status === 'completed').length})
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <View style={styles.filtersHeader}>
                <TouchableOpacity
                    style={styles.filtersToggle}
                    onPress={() => setShowFilters(!showFilters)}
                    activeOpacity={0.7}
                >
                    <View style={styles.filtersToggleContent}>
                        <Ionicons
                            name="options-outline"
                            size={20}
                            color={DC.muted}
                        />
                        <Text style={styles.filtersToggleText}>Filters & Sort</Text>
                    </View>
                    <Ionicons
                        name={showFilters ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={DC.muted}
                    />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={styles.filtersContainer}>
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Service Type</Text>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterButtons}
                        >
                            {renderFilterButton('all', 'All')}
                            {activeServices.map(service => (
                                renderFilterButton(
                                    service.serviceName.toLowerCase(),
                                    service.displayName
                                )
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Sort by Date</Text>
                        <View style={styles.sortButtons}>
                            {renderSortButton('newest', 'Newest First')}
                            {renderSortButton('oldest', 'Oldest First')}
                        </View>
                    </View>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                    <Text style={styles.errorText}>Failed to load jobs. Please try again.</Text>
                    <TouchableOpacity 
                        style={[styles.retryButton, { backgroundColor: trade.accent }]}
                        onPress={() => refetch()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {filteredAndSortedJobs.length === 0 ? (
                <View style={styles.empty}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: trade.accentSoft }]}>
                        <Ionicons name="briefcase-outline" size={40} color={trade.accent} />
                    </View>
                    <Text style={styles.emptyText}>No accepted jobs</Text>
                    <Text style={styles.emptySubtext}>
                        {jobFilter === 'completed'
                            ? 'Completed jobs will appear here'
                            : jobFilter === 'active'
                              ? 'Active jobs will appear here'
                              : filterType !== 'all'
                                ? `No ${filterType} jobs found`
                                : 'Jobs you accept will appear here'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredAndSortedJobs}
                    renderItem={renderJobItem}
                    keyExtractor={(item) => item.id}
                    style={styles.listScroll}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    onScrollBeginDrag={() => showFilters && setShowFilters(false)}
                    scrollEventThrottle={16}
                />
            )}
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: DC.canvas,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: DC.muted,
        fontWeight: '500',
    },
    listScroll: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    statusFiltersWrap: {
        backgroundColor: DC.surface,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(15, 23, 42, 0.06)',
        paddingVertical: 12,
    },
    statusFiltersContent: {
        paddingHorizontal: 16,
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: DC.surfaceMuted,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        gap: 6,
    },
    filterChipActive: {
        backgroundColor: '#ffffff',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: DC.muted,
    },
    filterChipTextActive: {
        fontWeight: '600',
        color: DC.text,
    },
    filterDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    filtersHeader: {
        backgroundColor: DC.surface,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(15, 23, 42, 0.06)',
    },
    filtersToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    filtersToggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: DC.text,
        marginLeft: 10,
    },
    filtersToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filtersContainer: {
        backgroundColor: DC.canvas,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(15, 23, 42, 0.06)',
    },
    filterSection: {
        marginBottom: 16,
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: DC.text,
        letterSpacing: -0.2,
        marginBottom: 10,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 2,
    },
    filterButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        backgroundColor: DC.surface,
    },
    filterButtonText: {
        color: DC.muted,
        fontSize: 13,
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#ffffff',
        fontWeight: '600',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        backgroundColor: DC.surface,
    },
    sortButtonText: {
        color: DC.muted,
        fontSize: 13,
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: '#ffffff',
        fontWeight: '600',
    },
    errorContainer: {
        margin: 20,
        padding: 16,
        backgroundColor: '#fee2e2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
        alignItems: 'center',
        gap: 8,
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 14,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 4,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        backgroundColor: DC.canvas,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: DC.text,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 13,
        color: DC.muted,
        textAlign: 'center',
        lineHeight: 20,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        paddingTop: 12,
    },
    jobCard: {
        backgroundColor: DC.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.05)',
        ...MISTRI_ELEV.card,
    },
    jobHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    jobTypeIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    jobInfo: {
        flex: 1,
        minWidth: 0,
    },
    jobType: {
        fontSize: 15,
        fontWeight: '600',
        color: DC.text,
    },
    jobCustomerHint: {
        fontSize: 12,
        color: DC.muted,
        marginTop: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: DC.surfaceMuted,
    },
    statusText: {
        fontWeight: '600',
        fontSize: 11,
        textTransform: 'capitalize',
    },
    address: {
        fontSize: 13,
        color: DC.text,
        marginBottom: 10,
        lineHeight: 18,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    date: {
        fontSize: 12,
        color: DC.muted,
    },
    timestampContainer: {
        marginBottom: 12,
        gap: 4,
    },
    acceptedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    acceptedText: {
        fontSize: 12,
        fontWeight: '500',
    },
    jobFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(15, 23, 42, 0.05)',
        paddingTop: 12,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    priceText: {
        fontSize: 14,
        fontWeight: '700',
    },
    viewDetailsHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewDetailsText: {
        fontSize: 13,
        fontWeight: '600',
    },
});