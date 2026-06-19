import React, { useMemo, useState } from 'react';
import { useSearch } from '../../../../context/SearchContext';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useCustomerRequestsQuery } from '../../../../hooks/queries';
import { API_BASE_URL as API_URL } from '../../../../lib/config';
import { useUIStore } from '../../../../store/useUIStore';
import { useRouter } from 'expo-router';
import { useServices } from '../../../../context/ServicesContext';

interface ServiceRequest {
    id: string;
    type: string; // Dynamic service type from database
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    assignedAt?: string;
    assignedMistriId?: string;
    unpaid?: boolean;
}

type SortOrder = 'newest' | 'oldest';

export default function MyRequests() {
    const router = useRouter();
    const { data: requests = [], isLoading, error } = useCustomerRequestsQuery();
    const { cancelSearch, requestId: globalRequestId } = useSearch();
    const queryClient = useQueryClient();
    const { activeServices, getServiceColor, getServiceIcon, getServiceByName } = useServices();
    const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
    const filterType = useUIStore((state: any) => state.filterType);
    const sortOrder = useUIStore((state: any) => state.sortOrder);
    const showFilters = useUIStore((state: any) => state.showFilters);
    const setFilterType = useUIStore((state: any) => state.setFilterType);
    const setSortOrder = useUIStore((state: any) => state.setSortOrder);
    const toggleFilters = useUIStore((state: any) => state.toggleFilters);

    const handleScrollBeginDrag = () => {
        if (showFilters) {
            toggleFilters();
        }
    };

    // React Query handles fetching & refetch-on-focus

    const filteredAndSortedRequests = useMemo(() => {
        let filtered = requests;

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(req => req.type === filterType);
        }

        // Sort by date
        filtered = [...filtered].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return filtered;
    }, [requests, filterType, sortOrder]);

    const handleCancel = async (id: string) => {
        if (cancellingIds.has(id)) return;
        setCancellingIds(prev => new Set(prev).add(id));
        try {
            const token = await SecureStore.getItemAsync('token');
            await fetch(`${API_URL}/api/service-requests/${id}/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            // Update React Query cache
            queryClient.setQueryData<ServiceRequest[]>(['customerRequests'], old =>
                old?.map(req => req.id === id ? { ...req, status: 'canceled' } : req) || []
            );
            if (id === globalRequestId) {
                cancelSearch();
            }
        } catch {
            // ignore or show toast
        } finally {
            setCancellingIds(prev => { const newSet = new Set(prev); newSet.delete(id); return newSet; });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'assigned': return '#3b82f6';
            case 'completed': return '#22c55e';
            case 'canceled': return '#ef4444';
            default: return '#6b7280';
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

    const handleRequestPress = (request: ServiceRequest) => {
        router.push({
            pathname: '/requests/[id]',
            params: { id: request.id },
        });
    };

    const renderRequestItem = ({ item }: { item: ServiceRequest }) => (
        <TouchableOpacity
            style={styles.requestCard}
            onPress={() => handleRequestPress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.requestHeader}>
                <View style={styles.serviceInfo}>
                    <Ionicons
                        name={getServiceIcon(item.type, true)}
                        size={24}
                        color={getServiceColor(item.type)}
                    />
                    <Text style={styles.requestType}>
                        {getServiceByName(item.type)?.displayName ||
                            item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </Text>
                </View>
                <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) }
                ]}>
                    <Text style={styles.statusText}>
                        {item.status.toUpperCase()}
                    </Text>
                </View>
            </View>
            <Text style={styles.address}>{item.address}</Text>
            <View style={styles.timestampContainer}>
                <Text style={styles.date}>Created: {formatDate(item.createdAt)}</Text>
                {item.status === 'assigned' && item.assignedAt && (
                    <View style={styles.acceptedInfo}>
                        <MaterialIcons name="check-circle" size={14} color="#059669" />
                        <Text style={styles.acceptedText}>
                            Accepted {formatDate(item.assignedAt)}
                        </Text>
                    </View>
                )}
                {item.unpaid && (
                    <View style={styles.unpaidInfo}>
                        <MaterialIcons name="warning" size={14} color="#dc2626" />
                        <Text style={styles.unpaidText}>Payment Pending</Text>
                    </View>
                )}
            </View>
            {item.status === 'pending' && (
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleCancel(item.id);
                    }}
                    disabled={cancellingIds.has(item.id)}
                >
                    {cancellingIds.has(item.id) ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                        <>
                            <MaterialIcons name="cancel" size={20} color="#ef4444" />
                            <Text style={styles.cancelText}>Cancel</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
            {item.status === 'assigned' && (
                <View style={styles.viewDetailsHint}>
                    <Text style={styles.viewDetailsText}>Tap to view mistri details</Text>
                    <MaterialIcons name="arrow-forward-ios" size={14} color="#2563eb" />
                </View>
            )}
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="My Requests"
                    subtitle="View and manage all your service requests"
                />
                <View style={styles.loading}>
                    <ActivityIndicator size="small" />
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

            {/* Filters */}
            <View style={styles.filtersHeader}>
                <TouchableOpacity
                    style={styles.filtersToggle}
                    onPress={() => toggleFilters()}
                >
                    <View style={styles.filtersToggleContent}>
                        <Ionicons
                            name="filter-outline"
                            size={20}
                            color="#6b7280"
                        />
                        <Text style={styles.filtersToggleText}>Filters & Sort</Text>
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
                        <Text style={styles.filterTitle}>Service Type</Text>
                        <View style={styles.filterButtons}>
                            {renderFilterButton('all', 'All')}
                            {activeServices.map(service => (
                                <React.Fragment key={service.id}>
                                    {renderFilterButton(
                                        service.serviceName.toLowerCase(),
                                        service.displayName
                                    )}
                                </React.Fragment>
                            ))}
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

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error.message}</Text>
                </View>
            )}

            {filteredAndSortedRequests.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>No requests found</Text>
                    <Text style={styles.emptySubtext}>
                        {filterType !== 'all' ? `No ${filterType} requests` : 'You haven\'t made any service requests yet'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredAndSortedRequests}
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
    filtersHeader: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    filtersToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    filtersToggleText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginLeft: 8,
    },
    filtersToggleContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filtersContainer: {
        backgroundColor: '#f9fafb',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    filterSection: {
        marginBottom: 16,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#ffffff',
    },
    filterButtonActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    filterButtonText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '500',
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
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d1d5db',
        backgroundColor: '#ffffff',
    },
    sortButtonActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    sortButtonText: {
        color: '#6b7280',
        fontSize: 14,
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: '#ffffff',
    },
    errorContainer: {
        margin: 20,
        padding: 12,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 14,
        textAlign: 'center',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
        textAlign: 'center',
    },
    listContainer: {
        padding: 20,
    },
    requestCard: {
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    requestType: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 12,
    },
    address: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
        lineHeight: 20,
    },
    date: {
        fontSize: 12,
        color: '#9ca3af',
    },
    timestampContainer: {
        marginBottom: 12,
    },
    acceptedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    acceptedText: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '500',
    },
    unpaidInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    unpaidText: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
    },
    viewDetailsHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 4,
    },
    viewDetailsText: {
        fontSize: 13,
        color: '#2563eb',
        fontWeight: '500',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    cancelText: {
        color: '#ef4444',
        marginLeft: 4,
        fontWeight: '500',
        fontSize: 14,
    },
});

