// app/(protected)/(customer)/cart.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    Platform,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCartQuery, useUpdateCartItem, useRemoveFromCart, useClearCart } from '../../../hooks/cart';

const { width } = Dimensions.get('window');

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
};

// ============================================
// TYPES
// ============================================

interface CartItem {
    id: string;
    serviceItemId?: string;
    subCategoryId: string;
    name: string;
    description: string | null;
    price: string;
    durationMinutes: number | null;
    isActive: boolean;
    isPopular: boolean;
    imageUrl: string | null;
    displayOrder: number;
    quantity: number;
    subtotal?: number;
    categoryName?: string;
}

// ============================================
// CONSTANTS
// ============================================

const VAT_RATE = 0.13; // 13% VAT

// ============================================
// HELPER FUNCTIONS
// ============================================

const getInitials = (name: string): string => {
    if (!name) return 'SR';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

const formatPrice = (price: number): string => {
    if (price === 0) return 'Free';
    return `रु ${price.toLocaleString('en-IN')}`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartScreen() {
    const router = useRouter();
    const navigation = useNavigation();

    const {
        data: cartData,
        isLoading,
        refetch,
        isRefetching
    } = useCartQuery();

    const { mutateAsync: updateCartItem } = useUpdateCartItem();
    const { mutateAsync: removeFromCart } = useRemoveFromCart();
    const { mutateAsync: clearCart } = useClearCart();

    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [subtotal, setSubtotal] = useState(0);
    const [vat, setVat] = useState(0);
    const [serviceCharge, setServiceCharge] = useState(150);
    const [serviceChargeDiscount, setServiceChargeDiscount] = useState(150);
    const [total, setTotal] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [discount, setDiscount] = useState(0);
    const [isPromoApplied, setIsPromoApplied] = useState(false);
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

    useEffect(() => {
        if (cartData?.items) {
            setCartItems(cartData.items.map((item: CartItem) => ({
                ...item,
                price: String(item.price || 0),
            })));
        } else if (cartData) {
            setCartItems([]);
        }
    }, [cartData]);

    // Calculate totals with VAT
    useEffect(() => {
        const subtotalAmount = cartItems.reduce(
            (sum, item) => sum + parseFloat(item.price || '0') * item.quantity,
            0
        );
        const discountAmount = isPromoApplied ? subtotalAmount * 0.1 : 0;
        const netServiceCharge = serviceCharge - serviceChargeDiscount;
        const vatAmount = (subtotalAmount - discountAmount + netServiceCharge) * VAT_RATE;
        const totalAmount = subtotalAmount + netServiceCharge + vatAmount - discountAmount;

        setSubtotal(subtotalAmount);
        setVat(vatAmount);
        setDiscount(discountAmount);
        setTotal(totalAmount);
    }, [cartItems, isPromoApplied, serviceCharge, serviceChargeDiscount]);

    const totalItemCount = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
        [cartItems]
    );

    const handleClearCart = useCallback(async () => {
        if (cartItems.length === 0) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            'Clear Cart',
            'Remove all items from your cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        try {
                            await clearCart();
                            await refetch();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear cart. Please try again.');
                        }
                    },
                },
            ]
        );
    }, [cartItems.length, clearCart, refetch]);

    useEffect(() => {
        navigation.setOptions({
            title: '',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: THEME.white },
            headerTransparent: true,
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <View style={styles.backButtonInner}>
                        <Ionicons name="arrow-back" size={22} color={THEME.text} />
                    </View>
                </TouchableOpacity>
            ),
            headerRight: () => (
                cartItems.length > 0 && (
                    <TouchableOpacity
                        onPress={handleClearCart}
                        style={styles.headerRightButton}
                        activeOpacity={0.7}
                    >
                        <Feather name="trash-2" size={20} color={THEME.error} />
                    </TouchableOpacity>
                )
            ),
        });
    }, [navigation, router, cartItems.length, handleClearCart]);

    const handleUpdateQuantity = useCallback(async (itemId: string, newQuantity: number) => {
        if (updatingItemId === itemId) return;

        const itemIndex = cartItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        if (newQuantity < 0) return;

        if (newQuantity === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
                setUpdatingItemId(itemId);
                const updatedItems = cartItems.filter(item => item.id !== itemId);
                setCartItems(updatedItems);
                await removeFromCart(itemId);
                await refetch();
            } catch (error) {
                await refetch();
                Alert.alert('Error', 'Failed to remove item. Please try again.');
            } finally {
                setUpdatingItemId(null);
            }
            return;
        }

        try {
            setUpdatingItemId(itemId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const updatedItems = [...cartItems];
            updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                quantity: newQuantity
            };
            setCartItems(updatedItems);

            await updateCartItem({ itemId, quantity: newQuantity });
            await refetch();
        } catch (error) {
            await refetch();
            Alert.alert('Error', 'Failed to update cart. Please try again.');
        } finally {
            setUpdatingItemId(null);
        }
    }, [cartItems, updateCartItem, removeFromCart, refetch, updatingItemId]);

    const handleRemoveItem = useCallback((itemId: string, itemName: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Remove Item',
            `Remove "${itemName}" from your cart?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        try {
                            setCartItems(prev => prev.filter(item => item.id !== itemId));
                            await removeFromCart(itemId);
                            await refetch();
                        } catch (error) {
                            await refetch();
                            Alert.alert('Error', 'Failed to remove item. Please try again.');
                        }
                    },
                },
            ]
        );
    }, [removeFromCart, refetch]);

    const applyPromoCode = useCallback(() => {
        if (promoCode.trim().toUpperCase() === 'SAVE10') {
            setIsPromoApplied(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Promo code applied! 10% discount.');
            setPromoCode('');
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Invalid Code', 'Please enter a valid promo code.');
        }
    }, [promoCode]);

    const handleCheckout = useCallback(() => {
        if (cartItems.length === 0) {
            Alert.alert('Cart is Empty', 'Add some services to your cart first.');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const checkoutItems = cartItems.map(item => ({
            id: item.serviceItemId || item.id,
            name: item.name,
            price: parseFloat(item.price || '0'),
            quantity: item.quantity,
            description: item.description,
            imageUrl: item.imageUrl,
            durationMinutes: item.durationMinutes,
        }));

        router.push({
            pathname: '/checkout',
            params: {
                items: JSON.stringify(checkoutItems),
                subtotal: subtotal.toString(),
                vat: vat.toString(),
                serviceCharge: serviceCharge.toString(),
                serviceChargeDiscount: serviceChargeDiscount.toString(),
                discount: discount.toString(),
                total: total.toString(),
            },
        });
    }, [cartItems, subtotal, vat, serviceCharge, serviceChargeDiscount, discount, total, router]);

    const renderCartItem = useCallback((item: CartItem, index: number) => {
        const initials = getInitials(item.name);
        const isUpdating = updatingItemId === item.id;
        const itemPrice = parseFloat(item.price || '0');
        const totalItemPrice = itemPrice * item.quantity;

        return (
            <View key={`${item.id}-${index}`} style={styles.cartItemWrapper}>
                <View style={styles.cartItemCard}>
                    <View style={styles.itemImageContainer}>
                        {item.imageUrl ? (
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.itemImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <LinearGradient
                                colors={['#f1f5f9', '#e2e8f0']}
                                style={styles.itemImagePlaceholder}
                            >
                                <Text style={styles.itemInitials}>{initials}</Text>
                            </LinearGradient>
                        )}
                        {item.isPopular && (
                            <View style={[styles.popularBadge, { backgroundColor: THEME.primary }]}>
                                <MaterialIcons name="star" size={10} color="#fff" />
                            </View>
                        )}
                    </View>

                    <View style={styles.itemInfo}>
                        <View style={styles.itemHeader}>
                            <Text style={[styles.itemName, { color: THEME.text }]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={[styles.itemPrice, { color: THEME.primary }]}>
                                {formatPrice(totalItemPrice)}
                            </Text>
                        </View>

                        {item.description && (
                            <Text style={[styles.itemDescription, { color: THEME.textSecondary }]} numberOfLines={1}>
                                {item.description}
                            </Text>
                        )}

                        <View style={styles.itemActions}>
                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    style={[styles.quantityButton, styles.quantityMinus]}
                                    onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                    activeOpacity={0.7}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? (
                                        <ActivityIndicator size="small" color={THEME.textTertiary} />
                                    ) : (
                                        <Ionicons name="remove" size={16} color={THEME.textTertiary} />
                                    )}
                                </TouchableOpacity>
                                <Text style={[styles.quantityText, { color: THEME.text }]}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={[styles.quantityButton, styles.quantityPlus, { backgroundColor: THEME.primary }]}
                                    onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                    activeOpacity={0.7}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Ionicons name="add" size={16} color="#ffffff" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveItem(item.id, item.name)}
                                activeOpacity={0.7}
                                disabled={isUpdating}
                            >
                                <Feather name="trash-2" size={16} color={THEME.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    }, [handleUpdateQuantity, handleRemoveItem, updatingItemId]);

    const renderEmptyState = useCallback(() => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
                <LinearGradient
                    colors={[THEME.primary + '10', THEME.primary + '05']}
                    style={styles.emptyIconGradient}
                >
                    <Ionicons name="cart-outline" size={72} color={THEME.primary} />
                </LinearGradient>
            </View>
            <Text style={[styles.emptyTitle, { color: THEME.text }]}>Your cart is empty</Text>
            <Text style={[styles.emptySubtitle, { color: THEME.textSecondary }]}>
                Browse our services and add your favorites
            </Text>
            <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(protected)/(customer)/services')}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[THEME.gradientStart, THEME.gradientEnd]}
                    style={styles.browseGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Feather name="arrow-left" size={18} color="#fff" />
                    <Text style={[styles.browseButtonText, { color: THEME.textInverse }]}>Browse Services</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    ), [router]);

    const renderBill = useCallback(() => (
        <View style={[styles.billContainer, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
            {/* Bill Header */}
            <View style={styles.billHeader}>
                <View style={styles.billLogoContainer}>
                    <View style={[styles.billLogo, { backgroundColor: THEME.primary }]}>
                        <Text style={styles.billLogoText}>S</Text>
                    </View>
                    <View>
                        <Text style={[styles.billTitle, { color: THEME.text }]}>ServeX</Text>
                        <Text style={[styles.billSubtitle, { color: THEME.textTertiary }]}>Order Summary</Text>
                    </View>
                </View>
                <View style={[styles.billBadge, { backgroundColor: THEME.successBg }]}>
                    <Text style={[styles.billBadgeText, { color: THEME.success }]}>
                        {totalItemCount} items
                    </Text>
                </View>
            </View>

            <View style={styles.billDividerLine} />

            {/* Bill Items */}
            <View style={styles.billItems}>
                {cartItems.map((item, index) => {
                    const itemPrice = parseFloat(item.price || '0');
                    const totalItemPrice = itemPrice * item.quantity;
                    return (
                        <View key={item.id} style={[styles.billItem, index > 0 && styles.billItemBorder]}>
                            <View style={styles.billItemHeader}>
                                <Text style={[styles.billItemName, { color: THEME.text }]} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={[styles.billItemPrice, { color: THEME.primary }]}>
                                    {formatPrice(totalItemPrice)}
                                </Text>
                            </View>
                            <View style={styles.billItemDetails}>
                                <Text style={[styles.billItemQty, { color: THEME.textTertiary }]}>
                                    Qty: {item.quantity}
                                </Text>
                                {item.categoryName && (
                                    <Text style={[styles.billItemCategory, { color: THEME.textTertiary }]}>
                                        {item.categoryName}
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>

            <View style={styles.billDividerLine} />

            {/* Bill Totals with VAT */}
            <View style={styles.billTotals}>
                <View style={styles.billTotalRow}>
                    <Text style={[styles.billTotalLabel, { color: THEME.textSecondary }]}>Subtotal</Text>
                    <Text style={[styles.billTotalValue, { color: THEME.text }]}>{formatPrice(subtotal)}</Text>
                </View>
                <View style={styles.billTotalRow}>
                    <Text style={[styles.billTotalLabel, { color: THEME.textSecondary }]}>
                        VAT ({Math.round(VAT_RATE * 100)}%)
                    </Text>
                    <Text style={[styles.billTotalValue, { color: THEME.text }]}>
                        {formatPrice(vat)}
                    </Text>
                </View>
                <View style={styles.billTotalRow}>
                    <Text style={[styles.billTotalLabel, { color: THEME.textSecondary }]}>Service Fee</Text>
                    <Text style={[styles.billTotalValue, { color: THEME.text }]}>
                        {formatPrice(serviceCharge - serviceChargeDiscount)}
                    </Text>
                </View>

                {isPromoApplied && (
                    <View style={styles.billTotalRow}>
                        <Text style={[styles.billTotalLabel, { color: THEME.success }]}>
                            <Ionicons name="pricetag" size={14} color={THEME.success} /> Discount
                        </Text>
                        <Text style={[styles.billTotalValue, { color: THEME.success }]}>
                            -{formatPrice(discount)}
                        </Text>
                    </View>
                )}

                <View style={styles.billDivider} />

                <View style={[styles.billTotalRow, styles.billGrandTotal]}>
                    <Text style={[styles.billGrandTotalLabel, { color: THEME.text }]}>Total Amount</Text>
                    <Text style={[styles.billGrandTotalValue, { color: THEME.primary }]}>
                        {formatPrice(total)}
                    </Text>
                </View>
            </View>

            <View style={styles.billDividerLine} />

            {/* Bill Footer */}
            <View style={styles.billFooter}>
                <View style={styles.billPaymentInfo}>
                    <Ionicons name="shield-checkmark" size={16} color={THEME.success} />
                    <Text style={[styles.billPaymentText, { color: THEME.textTertiary }]}>
                        Secure checkout • 100% protected
                    </Text>
                </View>
                <Text style={[styles.billThankYou, { color: THEME.textTertiary }]}>
                    Thank you for choosing ServeX
                </Text>
            </View>
        </View>
    ), [cartItems, subtotal, vat, serviceCharge, serviceChargeDiscount, isPromoApplied, discount, total, totalItemCount]);

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: THEME.background }]} edges={['bottom']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={THEME.primary} />
                    <Text style={[styles.loadingText, { color: THEME.textSecondary }]}>Loading your cart...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: THEME.background }]} edges={['bottom']}>
            <View style={[styles.container, { backgroundColor: THEME.background }]}>
                {cartItems.length > 0 ? (
                    <>
                        <View style={styles.headerContent}>
                            <Text style={[styles.headerTitle, { color: THEME.text }]}>Your Cart</Text>
                            <Text style={[styles.headerSubtitle, { color: THEME.textSecondary }]}>
                                {cartItems.length} {cartItems.length === 1 ? 'service' : 'services'} selected
                            </Text>
                            {isRefetching && (
                                <ActivityIndicator size="small" color={THEME.primary} style={styles.refetchIndicator} />
                            )}
                        </View>

                        <ScrollView
                            style={styles.scrollView}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isRefetching}
                                    onRefresh={refetch}
                                    colors={[THEME.primary]}
                                    tintColor={THEME.primary}
                                />
                            }
                        >
                            <View style={styles.cartList}>
                                {cartItems.map((item, index) => renderCartItem(item, index))}
                            </View>

                            {/* Promo Code */}
                            <View style={styles.promoContainer}>
                                <View style={[styles.promoCard, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                                    <Ionicons name="ticket-outline" size={18} color={THEME.primary} />
                                    <TextInput
                                        style={[styles.promoInput, { color: THEME.text }]}
                                        placeholder="Enter promo code"
                                        placeholderTextColor={THEME.textTertiary}
                                        value={promoCode}
                                        onChangeText={setPromoCode}
                                        editable={!isPromoApplied}
                                        autoCapitalize="characters"
                                    />
                                    {isPromoApplied ? (
                                        <View style={[styles.promoAppliedBadge, { backgroundColor: THEME.primaryBg }]}>
                                            <Ionicons name="checkmark-circle" size={16} color={THEME.primary} />
                                            <Text style={[styles.promoAppliedText, { color: THEME.primary }]}>Applied</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.promoApplyButton, { backgroundColor: THEME.primary }]}
                                            onPress={applyPromoCode}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.promoApplyText, { color: THEME.textInverse }]}>Apply</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Bill/Receipt */}
                            {renderBill()}

                            <View style={styles.bottomSpacer} />
                        </ScrollView>

                        {/* Floating Bottom Bar */}
                        <View style={[styles.floatingBar, { backgroundColor: THEME.white, borderTopColor: THEME.border }]}>
                            <View style={styles.floatingBarContent}>
                                <View>
                                    <Text style={[styles.floatingTotalLabel, { color: THEME.textTertiary }]}>Total</Text>
                                    <Text style={[styles.floatingTotal, { color: THEME.text }]}>{formatPrice(total)}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.floatingCheckout}
                                    onPress={handleCheckout}
                                    activeOpacity={0.8}
                                    disabled={!!updatingItemId}
                                >
                                    <LinearGradient
                                        colors={[THEME.gradientStart, THEME.gradientEnd]}
                                        style={styles.floatingCheckoutGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={[styles.floatingCheckoutText, { color: THEME.textInverse }]}>Checkout</Text>
                                        <Ionicons name="arrow-forward" size={18} color={THEME.textInverse} />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                ) : (
                    renderEmptyState()
                )}
            </View>
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    headerContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 8 : 16,
        paddingBottom: 16,
        marginTop: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    refetchIndicator: {
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    backButton: {
        marginLeft: 4,
        marginTop: Platform.OS === 'ios' ? 4 : 0,
    },
    backButtonInner: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    headerRightButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 4,
    },
    cartList: {
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 12,
    },
    cartItemWrapper: {
        borderRadius: 16,
        backgroundColor: '#ffffff',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    cartItemCard: {
        flexDirection: 'row',
        padding: 14,
        gap: 14,
        borderRadius: 16,
        backgroundColor: '#ffffff',
    },
    itemImageContainer: {
        width: 72,
        height: 72,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
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
    },
    itemInitials: {
        fontSize: 22,
        fontWeight: '700',
        color: '#94a3b8',
    },
    popularBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'space-between',
        gap: 4,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
    },
    itemDescription: {
        fontSize: 12,
        lineHeight: 16,
    },
    itemActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
    },
    quantityButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityMinus: {
        backgroundColor: 'transparent',
    },
    quantityPlus: {
        backgroundColor: THEME.primary,
    },
    quantityText: {
        fontSize: 15,
        fontWeight: '600',
        minWidth: 26,
        textAlign: 'center',
    },
    removeButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
    promoContainer: {
        paddingHorizontal: 16,
        marginTop: 16,
    },
    promoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        gap: 10,
    },
    promoInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 4,
    },
    promoApplyButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
    },
    promoApplyText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    promoAppliedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    promoAppliedText: {
        fontSize: 13,
        fontWeight: '600',
    },
    billContainer: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    billHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    billLogoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    billLogo: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    billLogoText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff',
    },
    billTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    billSubtitle: {
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    billBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    billBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    billDividerLine: {
        height: 1,
        backgroundColor: THEME.border,
        marginVertical: 12,
    },
    billItems: {
        gap: 8,
    },
    billItem: {
        paddingVertical: 6,
    },
    billItemBorder: {
        borderTopWidth: 1,
        borderTopColor: THEME.borderLight,
        paddingTop: 8,
    },
    billItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    billItemName: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    billItemPrice: {
        fontSize: 14,
        fontWeight: '700',
    },
    billItemDetails: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 2,
    },
    billItemQty: {
        fontSize: 12,
    },
    billItemCategory: {
        fontSize: 12,
    },
    billTotals: {
        gap: 4,
    },
    billTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    billTotalLabel: {
        fontSize: 13,
    },
    billTotalValue: {
        fontSize: 13,
        fontWeight: '500',
    },
    billDivider: {
        height: 1,
        backgroundColor: THEME.border,
        marginVertical: 8,
    },
    billGrandTotal: {
        paddingVertical: 4,
    },
    billGrandTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
    },
    billGrandTotalValue: {
        fontSize: 18,
        fontWeight: '800',
    },
    billFooter: {
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    billPaymentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    billPaymentText: {
        fontSize: 12,
        fontWeight: '500',
    },
    billThankYou: {
        fontSize: 11,
        fontStyle: 'italic',
    },
    bottomSpacer: {
        height: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: -40,
    },
    emptyIconWrapper: {
        marginBottom: 32,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 4,
    },
    emptyIconGradient: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    emptySubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    browseButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    browseGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 14,
        gap: 8,
    },
    browseButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    floatingBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 8,
    },
    floatingBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    floatingTotalLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    floatingTotal: {
        fontSize: 20,
        fontWeight: '700',
    },
    floatingCheckout: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    floatingCheckoutGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        gap: 6,
    },
    floatingCheckoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
});