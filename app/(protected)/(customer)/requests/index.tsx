// app/(protected)/(customer)/requests/index.tsx

import React, { useState } from 'react';
import { useSearch } from '../../../../context/SearchContext';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFilteredCombinedRequests, useCombinedRequestsStats } from '../../../../hooks/combinedRequests';
import { useCancelOrder } from '../../../../hooks/queries';
import { API_BASE_URL as API_URL } from '../../../../lib/config';
import { useUIStore } from '../../../../store/useUIStore';
import { useRouter } from 'expo-router';

type FilterType = 'all' | 'service_request' | 'order';
type SortOrder = 'newest' | 'oldest';

export default function MyRequests() {
    const router = useRouter();
    const { cancelSearch, requestId: globalRequestId } = useSearch();
    const queryClient = useQueryClient();
    const { mutateAsync: cancelOrder } = useCancelOrder();
    const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
    
    const filterType = useUIStore((state: any) => state.filterType);
    const sortOrder = useUIStore((state: any) => state.sortOrder);
    const showFilters = useUIStore((state: any) => state.showFilters);
    const setFilterType = useUIStore((state: any) => state.setFilterType);
    const setSortOrder = useUIStore((state: any) => state.setSortOrder);
    const toggleFilters = useUIStore((state: any) => state.toggleFilters);

    // Use the filtered combined requests hook
    const { 
        data: combinedRequests, 
        isLoading, 
        counts,
        refetch 
    } = useFilteredCombinedRequests({
        type: filterType,
        sortOrder: sortOrder,
    });

    // Get stats
    const { stats } = useCombinedRequestsStats();

    const handleScrollBeginDrag = () => {
        if (showFilters) {
            toggleFilters();
        }
    };

    const handleCancelServiceRequest = async (id: string) => {
        if (cancellingIds.has(id)) return;
        setCancellingIds(prev => new Set(prev).add(id));
        try {
            const token = await SecureStore.getItemAsync('token');
            await fetch(`${API_URL}/api/service-requests/${id}/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            refetch();
            if (id === globalRequestId) {
                cancelSearch();
            }
        } catch {
            // ignore
        } finally {
            setCancellingIds(prev => { const newSet = new Set(prev); newSet.delete(id); return newSet; });
        }
    };

    const handleCancelOrder = async (orderId: string) => {
        if (cancellingIds.has(orderId)) return;
        setCancellingIds(prev => new Set(prev).add(orderId));
        try {
            await cancelOrder({ orderId });
            refetch();
        } catch {
            // ignore
        } finally {
            setCancellingIds(prev => { const newSet = new Set(prev); newSet.delete(orderId); return newSet; });
        }
    };

    const handleRequestPress = (item: any) => {
        if (item.type === 'service_request') {
            router.push({
                pathname: '/requests/[id]',
                params: { id: item.originalId },
            });
        } else {
            router.push({
                pathname: '/orders/[id]',
                params: { id: item.originalId },
            });
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'pending': '#f59e0b',
            'assigned': '#3b82f6',
            'completed': '#22c55e',
            'canceled': '#ef4444',
            'cancelled': '#ef4444',
            'confirmed': '#3b82f6',
            'in_progress': '#8b5cf6',
            'rejected': '#ef4444',
            'Pending Approval': '#f59e0b',
            'Assigned': '#3b82f6',
            'Completed ✅': '#22c55e',
            'Canceled': '#ef4444',
            'Cancelled': '#ef4444',
            'Rejected': '#ef4444',
        };
        return colors[status] || '#6b7280';
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

    const renderFilterButton = (type: FilterType, label: string) => (
        <TouchableOpacity
            style={[
                styles.filterButton,
                filterType === type && styles.filterButtonActive
            ]}
            onPress={() => setFilterType(type)}
        >
            <Text style={[
                styles.filterButtonText,
                filterType === type && styles.filterButtonTextActive
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderSortButton = (order: SortOrder, label: string) => (
        <TouchableOpacity
            style={[
                styles.sortButton,
                sortOrder === order && styles.sortButtonActive
            ]}
            onPress={() => setSortOrder(order)}
        >
            <Text style={[
                styles.sortButtonText,
                sortOrder === order && styles.sortButtonTextActive
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderRequestItem = ({ item }: { item: any }) => {
        const isService = item.type === 'service_request';
        const statusColor = getStatusColor(item.statusLabel || item.status);
        const isPending = item.status === 'pending' || item.status === 'Pending';
        const isCancellable = isPending || item.status === 'confirmed';

        return (
            <TouchableOpacity
                style={styles.requestCard}
                onPress={() => handleRequestPress(item)}
                activeOpacity={0.8}
            >
                <View style={styles.requestHeader}>
                    <View style={styles.serviceInfo}>
                        <View style={[styles.typeBadge, { backgroundColor: isService ? '#eff6ff' : '#ecfdf5' }]}>
                            <MaterialIcons 
                                name={isService ? 'handyman' : 'shopping-cart'} 
                                size={14} 
                                color={isService ? '#2563eb' : '#10b981'} 
                            />
                            <Text style={[styles.typeBadgeText, { color: isService ? '#2563eb' : '#10b981' }]}>
                                {isService ? 'Service' : 'Order'}
                            </Text>
                        </View>
                        <Text style={styles.requestType} numberOfLines={1}>
                            {item.title}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusText}>
                            {item.statusLabel || item.status}
                        </Text>
                    </View>
                </View>

                <Text style={styles.address} numberOfLines={2}>
                    {item.address}
                </Text>

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <MaterialIcons name="receipt" size={14} color="#9ca3af" />
                        <Text style={styles.detailText}>
                            {isService ? 'Request' : `${item.itemCount || 0} items`}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <MaterialIcons name="attach-money" size={14} color="#10b981" />
                        <Text style={[styles.detailText, styles.priceText]}>
                            रु {item.total?.toLocaleString() || 0}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.footerLeft}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="calendar-today" size={14} color="#9ca3af" />
                            <Text style={styles.detailText}>
                                {formatDate(item.createdAt)}
                            </Text>
                        </View>
                        {item.unpaid && (
                            <View style={styles.unpaidInfo}>
                                <MaterialIcons name="warning" size={12} color="#dc2626" />
                                <Text style={styles.unpaidText}>Payment Pending</Text>
                            </View>
                        )}
                    </View>

                    {isCancellable && (
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => {
                                if (isService) {
                                    handleCancelServiceRequest(item.originalId);
                                } else {
                                    handleCancelOrder(item.originalId);
                                }
                            }}
                            disabled={cancellingIds.has(item.originalId)}
                        >
                            {cancellingIds.has(item.originalId) ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <>
                                    <MaterialIcons name="cancel" size={16} color="#ef4444" />
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="My Requests"
                    subtitle="View and manage all your service requests"
                />
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle
                title="My Requests"
                subtitle="View and manage all your service requests"
            />

            {/* Stats Summary */}
            {stats && (
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{stats.total}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{stats.assigned}</Text>
                        <Text style={styles.statLabel}>Assigned</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: '#10b981' }]}>{stats.completed}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </View>
                </View>
            )}

            {/* Filters Header */}
            <View style={styles.filtersHeader}>
                <TouchableOpacity
                    style={styles.filtersToggle}
                    onPress={() => toggleFilters()}
                    activeOpacity={0.7}
                >
                    <View style={styles.filtersToggleContent}>
                        <Ionicons name="filter-outline" size={20} color="#374151" />
                        <Text style={styles.filtersToggleText}>Filters & Sort</Text>
                        <View style={styles.filterCountBadge}>
                            <Text style={styles.filterCountText}>{counts?.total || 0}</Text>
                        </View>
                    </View>
                    <MaterialIcons
                        name={showFilters ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={24}
                        color="#6b7280"
                    />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={styles.filtersContainer}>
                    <View style={styles.filterSection}>
                        <Text style={styles.filterTitle}>Request Type</Text>
                        <View style={styles.filterButtons}>
                            {renderFilterButton('all', 'All')}
                            {renderFilterButton('service_request', 'Services')}
                            {renderFilterButton('order', 'Orders')}
                        </View>
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

            {combinedRequests?.length === 0 ? (
                <View style={styles.empty}>
                    <MaterialIcons name="inbox" size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>No requests found</Text>
                    <Text style={styles.emptySubtext}>
                        {filterType !== 'all' 
                            ? `No ${filterType === 'service_request' ? 'service' : 'order'} requests` 
                            : 'You haven\'t made any requests yet'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={combinedRequests}
                    renderItem={renderRequestItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    onScrollBeginDrag={handleScrollBeginDrag}
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
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    statLabel: {
        fontSize: 11,
        color: '#6b7280',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#e5e7eb',
    },
    filtersHeader: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    filtersToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    filtersToggleText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginLeft: 8,
    },
    filtersToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterCountBadge: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    filterCountText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '700',
    },
    filtersContainer: {
        backgroundColor: '#ffffff',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    filterSection: {
        marginBottom: 16,
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filterButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#f9fafb',
    },
    filterButtonActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    filterButtonText: {
        color: '#4b5563',
        fontSize: 13,
        fontWeight: '600',
    },
    filterButtonTextActive: {
        color: '#ffffff',
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#f9fafb',
    },
    sortButtonActive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    sortButtonText: {
        color: '#4b5563',
        fontSize: 13,
        fontWeight: '600',
    },
    sortButtonTextActive: {
        color: '#ffffff',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4b5563',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 100,
    },
    requestCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        gap: 8,
    },
    serviceInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 4,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    requestType: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flexShrink: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        alignSelf: 'flex-start',
    },
    statusText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    address: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
        lineHeight: 20,
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    priceText: {
        fontWeight: '700',
        color: '#10b981',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 12,
        marginTop: 4,
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    unpaidInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 4,
        backgroundColor: '#fef2f2',
        borderRadius: 6,
    },
    unpaidText: {
        fontSize: 11,
        color: '#dc2626',
        fontWeight: '700',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        gap: 4,
    },
    cancelText: {
        color: '#ef4444',
        fontWeight: '700',
        fontSize: 12,
    },
});