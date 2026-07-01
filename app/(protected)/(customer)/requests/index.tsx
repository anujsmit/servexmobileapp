// app/(protected)/(customer)/requests/index.tsx

import React, { useState, useEffect } from 'react';
import { useSearch } from '../../../../context/SearchContext';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFilteredCombinedRequests, useCombinedRequestsStats } from '../../../../hooks/combinedRequests';
import { useCancelOrder } from '../../../../hooks/queries';
import { API_BASE_URL as API_URL } from '../../../../lib/config';
import { useUIStore } from '../../../../store/useUIStore';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';

// ============================================
// BLUE THEME CONSTANTS
// ============================================

const THEME = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    gradientStart: '#2563eb',
    gradientEnd: '#1d4ed8',
    text: '#000000',
    textSecondary: '#333333',
    textTertiary: '#666666',
    textInverse: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    white: '#ffffff',
    background: '#f8fafc',
    surface: '#ffffff',
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.08)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.08)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.08)',
    pending: '#f59e0b',
    assigned: '#2563eb',
    completed: '#22c55e',
    cancelled: '#ef4444',
};

type FilterType = 'all' | 'service_request' | 'order' | 'consultation';
type SortOrder = 'newest' | 'oldest';

interface CombinedRequest {
    id: string;
    originalId: string;
    type: 'service_request' | 'order' | 'consultation';
    title: string;
    address: string;
    status: string;
    statusLabel: string;
    total: number;
    itemCount?: number;
    createdAt: string;
    unpaid?: boolean;
    categoryName?: string;
    urgency?: string;
}

export default function MyRequests() {
    const router = useRouter();
    const { user, token } = useAuth();
    const { cancelSearch, requestId: globalRequestId } = useSearch();
    const queryClient = useQueryClient();
    const { mutateAsync: cancelOrder } = useCancelOrder();
    const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
    const [refreshing, setRefreshing] = useState(false);
    const [combinedRequests, setCombinedRequests] = useState<CombinedRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    
    const filterType = useUIStore((state: any) => state.filterType);
    const sortOrder = useUIStore((state: any) => state.sortOrder);
    const showFilters = useUIStore((state: any) => state.showFilters);
    const setFilterType = useUIStore((state: any) => state.setFilterType);
    const setSortOrder = useUIStore((state: any) => state.setSortOrder);
    const toggleFilters = useUIStore((state: any) => state.toggleFilters);

    useEffect(() => {
        fetchAllRequests();
    }, [filterType, sortOrder]);

    const fetchAllRequests = async () => {
        if (!token) return;
        
        setLoading(true);
        try {
            const serviceResponse = await fetch(`${API_URL}/api/users/service-requests`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const serviceData = await serviceResponse.json();
            
            const orderResponse = await fetch(`${API_URL}/api/users/orders`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const orderData = await orderResponse.json();
            
            const consultationResponse = await fetch(`${API_URL}/api/users/consultations/my`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const consultationData = await consultationResponse.json();

            const serviceRequests = (serviceData.requests || []).map((req: any) => ({
                id: `service_${req.id}`,
                originalId: req.id,
                type: 'service_request' as const,
                title: req.type || 'Service Request',
                address: req.address || 'N/A',
                status: req.status,
                statusLabel: req.status.charAt(0).toUpperCase() + req.status.slice(1),
                total: parseFloat(req.paymentAmount) || 0,
                createdAt: req.createdAt,
                unpaid: req.unpaid || false,
            }));

            const orders = (orderData.orders || []).map((order: any) => ({
                id: `order_${order.id}`,
                originalId: order.id,
                type: 'order' as const,
                title: `Order #${order.id.slice(0, 8).toUpperCase()}`,
                address: order.address || 'N/A',
                status: order.status,
                statusLabel: order.status.charAt(0).toUpperCase() + order.status.slice(1),
                total: parseFloat(order.total) || 0,
                itemCount: order.itemCount || 0,
                createdAt: order.createdAt,
            }));

            const consultations = (consultationData.consultations || []).map((consultation: any) => ({
                id: `consultation_${consultation.id}`,
                originalId: consultation.id,
                type: 'consultation' as const,
                title: consultation.categoryName || 'Consultation',
                address: consultation.location || 'N/A',
                status: consultation.status,
                statusLabel: consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1),
                total: 0,
                createdAt: consultation.createdAt,
                categoryName: consultation.categoryName,
                urgency: consultation.urgency,
            }));

            let allRequests = [...serviceRequests, ...orders, ...consultations];

            if (filterType !== 'all') {
                allRequests = allRequests.filter(req => req.type === filterType);
            }

            allRequests.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
            });

            setCombinedRequests(allRequests);

            const statsData = {
                total: allRequests.length,
                pending: allRequests.filter(r => r.status === 'pending').length,
                assigned: allRequests.filter(r => r.status === 'assigned' || r.status === 'confirmed').length,
                completed: allRequests.filter(r => r.status === 'completed').length,
                cancelled: allRequests.filter(r => r.status === 'cancelled' || r.status === 'canceled').length,
            };
            setStats(statsData);

        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllRequests();
    };

    const handleScrollBeginDrag = () => {
        if (showFilters) {
            toggleFilters();
        }
    };

    const handleCancelServiceRequest = async (id: string) => {
        if (cancellingIds.has(id)) return;
        setCancellingIds(prev => new Set(prev).add(id));
        try {
            await fetch(`${API_URL}/api/users/service-requests/${id}/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            queryClient.invalidateQueries({ queryKey: ['customerRequests'] });
            fetchAllRequests();
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
            fetchAllRequests();
        } catch {
            // ignore
        } finally {
            setCancellingIds(prev => { const newSet = new Set(prev); newSet.delete(orderId); return newSet; });
        }
    };

    const handleCancelConsultation = async (consultationId: string) => {
        if (cancellingIds.has(consultationId)) return;
        setCancellingIds(prev => new Set(prev).add(consultationId));
        try {
            await fetch(`${API_URL}/api/users/consultations/${consultationId}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            fetchAllRequests();
        } catch {
            // ignore
        } finally {
            setCancellingIds(prev => { const newSet = new Set(prev); newSet.delete(consultationId); return newSet; });
        }
    };

    const handleRequestPress = (item: CombinedRequest) => {
        if (item.type === 'service_request') {
            router.push({
                pathname: '/requests/[id]',
                params: { id: item.originalId },
            });
        } else if (item.type === 'order') {
            router.push({
                pathname: '/orders/[id]',
                params: { id: item.originalId },
            });
        } else if (item.type === 'consultation') {
            router.push({
                pathname: '/consultation/[id]',
                params: { id: item.originalId },
            });
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'pending': THEME.pending,
            'assigned': THEME.assigned,
            'confirmed': THEME.assigned,
            'in_progress': '#8b5cf6',
            'completed': THEME.completed,
            'canceled': THEME.cancelled,
            'cancelled': THEME.cancelled,
            'rejected': THEME.cancelled,
            'Pending Approval': THEME.pending,
            'Assigned': THEME.assigned,
            'Completed ✅': THEME.completed,
            'Canceled': THEME.cancelled,
            'Cancelled': THEME.cancelled,
            'Rejected': THEME.cancelled,
        };
        return colors[status] || '#6b7280';
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'service_request':
                return { icon: 'handyman', color: THEME.primary, bg: THEME.primaryBg };
            case 'order':
                return { icon: 'shopping-cart', color: THEME.success, bg: THEME.successBg };
            case 'consultation':
                return { icon: 'chatbubbles', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' };
            default:
                return { icon: 'help', color: THEME.textTertiary, bg: THEME.background };
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'service_request':
                return 'Service';
            case 'order':
                return 'Order';
            case 'consultation':
                return 'Consultation';
            default:
                return 'Request';
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

    const renderRequestItem = ({ item }: { item: CombinedRequest }) => {
        const isService = item.type === 'service_request';
        const isOrder = item.type === 'order';
        const isConsultation = item.type === 'consultation';
        const statusColor = getStatusColor(item.status);
        const isPending = item.status === 'pending' || item.status === 'Pending';
        const isCancellable = isPending || item.status === 'confirmed' || item.status === 'assigned';
        const typeInfo = getTypeIcon(item.type);
        const typeLabel = getTypeLabel(item.type);

        return (
            <TouchableOpacity
                style={[styles.requestCard, { backgroundColor: THEME.white, borderColor: THEME.borderLight }]}
                onPress={() => handleRequestPress(item)}
                activeOpacity={0.8}
            >
                <View style={styles.requestHeader}>
                    <View style={styles.serviceInfo}>
                        <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
                            <MaterialIcons 
                                name={typeInfo.icon as any} 
                                size={14} 
                                color={typeInfo.color} 
                            />
                            <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                                {typeLabel}
                            </Text>
                        </View>
                        <Text style={[styles.requestType, { color: THEME.text }]} numberOfLines={1}>
                            {item.title}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: THEME.textInverse }]}>
                            {item.statusLabel}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.address, { color: THEME.textSecondary }]} numberOfLines={2}>
                    {item.address}
                </Text>

                {isConsultation && item.urgency && (
                    <View style={styles.urgencyBadge}>
                        <Text style={[
                            styles.urgencyText,
                            item.urgency === 'emergency' && { color: THEME.error },
                            item.urgency === 'urgent' && { color: THEME.warning },
                            item.urgency === 'normal' && { color: THEME.textTertiary },
                        ]}>
                            {item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1)}
                        </Text>
                    </View>
                )}

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <MaterialIcons name="receipt" size={14} color={THEME.textTertiary} />
                        <Text style={[styles.detailText, { color: THEME.textSecondary }]}>
                            {isService ? 'Request' : isOrder ? `${item.itemCount || 0} items` : 'Consultation'}
                        </Text>
                    </View>
                    {!isConsultation && (
                        <View style={styles.detailItem}>
                            <MaterialIcons name="attach-money" size={14} color={THEME.success} />
                            <Text style={[styles.detailText, styles.priceText, { color: THEME.success }]}>
                                रु {item.total?.toLocaleString() || 0}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={[styles.cardFooter, { borderTopColor: THEME.borderLight }]}>
                    <View style={styles.footerLeft}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="calendar-today" size={14} color={THEME.textTertiary} />
                            <Text style={[styles.detailText, { color: THEME.textSecondary }]}>
                                {formatDate(item.createdAt)}
                            </Text>
                        </View>
                        {item.unpaid && (
                            <View style={[styles.unpaidInfo, { backgroundColor: THEME.errorBg }]}>
                                <MaterialIcons name="warning" size={12} color={THEME.error} />
                                <Text style={[styles.unpaidText, { color: THEME.error }]}>Payment Pending</Text>
                            </View>
                        )}
                    </View>

                    {isCancellable && (
                        <TouchableOpacity
                            style={[styles.cancelButton, { backgroundColor: THEME.errorBg, borderColor: THEME.error + '40' }]}
                            onPress={() => {
                                if (isService) {
                                    handleCancelServiceRequest(item.originalId);
                                } else if (isOrder) {
                                    handleCancelOrder(item.originalId);
                                } else if (isConsultation) {
                                    handleCancelConsultation(item.originalId);
                                }
                            }}
                            disabled={cancellingIds.has(item.originalId)}
                        >
                            {cancellingIds.has(item.originalId) ? (
                                <ActivityIndicator size="small" color={THEME.error} />
                            ) : (
                                <>
                                    <MaterialIcons name="cancel" size={16} color={THEME.error} />
                                    <Text style={[styles.cancelText, { color: THEME.error }]}>Cancel</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="My Requests"
                    subtitle="View and manage all your service requests"
                />
                <View style={[styles.loading, { backgroundColor: THEME.background }]}>
                    <ActivityIndicator size="large" color={THEME.primary} />
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

            {stats && (
                <View style={[styles.statsContainer, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: THEME.text }]}>{stats.total}</Text>
                        <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>Total</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: THEME.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: THEME.pending }]}>{stats.pending}</Text>
                        <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>Pending</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: THEME.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: THEME.assigned }]}>{stats.assigned}</Text>
                        <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>Assigned</Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: THEME.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: THEME.completed }]}>{stats.completed}</Text>
                        <Text style={[styles.statLabel, { color: THEME.textSecondary }]}>Completed</Text>
                    </View>
                </View>
            )}

            <View style={[styles.filtersHeader, { backgroundColor: THEME.white, borderBottomColor: THEME.borderLight }]}>
                <TouchableOpacity
                    style={styles.filtersToggle}
                    onPress={() => toggleFilters()}
                    activeOpacity={0.7}
                >
                    <View style={styles.filtersToggleContent}>
                        <Ionicons name="filter-outline" size={20} color={THEME.textSecondary} />
                        <Text style={[styles.filtersToggleText, { color: THEME.text }]}>Filters & Sort</Text>
                        <View style={[styles.filterCountBadge, { backgroundColor: THEME.primaryBg, borderColor: THEME.primary + '40' }]}>
                            <Text style={[styles.filterCountText, { color: THEME.primary }]}>{combinedRequests.length}</Text>
                        </View>
                    </View>
                    <MaterialIcons
                        name={showFilters ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={24}
                        color={THEME.textTertiary}
                    />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <View style={[styles.filtersContainer, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <View style={styles.filterSection}>
                        <Text style={[styles.filterTitle, { color: THEME.textSecondary }]}>Request Type</Text>
                        <View style={styles.filterButtons}>
                            {renderFilterButton('all', 'All')}
                            {renderFilterButton('service_request', 'Services')}
                            {renderFilterButton('order', 'Orders')}
                            {renderFilterButton('consultation', 'Consultations')}
                        </View>
                    </View>

                    <View style={styles.filterSection}>
                        <Text style={[styles.filterTitle, { color: THEME.textSecondary }]}>Sort by Date</Text>
                        <View style={styles.sortButtons}>
                            {renderSortButton('newest', 'Newest First')}
                            {renderSortButton('oldest', 'Oldest First')}
                        </View>
                    </View>
                </View>
            )}

            {combinedRequests?.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: THEME.background }]}>
                    <MaterialIcons name="inbox" size={64} color={THEME.textTertiary} />
                    <Text style={[styles.emptyText, { color: THEME.text }]}>No requests found</Text>
                    <Text style={[styles.emptySubtext, { color: THEME.textSecondary }]}>
                        {filterType !== 'all' 
                            ? `No ${filterType === 'service_request' ? 'service' : filterType === 'order' ? 'order' : 'consultation'} requests` 
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
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[THEME.primary]}
                        />
                    }
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
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
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
    },
    statLabel: {
        fontSize: 11,
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        height: 32,
    },
    filtersHeader: {
        borderBottomWidth: 1,
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
        marginLeft: 8,
    },
    filtersToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterCountBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
        borderWidth: 1,
    },
    filterCountText: {
        fontSize: 11,
        fontWeight: '700',
    },
    filtersContainer: {
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    filterSection: {
        marginBottom: 16,
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
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
        borderColor: THEME.border,
        backgroundColor: THEME.background,
    },
    filterButtonActive: {
        backgroundColor: THEME.primary,
        borderColor: THEME.primary,
    },
    filterButtonText: {
        color: THEME.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    filterButtonTextActive: {
        color: THEME.textInverse,
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
        borderColor: THEME.border,
        backgroundColor: THEME.background,
    },
    sortButtonActive: {
        backgroundColor: THEME.success,
        borderColor: THEME.success,
    },
    sortButtonText: {
        color: THEME.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    sortButtonTextActive: {
        color: THEME.textInverse,
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
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        textAlign: 'center',
    },
    listContainer: {
        padding: 16,
        paddingTop: 0,
        paddingBottom: 100,
    },
    requestCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
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
        flexShrink: 1,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        alignSelf: 'flex-start',
    },
    statusText: {
        fontWeight: '700',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#ffffff',
    },
    address: {
        fontSize: 14,
        marginBottom: 12,
        lineHeight: 20,
    },
    urgencyBadge: {
        marginBottom: 8,
    },
    urgencyText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
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
        fontWeight: '500',
    },
    priceText: {
        fontWeight: '700',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
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
        borderRadius: 6,
    },
    unpaidText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 4,
    },
    cancelText: {
        fontWeight: '700',
        fontSize: 12,
    },
});