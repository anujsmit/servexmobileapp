// app/(protected)/(customer)/orders/[id].tsx

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
// TYPES
// ============================================

interface OrderItem {
    id: string;
    name: string;
    price: string;
    quantity: number;
    imageUrl: string | null;
    description: string | null;
}

interface OrderDetails {
    id: string;
    items: OrderItem[];
    subtotal: string;
    tax: string;
    discount: string;
    total: string;
    status: 'pending' | 'confirmed' | 'processing' | 'assigned' | 'started' | 'completed' | 'cancelled' | 'canceled';
    address: string;
    city: string;
    zipCode: string;
    customerNotes: string | null;
    createdAt: string;
    updatedAt: string;
    paymentMethod: 'cash' | 'card' | 'online';
    paymentStatus: 'pending' | 'paid' | 'failed';
    transactionId: string | null;
}

interface MistriInfo {
    id: string;
    fullName: string;
    phoneNumber: string;
    profilePhotoUrl: string | null;
    averageRating: string;
    jobsCompleted: number;
}

// ============================================
// HELPERS
// ============================================

const getStatusDetails = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
        'pending': { label: 'Pending', color: '#F59E0B', icon: 'hourglass-empty' },
        'confirmed': { label: 'Confirmed', color: '#3B82F6', icon: 'check-circle' },
        'processing': { label: 'Processing', color: '#8B5CF6', icon: 'construct' },
        'assigned': { label: 'Assigned', color: '#3B82F6', icon: 'person' },
        'started': { label: 'In Progress', color: '#8B5CF6', icon: 'build' },
        'completed': { label: 'Completed', color: '#10B981', icon: 'done-all' },
        'cancelled': { label: 'Cancelled', color: '#EF4444', icon: 'cancel' },
        'canceled': { label: 'Cancelled', color: '#EF4444', icon: 'cancel' },
    };
    return statusMap[status] || { label: status || 'Unknown', color: '#6B7280', icon: 'help' };
};

const formatPrice = (price: string | number): string => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num)) return 'Rs. 0';
    return `Rs. ${num.toLocaleString('en-IN')}`;
};

const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
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
            <View key={i} style={{ width: 6, height: 1, backgroundColor: '#D1D5DB', marginRight: 4 }} />
        ))}
    </View>
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function OrderDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { token, refreshAccessToken, logout } = useAuth();
    const router = useRouter();

    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [mistri, setMistri] = useState<MistriInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

    // Fetch order details
    useEffect(() => {
        if (id) {
            fetchOrderDetails();
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

    const fetchOrderDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `${API_BASE}/api/users/orders/${id}`;
            console.log('📡 Fetching order from:', url);

            const response = await makeAuthenticatedRequest(url);
            const data = await response.json();

            if (response.ok && data.success) {
                setOrder(data.order);
                if (data.assignedMistri) {
                    setMistri(data.assignedMistri);
                }
            } else {
                setError(data.message || 'Failed to load order details');
            }
        } catch (error: any) {
            console.error('Error fetching order:', error);
            setError(error.message || 'Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!order) return;

        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order? This action cannot be undone.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setCancelling(true);
                        try {
                            const url = `${API_BASE}/api/users/orders/${order.id}/cancel`;
                            const response = await makeAuthenticatedRequest(url, {
                                method: 'POST',
                            });

                            const data = await response.json();
                            if (response.ok && data.success) {
                                Alert.alert('Cancelled', 'Your order has been cancelled.');
                                await fetchOrderDetails();
                            } else {
                                Alert.alert('Error', data.message || 'Failed to cancel order');
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to cancel order');
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

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrderDetails();
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
        if (!order) return null;
        const statusInfo = getStatusDetails(order.status);

        return (
            <View style={[styles.statusPill, { backgroundColor: statusInfo.color }]}>
                <MaterialIcons name={statusInfo.icon as any} size={14} color="#FFFFFF" />
                <Text style={styles.statusPillText}>{statusInfo.label}</Text>
                {order.status === 'pending' && (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 4 }} />
                )}
            </View>
        );
    };

    const renderOrderItems = () => {
        if (!order) return null;

        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.blockTitle}>Order Items</Text>
                <View style={styles.itemsList}>
                    {order.items.map((item, index) => (
                        <View key={item.id} style={[styles.itemGroup, index > 0 && styles.itemGroupBorder]}>
                            <View style={styles.itemRow}>
                                <View style={styles.itemImageContainer}>
                                    {item.imageUrl ? (
                                        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                                    ) : (
                                        <View style={styles.itemImagePlaceholder}>
                                            <Text style={styles.itemImageInitials}>
                                                {getInitials(item.name)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName} numberOfLines={1}>
                                        {item.name}
                                    </Text>
                                    {item.description && (
                                        <Text style={styles.itemDescription} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                    )}
                                    <View style={styles.itemMetaRow}>
                                        <Text style={styles.itemQuantity}>×{item.quantity}</Text>
                                        <View style={styles.itemLeader} />
                                        <Text style={styles.itemPrice}>
                                            {formatPrice(parseFloat(item.price) * item.quantity)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                <DashedLine style={{ marginVertical: 10 }} />

                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>VAT</Text>
                    <Text style={styles.summaryValue}>{formatPrice(order.tax)}</Text>
                </View>
                {parseFloat(order.discount) > 0 && (
                    <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: '#10B981' }]}>
                            <Ionicons name="pricetag" size={14} color="#10B981" /> Discount
                        </Text>
                        <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                            -{formatPrice(order.discount)}
                        </Text>
                    </View>
                )}

                <DashedLine style={{ marginVertical: 10 }} />

                <View style={styles.totalRowReceipt}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalPrice}>{formatPrice(order.total)}</Text>
                </View>
            </View>
        );
    };

    const renderMistri = () => {
        if (!mistri) return null;

        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.blockTitle}>Assigned Professional</Text>
                <View style={styles.mistriRow}>
                    {mistri.profilePhotoUrl ? (
                        <Image source={{ uri: mistri.profilePhotoUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitials}>{getInitials(mistri.fullName)}</Text>
                        </View>
                    )}
                    <View style={styles.mistriInfo}>
                        <Text style={styles.mistriName}>{mistri.fullName}</Text>
                        <View style={styles.mistriMeta}>
                            <View style={styles.ratingContainer}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={styles.ratingText}>
                                    {parseFloat(mistri.averageRating).toFixed(1) || 'New'}
                                </Text>
                            </View>
                            <Text style={styles.metaDivider}>-</Text>
                            <Text style={styles.metaText}>{mistri.jobsCompleted || 0} jobs</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.callIcon} onPress={handleCallMistri}>
                        <Ionicons name="call" size={20} color="#10B981" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderAddress = () => {
        if (!order) return null;

        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.blockTitle}>Delivery Address</Text>
                <Text style={styles.blockText}>{order.address}</Text>
                <View style={styles.addressDetailRow}>
                    <Text style={styles.addressDetail}>
                        <Text style={styles.addressDetailLabel}>City: </Text>
                        {order.city}
                    </Text>
                    <Text style={styles.addressDetail}>
                        <Text style={styles.addressDetailLabel}>ZIP: </Text>
                        {order.zipCode}
                    </Text>
                </View>
                {order.customerNotes && (
                    <View style={styles.notesContainer}>
                        <Text style={styles.notesLabel}>Notes:</Text>
                        <Text style={styles.notesText}>{order.customerNotes}</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderPayment = () => {
        if (!order) return null;

        const paymentColors: Record<string, string> = {
            'cash': '#10B981',
            'card': '#3B82F6',
            'online': '#8B5CF6',
        };

        const paymentLabels: Record<string, string> = {
            'cash': 'Cash on Delivery',
            'card': 'Card Payment',
            'online': 'Online Payment',
        };

        const paymentIcons: Record<string, string> = {
            'cash': 'cash-outline',
            'card': 'card-outline',
            'online': 'phone-portrait-outline',
        };

        const statusColors: Record<string, string> = {
            'pending': '#F59E0B',
            'paid': '#10B981',
            'failed': '#EF4444',
        };

        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.blockTitle}>Payment Details</Text>
                <View style={styles.paymentRow}>
                    <View style={styles.paymentMethod}>
                        <View style={[styles.paymentIcon, { backgroundColor: (paymentColors[order.paymentMethod] || '#6B7280') + '15' }]}>
                            <Ionicons
                                name={paymentIcons[order.paymentMethod] as any || 'card-outline'}
                                size={20}
                                color={paymentColors[order.paymentMethod] || '#6B7280'}
                            />
                        </View>
                        <View>
                            <Text style={styles.paymentMethodLabel}>Method</Text>
                            <Text style={styles.paymentMethodValue}>
                                {paymentLabels[order.paymentMethod] || order.paymentMethod}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.paymentStatus}>
                        <View style={[styles.paymentStatusDot, { backgroundColor: statusColors[order.paymentStatus] || '#6B7280' }]} />
                        <Text style={styles.paymentStatusText}>
                            {order.paymentStatus?.charAt(0).toUpperCase() + order.paymentStatus?.slice(1) || 'Pending'}
                        </Text>
                    </View>
                </View>
                {order.transactionId && (
                    <Text style={styles.transactionId}>Transaction: {order.transactionId}</Text>
                )}
            </View>
        );
    };

    const renderTimeline = () => {
        if (!order) return null;

        const events = [
            { label: 'Order Placed', timestamp: order.createdAt, completed: true },
            { label: 'Confirmed', timestamp: order.updatedAt, completed: order.status !== 'pending' && order.status !== 'cancelled' && order.status !== 'canceled' },
            { label: 'Completed', timestamp: null, completed: order.status === 'completed' },
        ];

        return (
            <View style={styles.sectionBlock}>
                <Text style={styles.blockTitle}>Timeline</Text>
                <View style={styles.timelineList}>
                    {events.map((event) => (
                        <View key={event.label} style={styles.timelineRow}>
                            <Text style={styles.timelineLabel}>{event.label}</Text>
                            <Text style={styles.timelineValue}>
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
                    title="Order Details"
                    leftElement={
                        <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Loading order details...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    if (error || !order) {
        return (
            <SafeAreaContainer>
                <PageTitle
                    title="Order Details"
                    leftElement={
                        <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                    }
                />
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="error-outline" size={48} color="#EF4444" />
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
                        <Ionicons name="refresh" size={20} color="#fff" />
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.goBackButton} onPress={goBack}>
                        <Text style={styles.goBackButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaContainer>
        );
    }

    const isPending = order.status === 'pending' || order.status === 'confirmed';
    const shortOrderId = order.id.slice(-8).toUpperCase();

    return (
        <SafeAreaContainer>
            <PageTitle
                title="Order Details"
                leftElement={
                    <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                }
            />

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#3B82F6']}
                    />
                }
            >
                <View style={styles.receiptCard}>
                    {/* Perforated Top Edge */}
                    <View style={styles.perforatedEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>

                    <View style={styles.receiptHeader}>
                        <View style={styles.receiptBrand}>
                            <Image
                                source={require('../../../../assets/images/logo.png')}
                                style={styles.receiptLogo}
                            />
                            <View>
                                <Text style={styles.receiptTitle}>ServeX</Text>
                                <Text style={styles.receiptSubtitle}>Order Receipt</Text>
                            </View>
                        </View>
                        {renderStatusPill()}
                    </View>

                    <DashedLine style={{ marginBottom: 10 }} />

                    <View style={styles.metaGrid}>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Order ID</Text>
                            <Text style={styles.metaValue}>#{shortOrderId}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Ordered</Text>
                            <Text style={styles.metaValue}>{formatDateTime(order.createdAt)}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Payment</Text>
                            <Text style={styles.metaValue}>
                                {order.paymentMethod?.charAt(0).toUpperCase() + order.paymentMethod?.slice(1) || 'N/A'}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Items</Text>
                            <Text style={styles.metaValue}>{order.items.length}</Text>
                        </View>
                    </View>

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Order Items */}
                    {renderOrderItems()}

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Address */}
                    {renderAddress()}

                    <DashedLine style={{ marginVertical: 10 }} />

                    {/* Payment */}
                    {renderPayment()}

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
                    <View style={styles.perforatedBottomEdge}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <View key={i} style={styles.perforation} />
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Action Buttons */}
            <View style={styles.stickyActions}>
                {isPending && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.cancelActionButton, cancelling && styles.actionButtonDisabled]}
                        onPress={handleCancelOrder}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                            <>
                                <Ionicons name="close-circle" size={20} color="#DC2626" />
                                <Text style={styles.cancelActionText}>Cancel Order</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
                {order.status === 'assigned' && mistri && (
                    <TouchableOpacity style={styles.actionButton} onPress={handleCallMistri}>
                        <Ionicons name="call" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Call Mistri</Text>
                    </TouchableOpacity>
                )}
                {order.status === 'completed' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.homeActionButton]}
                        onPress={goToDashboard}
                    >
                        <Ionicons name="home" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Back to Home</Text>
                    </TouchableOpacity>
                )}
                {!isPending && order.status !== 'completed' && order.status !== 'assigned' && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.homeActionButton]}
                        onPress={goToDashboard}
                    >
                        <Ionicons name="home" size={20} color="#FFFFFF" />
                        <Text style={styles.actionText}>Back to Home</Text>
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
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 12,
    },
    errorText: {
        fontSize: 14,
        color: '#6B7280',
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
        backgroundColor: '#3B82F6',
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
        color: '#6B7280',
        fontWeight: '500',
        fontSize: 16,
    },
    content: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    contentContainer: {
        padding: 12,
    },
    receiptCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 0,
        padding: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
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
        backgroundColor: '#FFFFFF',
    },
    perforation: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F3F4F6',
        borderWidth: 0.5,
        borderColor: '#D1D5DB',
    },
    perforatedBottomEdge: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        position: 'absolute',
        bottom: -1,
        left: 0,
        right: 0,
        height: 8,
        backgroundColor: '#FFFFFF',
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
        color: '#111827',
    },
    receiptSubtitle: {
        fontSize: 11,
        color: '#6B7280',
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
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        letterSpacing: 0.3,
    },
    sectionBlock: {
        marginBottom: 8,
    },
    blockTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    blockText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 19,
        fontWeight: '500',
    },
    // Items
    itemsList: {
        marginTop: 2,
    },
    itemGroup: {
        paddingVertical: 6,
    },
    itemGroupBorder: {
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    itemImageContainer: {
        width: 44,
        height: 44,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
        flexShrink: 0,
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    itemImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E5E7EB',
    },
    itemImageInitials: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9CA3AF',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    itemDescription: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 1,
    },
    itemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    itemQuantity: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    itemLeader: {
        flex: 1,
        height: 1,
        backgroundColor: '#D1D5DB',
        marginHorizontal: 8,
        alignSelf: 'center',
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    // Summary
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 3,
    },
    summaryLabel: {
        fontSize: 13,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '500',
        color: '#111827',
    },
    totalRowReceipt: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 0,
        paddingTop: 0,
    },
    totalLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    totalPrice: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: 0.5,
    },
    // Address
    addressDetailRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    addressDetail: {
        fontSize: 12,
        color: '#6B7280',
    },
    addressDetailLabel: {
        color: '#9CA3AF',
    },
    notesContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    notesLabel: {
        fontSize: 11,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    notesText: {
        fontSize: 13,
        color: '#374151',
        marginTop: 2,
        lineHeight: 18,
    },
    // Payment
    paymentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    paymentIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentMethodLabel: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    paymentMethodValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    paymentStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    paymentStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    paymentStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
    },
    transactionId: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 6,
        fontFamily: 'monospace',
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
        color: '#111827',
        letterSpacing: 0.3,
    },
    timelineValue: {
        fontSize: 11,
        color: '#6B7280',
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
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    mistriInfo: {
        flex: 1,
    },
    mistriName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
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
        color: '#6B7280',
    },
    metaDivider: {
        marginHorizontal: 6,
        fontSize: 12,
        color: '#9CA3AF',
    },
    metaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    callIcon: {
        padding: 8,
        borderRadius: 0,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#D1FAE5',
    },
    // Sticky Actions
    stickyActions: {
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
        borderColor: '#DC2626',
    },
    homeActionButton: {
        backgroundColor: '#3B82F6',
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
        color: '#DC2626',
        fontSize: 15,
        fontWeight: '600',
    },
});