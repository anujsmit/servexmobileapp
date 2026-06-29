// app/(protected)/(mistri)/my-jobs.tsx

import React, { useMemo, useState, useCallback } from 'react';
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

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------
const safeString = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    try {
        return String(value);
    } catch {
        return fallback;
    }
};

const safeCapitalize = (str: any): string => {
    try {
        const s = safeString(str, '');
        if (!s) return 'Unknown';
        return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
        return 'Unknown';
    }
};

const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid date';
    }
};

const safeAmount = (value: any): string => {
    try {
        const num = parseFloat(String(value));
        return Number.isFinite(num) ? num.toLocaleString() : '0';
    } catch {
        return '0';
    }
};

type SortOrder = 'newest' | 'oldest';
type JobFilter = 'all' | 'active' | 'completed';

export default function MyJobsScreen() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    
    const jobsBrand = useMemo(
        () => ({
            filterOn: { borderColor: trade?.accent || '#2563EB', backgroundColor: trade?.accentSoft || '#EFF6FF' },
            filterTextOn: { color: trade?.accent || '#2563EB' },
        }),
        [trade]
    );

    // Fetch mistri profile to determine polling status
    const { data: profile } = useMistriProfileQuery();
    
    // Only poll when mistri is available
    const shouldPoll = profile?.availabilityStatus === 'available';
    
    const { 
        data: jobs = [], 
        isLoading, 
        error, 
        refetch 
    } = useMistriAcceptedJobsQuery({ 
        enablePolling: shouldPoll 
    });
    
    const { services = [] } = useServices();
    
    // ✅ Get unique service types from jobs
    const serviceTypes = useMemo(() => {
        const types = new Set<string>();
        jobs.forEach((job: any) => {
            if (job?.type) {
                types.add(job.type.toLowerCase());
            }
        });
        return Array.from(types);
    }, [jobs]);
    
    const [jobFilter, setJobFilter] = useState<JobFilter>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [showFilters, setShowFilters] = useState(false);

    // Safe filtered and sorted jobs
    const filteredAndSortedJobs = useMemo(() => {
        try {
            // Ensure jobs is an array
            let filtered = Array.isArray(jobs) ? [...jobs] : [];

            // Filter by status
            if (jobFilter === 'active') {
                filtered = filtered.filter(
                    job => job?.status === 'assigned' || job?.status === 'pending'
                );
            } else if (jobFilter === 'completed') {
                filtered = filtered.filter(
                    job => job?.status === 'completed'
                );
            }

            // Filter by service type
            if (filterType !== 'all') {
                filtered = filtered.filter(
                    job => safeString(job?.type, '').toLowerCase() === filterType.toLowerCase()
                );
            }

            // Sort by date
            filtered.sort((a, b) => {
                try {
                    const dateA = new Date(a?.createdAt || 0).getTime();
                    const dateB = new Date(b?.createdAt || 0).getTime();
                    
                    if (Number.isNaN(dateA) && Number.isNaN(dateB)) return 0;
                    if (Number.isNaN(dateA)) return 1;
                    if (Number.isNaN(dateB)) return -1;
                    
                    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
                } catch {
                    return 0;
                }
            });

            return filtered;
        } catch (error) {
            console.error('Error filtering jobs:', error);
            return [];
        }
    }, [jobs, jobFilter, filterType, sortOrder]);

    // Safe counts
    const jobCounts = useMemo(() => {
        try {
            const jobsArray = Array.isArray(jobs) ? jobs : [];
            return {
                total: jobsArray.length,
                active: jobsArray.filter(j => j?.status === 'assigned' || j?.status === 'pending').length,
                completed: jobsArray.filter(j => j?.status === 'completed').length,
            };
        } catch {
            return { total: 0, active: 0, completed: 0 };
        }
    }, [jobs]);

    const getSubtitle = useCallback(() => {
        const n = filteredAndSortedJobs.length;
        const word = n === 1 ? 'job' : 'jobs';
        
        if (jobFilter === 'all') {
            if (filterType === 'all') {
                return `${jobCounts.total} accepted ${jobCounts.total === 1 ? 'job' : 'jobs'}`;
            }
            return `${n} ${word}`;
        }
        if (jobFilter === 'active') return `${n} active ${word}`;
        if (jobFilter === 'completed') return `${n} completed ${word}`;
        return '';
    }, [filteredAndSortedJobs.length, jobFilter, filterType, jobCounts]);

    const getStatusColor = useCallback((status: string) => {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'assigned': return '#0284c7';
            case 'completed': return trade?.accent || '#10B981';
            case 'canceled': return '#ef4444';
            default: return DC.muted;
        }
    }, [trade?.accent]);

    const getStatusBgColor = useCallback((status: string) => {
        switch (status) {
            case 'pending': return '#fef3c7';
            case 'assigned': return '#e0f2fe';
            case 'completed': return trade?.accentSoft || '#D1FAE5';
            case 'canceled': return '#fee2e2';
            default: return DC.surfaceMuted;
        }
    }, [trade?.accentSoft]);

    // ✅ Get display name for service type
    const getServiceDisplayName = useCallback((serviceName: string) => {
        const service = services.find((s: any) => 
            s?.serviceName?.toLowerCase() === serviceName.toLowerCase()
        );
        return service?.displayName || safeCapitalize(serviceName);
    }, [services]);

    // ✅ Render filter buttons from actual service types in jobs
    const renderFilterButton = useCallback((type: string, label: string) => (
        <TouchableOpacity
            key={type}
            style={[
                styles.filterButton,
                filterType === type && { 
                    backgroundColor: trade?.accent || '#2563EB', 
                    borderColor: trade?.accent || '#2563EB' 
                },
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
    ), [filterType, trade?.accent]);

    const renderSortButton = useCallback((order: SortOrder, label: string) => (
        <TouchableOpacity
            key={order}
            style={[
                styles.sortButton,
                sortOrder === order && { 
                    backgroundColor: trade?.accent || '#2563EB', 
                    borderColor: trade?.accent || '#2563EB' 
                },
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
    ), [sortOrder, trade?.accent]);

    const handleJobPress = useCallback((job: any) => {
        if (!job?.id) return;
        
        try {
            router.push({
                pathname: '/(protected)/(mistri)/job-details',
                params: { requestId: job.id },
            });
        } catch (error) {
            console.error('Navigation error:', error);
        }
    }, [router]);

    const renderJobItem = useCallback(({ item }: { item: any }) => {
        // Safety check
        if (!item) return null;
        
        try {
            const statusColor = getStatusColor(item.status);
            const statusBgColor = getStatusBgColor(item.status);
            const jobType = getServiceDisplayName(item.type);
            const customerName = safeString(item.customerName, 'Unknown Customer');
            const address = safeString(item.address, 'No address provided');
            const status = safeCapitalize(item.status);
            const paymentAmount = safeAmount(item.paymentAmount);
            const createdAt = formatDate(item.createdAt);
            const assignedAt = item.assignedAt ? formatDate(item.assignedAt) : null;
            
            return (
                <TouchableOpacity
                    style={styles.jobCard}
                    onPress={() => handleJobPress(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.jobHeader}>
                        <View style={[
                            styles.jobTypeIcon, 
                            { backgroundColor: trade?.accentSoft || '#EFF6FF' }
                        ]}>
                            <MaterialIcons 
                                name="build" 
                                size={20} 
                                color={trade?.accent || '#2563EB'} 
                            />
                        </View>
                        <View style={styles.jobInfo}>
                            <Text style={styles.jobType} numberOfLines={1}>
                                {jobType}
                            </Text>
                            <Text style={styles.jobCustomerHint} numberOfLines={1}>
                                {customerName}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {status}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.address} numberOfLines={2}>
                        <Ionicons name="location-outline" size={14} color={DC.muted} />
                        {' '}{address}
                    </Text>

                    <View style={styles.timestampContainer}>
                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={14} color={DC.muted} />
                            <Text style={styles.date}>Requested: {createdAt}</Text>
                        </View>
                        {assignedAt && (
                            <View style={styles.acceptedInfo}>
                                <Ionicons 
                                    name="checkmark-circle" 
                                    size={14} 
                                    color={trade?.accent || '#10B981'} 
                                />
                                <Text style={[
                                    styles.acceptedText, 
                                    { color: trade?.accent || '#10B981' }
                                ]}>
                                    Accepted {assignedAt}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.jobFooter}>
                        <View style={styles.priceContainer}>
                            <Text style={[
                                styles.priceText, 
                                { color: trade?.accent || '#10B981' }
                            ]}>
                                NPR {paymentAmount}
                            </Text>
                        </View>
                        <View style={styles.viewDetailsHint}>
                            <Text style={[
                                styles.viewDetailsText, 
                                { color: trade?.accent || '#2563EB' }
                            ]}>View Details</Text>
                            <Ionicons 
                                name="arrow-forward" 
                                size={14} 
                                color={trade?.accent || '#2563EB'} 
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            );
        } catch (error) {
            console.error('Error rendering job item:', error);
            return null;
        }
    }, [getStatusColor, getStatusBgColor, getServiceDisplayName, handleJobPress, trade]);

    const keyExtractor = useCallback((item: any) => {
        return item?.id || Math.random().toString();
    }, []);

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle title="My Jobs" variant="mistri" />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={trade?.accent || '#2563EB'} />
                    <Text style={styles.loadingText}>Loading jobs...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle variant="mistri" title="My Jobs" subtitle={getSubtitle()} />

            {/* Status Filters */}
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
                            All ({jobCounts.total})
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
                            Active ({jobCounts.active})
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
                        <View style={[
                            styles.filterDot, 
                            { backgroundColor: trade?.accent || '#10B981' }
                        ]} />
                        <Text
                            style={[
                                styles.filterChipText,
                                jobFilter === 'completed' && styles.filterChipTextActive,
                                jobFilter === 'completed' && jobsBrand.filterTextOn,
                            ]}
                        >
                            Completed ({jobCounts.completed})
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Filters Toggle */}
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

            {/* Extended Filters */}
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
                            {serviceTypes.map(type => 
                                renderFilterButton(type, getServiceDisplayName(type))
                            )}
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

            {/* Error State */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                    <Text style={styles.errorText}>Failed to load jobs. Please try again.</Text>
                    <TouchableOpacity 
                        style={[
                            styles.retryButton, 
                            { backgroundColor: trade?.accent || '#2563EB' }
                        ]}
                        onPress={() => refetch()}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredAndSortedJobs.length === 0 && (
                <View style={styles.empty}>
                    <View style={[
                        styles.emptyIconContainer, 
                        { backgroundColor: trade?.accentSoft || '#EFF6FF' }
                    ]}>
                        <Ionicons 
                            name="briefcase-outline" 
                            size={40} 
                            color={trade?.accent || '#2563EB'} 
                        />
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
            )}

            {/* Jobs List */}
            {!isLoading && !error && filteredAndSortedJobs.length > 0 && (
                <FlatList
                    data={filteredAndSortedJobs}
                    renderItem={renderJobItem}
                    keyExtractor={keyExtractor}
                    style={styles.listScroll}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    onScrollBeginDrag={() => showFilters && setShowFilters(false)}
                    scrollEventThrottle={16}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
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