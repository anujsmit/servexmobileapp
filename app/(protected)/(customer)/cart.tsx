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
import { MaterialIcons, Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    Layout,
    SlideInRight,
    SlideInLeft,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    withSequence,
    withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCartQuery, useUpdateCartItem, useRemoveFromCart, useClearCart } from '../../../hooks/cart';

const { width, height } = Dimensions.get('window');

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
const THEME_COLOR = '#2563eb';
const THEME_COLOR_LIGHT = '#3b82f6';

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
// ANIMATED PRICE COMPONENT
// ============================================

const AnimatedPrice = ({ 
    fromPrice, 
    toPrice, 
    duration = 1500 
}: { 
    fromPrice: number; 
    toPrice: number; 
    duration?: number;
}) => {
    const progress = useSharedValue(0);
    const [displayPrice, setDisplayPrice] = useState(fromPrice);
    
    useEffect(() => {
        // Animate from fromPrice to toPrice
        progress.value = withTiming(1, {
            duration: duration,
            easing: Easing.out(Easing.cubic),
        });
        
        // Update display price based on progress
        const interval = setInterval(() => {
            const currentProgress = progress.value;
            const currentPrice = Math.round(fromPrice - (fromPrice - toPrice) * currentProgress);
            setDisplayPrice(currentPrice);
            
            if (currentProgress >= 1) {
                clearInterval(interval);
                setDisplayPrice(toPrice);
            }
        }, 50);
        
        return () => clearInterval(interval);
    }, [fromPrice, toPrice, duration]);
    
    const textStyle = useAnimatedStyle(() => {
        const scale = 1 + (1 - progress.value) * 0.3;
        const opacity = 0.3 + progress.value * 0.7;
        
        return {
            transform: [{ scale }],
            opacity,
        };
    });
    
    const colorStyle = useAnimatedStyle(() => {
        // Transition from gray to green
        const r = Math.round(100 + (16 - 100) * progress.value);
        const g = Math.round(116 + (185 - 116) * progress.value);
        const b = Math.round(128 + (129 - 128) * progress.value);
        
        return {
            color: `rgb(${r}, ${g}, ${b})`,
        };
    });
    
    return (
        <Animated.Text style={[styles.animatedPrice, textStyle, colorStyle]}>
            {displayPrice === 0 ? 'Free' : `रु ${displayPrice}`}
        </Animated.Text>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CartScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const animationStarted = useRef(false);

    // Use React Query for cart data
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
    const [serviceCharge, setServiceCharge] = useState(150);
    const [serviceChargeDiscount, setServiceChargeDiscount] = useState(150);
    const [total, setTotal] = useState(0);
    const [promoCode, setPromoCode] = useState('');
    const [discount, setDiscount] = useState(0);
    const [isPromoApplied, setIsPromoApplied] = useState(false);
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
    const [animateServiceCharge, setAnimateServiceCharge] = useState(false);
    const [showAnimatedPrice, setShowAnimatedPrice] = useState(false);

    // Update cart items when data changes
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

    // Calculate totals whenever cart items or promo changes
    useEffect(() => {
        const subtotalAmount = cartItems.reduce(
            (sum, item) => sum + parseFloat(item.price || '0') * item.quantity,
            0
        );
        const discountAmount = isPromoApplied ? subtotalAmount * 0.1 : 0;
        const netServiceCharge = serviceCharge - serviceChargeDiscount;
        const totalAmount = subtotalAmount + netServiceCharge - discountAmount;

        setSubtotal(subtotalAmount);
        setDiscount(discountAmount);
        setTotal(totalAmount);
    }, [cartItems, isPromoApplied, serviceCharge, serviceChargeDiscount]);

    // Trigger animation when cart has items
    useEffect(() => {
        if (cartItems.length > 0 && !animationStarted.current) {
            animationStarted.current = true;
            // Start animation after a short delay
            setTimeout(() => {
                setShowAnimatedPrice(true);
                setAnimateServiceCharge(true);
            }, 500);
        }
    }, [cartItems]);

    // Memoize total item count
    const totalItemCount = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
        [cartItems]
    );

    // Handle clear cart
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
                            animationStarted.current = false;
                            setShowAnimatedPrice(false);
                            setAnimateServiceCharge(false);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear cart. Please try again.');
                        }
                    },
                },
            ]
        );
    }, [cartItems.length, clearCart, refetch]);

    // Set navigation options with proper dependencies
    useEffect(() => {
        navigation.setOptions({
            title: '',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
            headerTransparent: true,
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <View style={styles.backButtonInner}>
                        <Ionicons name="arrow-back" size={22} color="#0f172a" />
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
                        <Feather name="trash-2" size={20} color="#ef4444" />
                    </TouchableOpacity>
                )
            ),
        });
    }, [navigation, router, cartItems.length, handleClearCart]);

    const handleUpdateQuantity = useCallback(async (itemId: string, newQuantity: number) => {
        if (updatingItemId === itemId) return;
        
        // Find the item index
        const itemIndex = cartItems.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        // Don't allow negative quantities
        if (newQuantity < 0) return;
        
        // If quantity is 0, remove the item
        if (newQuantity === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
                setUpdatingItemId(itemId);
                // Optimistically remove from local state
                const updatedItems = cartItems.filter(item => item.id !== itemId);
                setCartItems(updatedItems);
                
                await removeFromCart(itemId);
                await refetch();
            } catch (error) {
                // Revert on error - refetch will restore correct state
                await refetch();
                Alert.alert('Error', 'Failed to remove item. Please try again.');
            } finally {
                setUpdatingItemId(null);
            }
            return;
        }

        // Update quantity
        try {
            setUpdatingItemId(itemId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            // Optimistically update local state
            const updatedItems = [...cartItems];
            updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                quantity: newQuantity
            };
            setCartItems(updatedItems);
            
            await updateCartItem({ itemId, quantity: newQuantity });
            await refetch();
        } catch (error) {
            // Revert on error - refetch will restore correct state
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
                            // Optimistically remove from local state
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
                serviceCharge: serviceCharge.toString(),
                serviceChargeDiscount: serviceChargeDiscount.toString(),
                discount: discount.toString(),
                total: total.toString(),
            },
        });
    }, [cartItems, subtotal, serviceCharge, serviceChargeDiscount, discount, total, router]);

    const renderCartItem = useCallback((item: CartItem, index: number) => {
        const initials = getInitials(item.name);
        const isUpdating = updatingItemId === item.id;
        const itemPrice = parseFloat(item.price || '0');

        return (
            <Animated.View
                key={`${item.id}-${index}`}
                entering={FadeInDown.delay(index * 80).springify().damping(15)}
                layout={Layout.springify()}
                style={styles.cartItemWrapper}
            >
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
                            <View style={[styles.popularBadge, { backgroundColor: THEME_COLOR }]}>
                                <MaterialIcons name="star" size={10} color="#fff" />
                            </View>
                        )}
                        {item.categoryName && (
                            <View style={[styles.categoryBadge, { backgroundColor: THEME_COLOR + '20' }]}>
                                <Text style={[styles.categoryBadgeText, { color: THEME_COLOR }]}>
                                    {item.categoryName}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.itemInfo}>
                        <View style={styles.itemHeader}>
                            <Text style={styles.itemName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={[styles.itemPrice, { color: THEME_COLOR }]}>
                                {formatPrice(itemPrice)}
                            </Text>
                        </View>

                        {item.description && (
                            <Text style={styles.itemDescription} numberOfLines={1}>
                                {item.description}
                            </Text>
                        )}

                        <View style={styles.itemActions}>
                            {/* Quantity Controls */}
                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    style={[styles.quantityButton, styles.quantityMinus]}
                                    onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                    activeOpacity={0.7}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? (
                                        <ActivityIndicator size="small" color="#64748b" />
                                    ) : (
                                        <Ionicons name="remove" size={16} color="#64748b" />
                                    )}
                                </TouchableOpacity>
                                <Text style={styles.quantityText}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={[styles.quantityButton, styles.quantityPlus, { backgroundColor: THEME_COLOR }]}
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
                                <Feather name="trash-2" size={16} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Animated.View>
        );
    }, [handleUpdateQuantity, handleRemoveItem, updatingItemId]);

    const renderEmptyState = useCallback(() => (
        <Animated.View
            entering={FadeInUp.springify().damping(15)}
            style={styles.emptyContainer}
        >
            <View style={styles.emptyIconWrapper}>
                <LinearGradient
                    colors={[THEME_COLOR + '10', THEME_COLOR + '05']}
                    style={styles.emptyIconGradient}
                >
                    <Ionicons name="cart-outline" size={72} color={THEME_COLOR} />
                </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>
                Browse our services and add your favorites
            </Text>
            <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(protected)/(customer)/services')}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[THEME_COLOR, THEME_COLOR_LIGHT]}
                    style={styles.browseGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Feather name="arrow-left" size={18} color="#fff" />
                    <Text style={styles.browseButtonText}>Browse Services</Text>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    ), [router]);

    const renderPromoCode = useCallback(() => (
        <Animated.View
            entering={FadeInUp.delay(200).springify()}
            style={styles.promoContainer}
        >
            <View style={styles.promoCard}>
                <FontAwesome5 name="ticket" size={18} color={THEME_COLOR} />
                <TextInput
                    style={styles.promoInput}
                    placeholder="Enter promo code"
                    placeholderTextColor="#94a3b8"
                    value={promoCode}
                    onChangeText={setPromoCode}
                    editable={!isPromoApplied}
                    autoCapitalize="characters"
                />
                {isPromoApplied ? (
                    <View style={[styles.promoAppliedBadge, { backgroundColor: THEME_COLOR + '15' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={THEME_COLOR} />
                        <Text style={[styles.promoAppliedText, { color: THEME_COLOR }]}>Applied</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.promoApplyButton, { backgroundColor: THEME_COLOR }]}
                        onPress={applyPromoCode}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.promoApplyText}>Apply</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    ), [promoCode, isPromoApplied, applyPromoCode]);

    const renderSummary = useCallback(() => (
        <Animated.View
            entering={FadeInUp.delay(300).springify()}
            style={styles.summaryContainer}
        >
            <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                <View style={[styles.itemCountBadge, { backgroundColor: THEME_COLOR + '10' }]}>
                    <Text style={[styles.itemCountText, { color: THEME_COLOR }]}>
                        {totalItemCount} items
                    </Text>
                </View>
            </View>

            <View style={styles.summaryDetails}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
                </View>

                {/* Service Charge with Animation */}
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service Charge</Text>
                    {showAnimatedPrice ? (
                        <AnimatedPrice fromPrice={150} toPrice={0} duration={2000} />
                    ) : (
                        <Text style={[styles.summaryValue, { color: '#64748b' }]}>
                            {formatPrice(serviceCharge)}
                        </Text>
                    )}
                </View>
                {isPromoApplied && (
                    <Animated.View entering={SlideInRight.springify()} style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, { color: THEME_COLOR }]}>
                            <Ionicons name="pricetag" size={14} color={THEME_COLOR} /> Discount
                        </Text>
                        <Text style={[styles.summaryValue, { color: THEME_COLOR, fontWeight: '700' }]}>
                            -{formatPrice(discount)}
                        </Text>
                    </Animated.View>
                )}

                <View style={styles.divider} />

                <Animated.View
                    entering={SlideInLeft.springify()}
                    style={[styles.summaryRow, styles.totalRow]}
                >
                    <View>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalSubLabel}>Including all charges</Text>
                    </View>
                    <Text style={[styles.totalValue, { color: THEME_COLOR }]}>
                        {formatPrice(total)}
                    </Text>
                </Animated.View>
            </View>

            <TouchableOpacity
                style={styles.checkoutButton}
                onPress={handleCheckout}
                activeOpacity={0.9}
                disabled={!!updatingItemId || isLoading}
            >
                <LinearGradient
                    colors={[THEME_COLOR, THEME_COLOR_LIGHT]}
                    style={styles.checkoutGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>

            <View style={styles.safetyInfo}>
                <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                <Text style={styles.safetyText}>Secure checkout • 100% protected</Text>
            </View>
        </Animated.View>
    ), [totalItemCount, subtotal, serviceCharge, serviceChargeDiscount, showAnimatedPrice, isPromoApplied, discount, total, handleCheckout, updatingItemId, isLoading]);

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={THEME_COLOR} />
                    <Text style={styles.loadingText}>Loading your cart...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <View style={styles.container}>
                {cartItems.length > 0 ? (
                    <>
                        <View style={styles.headerContent}>
                            <Text style={styles.headerTitle}>Your Cart</Text>
                            <Text style={styles.headerSubtitle}>
                                {cartItems.length} {cartItems.length === 1 ? 'service' : 'services'} selected
                            </Text>
                            {isRefetching && (
                                <ActivityIndicator size="small" color={THEME_COLOR} style={styles.refetchIndicator} />
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
                                    colors={[THEME_COLOR]}
                                    tintColor={THEME_COLOR}
                                />
                            }
                        >
                            <View style={styles.cartList}>
                                {cartItems.map((item, index) => renderCartItem(item, index))}
                            </View>

                            {renderPromoCode()}
                            {renderSummary()}
                            <View style={styles.bottomSpacer} />
                        </ScrollView>

                        {/* Floating Bottom Bar */}
                        <Animated.View
                            entering={FadeInUp.delay(200).springify()}
                            style={styles.floatingBar}
                        >
                            <View style={styles.floatingBarContent}>
                                <View>
                                    <Text style={styles.floatingTotalLabel}>Total</Text>
                                    <Text style={styles.floatingTotal}>{formatPrice(total)}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.floatingCheckout}
                                    onPress={handleCheckout}
                                    activeOpacity={0.8}
                                    disabled={!!updatingItemId}
                                >
                                    <LinearGradient
                                        colors={[THEME_COLOR, THEME_COLOR_LIGHT]}
                                        style={styles.floatingCheckoutGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.floatingCheckoutText}>Checkout</Text>
                                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
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
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    headerContent: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 8 : 16,
        paddingBottom: 16,
        backgroundColor: '#f8fafc',
        marginTop: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
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
    categoryBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    categoryBadgeText: {
        fontSize: 9,
        fontWeight: '600',
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
        color: '#0f172a',
        flex: 1,
        marginRight: 8,
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
    },
    itemDescription: {
        fontSize: 12,
        color: '#94a3b8',
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
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
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
        backgroundColor: THEME_COLOR,
    },
    quantityText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
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
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
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
        color: '#0f172a',
        paddingVertical: 4,
    },
    promoApplyButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
    },
    promoApplyText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
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
    summaryContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        marginTop: 16,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(241, 245, 249, 0.8)',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    itemCountBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemCountText: {
        fontSize: 12,
        fontWeight: '600',
    },
    summaryDetails: {
        gap: 4,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
    },
    animatedPrice: {
        fontSize: 14,
        fontWeight: '700',
        minWidth: 60,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 8,
    },
    totalRow: {
        paddingVertical: 8,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
    },
    totalSubLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 1,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    checkoutButton: {
        marginTop: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    checkoutGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    checkoutButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    safetyInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
    },
    safetyText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    bottomSpacer: {
        height: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        backgroundColor: '#f8fafc',
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
        color: '#0f172a',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#94a3b8',
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
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    floatingBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: 'rgba(241, 245, 249, 0.8)',
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
        color: '#94a3b8',
        fontWeight: '500',
    },
    floatingTotal: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
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
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
});