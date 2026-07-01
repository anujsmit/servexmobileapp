// app/(protected)/(customer)/sub-category/[id].tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Dimensions,
    Platform,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    Layout,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCartQuery, useAddToCart, useRemoveFromCart, useCartCount } from '../../../../hooks/cart';

const { width } = Dimensions.get('window');

// ============================================
// BLUE THEME CONSTANTS
// ============================================

const BLUE = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    primaryBgLight: 'rgba(37, 99, 235, 0.12)',
    primaryBgMedium: 'rgba(37, 99, 235, 0.15)',
    gradientStart: '#2563eb',
    gradientEnd: '#1d4ed8',
    text: '#000000',
    textSecondary: '#333333',
    textTertiary: '#666666',
    textInverse: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    white: '#ffffff',
    black: '#000000',
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

interface ServiceItem {
    id: string;
    subCategoryId: string;
    name: string;
    description: string | null;
    price: string;
    durationMinutes: number | null;
    isActive: boolean;
    isPopular: boolean;
    imageUrl: string | null;
    displayOrder: number;
}

interface SubCategoryDetail {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    isPopular: boolean;
    displayOrder: number;
    itemCount: number;
    items: ServiceItem[];
}

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

const formatPrice = (price: string | number): string => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return `रु ${num.toLocaleString('en-IN')}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SubCategoryDetailScreen() {
    const { id, name, categoryName, categoryColor, categoryId } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();

    const [subCategory, setSubCategory] = useState<SubCategoryDetail | null>(null);
    const [items, setItems] = useState<ServiceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredItems, setFilteredItems] = useState<ServiceItem[]>([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

    // React Query hooks for cart
    const { data: cartData, refetch: refetchCart } = useCartQuery();
    const { mutateAsync: addToCart } = useAddToCart();
    const { mutateAsync: removeFromCart } = useRemoveFromCart();
    const { data: cartCount, refetch: refetchCartCount } = useCartCount();

    // Animation values
    const cartBadgeScale = useSharedValue(1);

    // ---- Header with cart icon ----
    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Services',
            headerTitleStyle: { fontWeight: '600', fontSize: 18, color: BLUE.text },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: BLUE.white },
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleCartPress}
                    style={styles.cartHeaderButton}
                    activeOpacity={0.7}
                >
                    <View style={styles.cartIconContainer}>
                        <Ionicons name="cart-outline" size={24} color={BLUE.text} />
                        {(cartCount || 0) > 0 && (
                            <Animated.View
                                style={[
                                    styles.cartBadge,
                                    { transform: [{ scale: cartBadgeScale }] },
                                ]}
                            >
                                <Text style={styles.cartBadgeText}>
                                    {cartCount! > 99 ? '99+' : cartCount}
                                </Text>
                            </Animated.View>
                        )}
                    </View>
                </TouchableOpacity>
            ),
        });
    }, [name, cartCount]);

    // ---- Data fetching ----
    useEffect(() => {
        fetchSubCategoryDetail();
    }, [id, categoryId]);

    // ---- Search filtering ----
    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = items.filter(
                item =>
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description &&
                        item.description.toLowerCase().includes(searchQuery.toLowerCase())),
            );
            setFilteredItems(filtered);
        } else {
            setFilteredItems(items);
        }
    }, [searchQuery, items]);

    // ---- Sync added-items set from cart data ----
    useEffect(() => {
        if (cartData?.items) {
            const itemIds = new Set(
                cartData.items.map((item: any) => item.serviceItemId),
            );
            setAddedItems(itemIds);
        }
    }, [cartData]);

    // ============================================
    // ACTIONS
    // ============================================

    const fetchSubCategoryDetail = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/public/categories/${categoryId || '1'}/sub-categories/${id}`;
            console.log('Fetching sub-category from:', url);

            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                const subCategoryData = data.subCategory;
                setSubCategory(subCategoryData);
                setItems(subCategoryData.items || []);
                setFilteredItems(subCategoryData.items || []);
            } else {
                setError(data.message || 'Failed to load services');
                setItems([]);
                setFilteredItems([]);
            }
        } catch (err) {
            console.error('Error fetching sub-category:', err);
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchSubCategoryDetail(), refetchCart(), refetchCartCount()]);
        setRefreshing(false);
    };

    const handleServicePress = (item: ServiceItem) => {
        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: item.id,
                name: item.name,
                price: item.price,
                description: item.description || '',
                imageUrl: item.imageUrl || '',
                categoryName: categoryName as string,
                subCategoryName: subCategory?.name,
            },
        });
    };

    const handleAddToCart = async (item: ServiceItem) => {
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            if (addedItems.has(item.id)) {
                const cartItem = cartData?.items?.find(
                    (i: any) => i.serviceItemId === item.id,
                );
                if (cartItem) {
                    await removeFromCart(cartItem.id);
                    setAddedItems(prev => {
                        const next = new Set(prev);
                        next.delete(item.id);
                        return next;
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } else {
                await addToCart({ serviceItemId: item.id, quantity: 1 });
                setAddedItems(prev => new Set(prev).add(item.id));

                cartBadgeScale.value = withSpring(1.4, { damping: 10, stiffness: 200 });
                setTimeout(() => {
                    cartBadgeScale.value = withSpring(1);
                }, 200);

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            await refetchCart();
            await refetchCartCount();
        } catch (error) {
            console.error('Error updating cart:', error);
            Alert.alert('Error', 'Failed to update cart. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCartPress = () => {
        if (!cartCount || cartCount === 0) {
            Alert.alert('Cart is Empty', 'Add some services to your cart first.');
            return;
        }
        router.push('/cart');
    };

    const getColor = (): string => (categoryColor as string) || BLUE.primary;

    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderServiceItem = (item: ServiceItem, index: number) => {
        const color = getColor();
        const initials = getInitials(item.name);
        const isInCart = addedItems.has(item.id);

        return (
            <Animated.View
                key={item.id}
                entering={FadeInDown.delay(index * 60).springify().damping(15)}
                layout={Layout.springify()}
            >
                <View
                    style={[
                        styles.serviceItemCard,
                        isInCart && { borderColor: hexToRgba(color, 0.3) },
                        { borderColor: BLUE.borderLight, backgroundColor: BLUE.white },
                    ]}
                >
                    {/* ---- Top row: image + info (tappable → details) ---- */}
                    <TouchableOpacity
                        style={styles.cardTop}
                        activeOpacity={0.7}
                        onPress={() => handleServicePress(item)}
                    >
                        <View
                            style={[
                                styles.serviceImageContainer,
                                { backgroundColor: BLUE.primaryBg },
                            ]}
                        >
                            {item.imageUrl ? (
                                <Image
                                    source={{ uri: item.imageUrl }}
                                    style={styles.serviceImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.serviceImagePlaceholder}>
                                    <Text style={[styles.serviceInitials, { color }]}>
                                        {initials}
                                    </Text>
                                </View>
                            )}
                            {item.isPopular && (
                                <View style={[styles.popularBadge, { backgroundColor: color }]}>
                                    <MaterialIcons name="star" size={10} color="#fff" />
                                </View>
                            )}
                        </View>

                        <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, { color: BLUE.text }]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={[styles.serviceDescription, { color: BLUE.textSecondary }]} numberOfLines={2}>
                                {item.description || 'Professional service at your doorstep'}
                            </Text>
                            <View style={styles.serviceMeta}>
                                <View>
                                    <Text style={[styles.priceLabel, { color: BLUE.textTertiary }]}>From</Text>
                                    <Text style={[styles.servicePrice, { color }]}>
                                        {formatPrice(item.price)}
                                    </Text>
                                </View>
                                {item.durationMinutes && (
                                    <View style={[styles.durationBadge, { backgroundColor: BLUE.background }]}>
                                        <Ionicons name="time-outline" size={13} color={BLUE.textTertiary} />
                                        <Text style={[styles.durationText, { color: BLUE.textSecondary }]}>
                                            {item.durationMinutes} min
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* ---- Bottom row: action buttons ---- */}
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                isInCart && [
                                    styles.addedButton,
                                    { borderColor: color, backgroundColor: hexToRgba(color, 0.06) },
                                ],
                                { borderColor: BLUE.border, backgroundColor: BLUE.white },
                            ]}
                            onPress={() => handleAddToCart(item)}
                            activeOpacity={0.7}
                            disabled={isUpdating}
                        >
                            <Ionicons
                                name={isInCart ? 'checkmark-circle' : 'add-circle-outline'}
                                size={18}
                                color={isInCart ? color : BLUE.textTertiary}
                            />
                            <Text style={[styles.addButtonText, isInCart && { color }, { color: BLUE.textSecondary }]}>
                                {isInCart ? 'Added' : 'Add'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.orderButton, { backgroundColor: color }]}
                            onPress={() => handleServicePress(item)}
                            activeOpacity={0.8}
                            disabled={isUpdating}
                        >
                            <Text style={[styles.orderButtonText, { color: BLUE.textInverse }]}>Order Now</Text>
                            <Ionicons name="arrow-forward" size={16} color={BLUE.textInverse} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        );
    };

    const renderHeader = () => {
        const color = getColor();
        const initials = getInitials(subCategory?.name || (name as string));

        return (
            <Animated.View
                entering={FadeInUp.springify().damping(15)}
                style={[styles.headerContainer, { backgroundColor: BLUE.white, borderBottomColor: BLUE.borderLight }]}
            >
                <LinearGradient
                    colors={[hexToRgba(color, 0.04), BLUE.white]}
                    style={styles.headerGradient}
                >
                    <View
                        style={[styles.iconWrapper, { borderColor: hexToRgba(color, 0.15) }]}
                    >
                        {subCategory?.imageUrl ? (
                            <Image
                                source={{ uri: subCategory.imageUrl }}
                                style={styles.icon}
                                resizeMode="contain"
                            />
                        ) : (
                            <Text style={[styles.headerInitials, { color }]}>{initials}</Text>
                        )}
                    </View>
                    <Text style={[styles.headerTitle, { color: BLUE.text }]}>{subCategory?.name || name}</Text>
                    {subCategory?.description && (
                        <Text style={[styles.headerDescription, { color: BLUE.textSecondary }]}>
                            {subCategory.description}
                        </Text>
                    )}
                    <View style={[styles.headerStats, { backgroundColor: BLUE.white, borderColor: BLUE.borderLight }]}>
                        <View style={styles.statItem}>
                            <MaterialIcons name="handyman" size={16} color={color} />
                            <Text style={[styles.statText, { color: BLUE.textSecondary }]}>
                                {items.length} {items.length === 1 ? 'Service' : 'Services'}
                            </Text>
                        </View>
                        {subCategory?.isPopular && (
                            <>
                                <View style={[styles.statDivider, { backgroundColor: BLUE.border }]} />
                                <View style={styles.statItem}>
                                    <MaterialIcons name="star" size={16} color={BLUE.warning} />
                                    <Text style={[styles.statText, { color: BLUE.textSecondary }]}>Popular</Text>
                                </View>
                            </>
                        )}
                    </View>
                </LinearGradient>
            </Animated.View>
        );
    };

    const renderSearchBar = () => (
        <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={styles.searchContainer}
        >
            <View style={[styles.searchBar, { backgroundColor: BLUE.white, borderColor: BLUE.border }]}>
                <Feather name="search" size={18} color={BLUE.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: BLUE.text }]}
                    placeholder={`Search in ${subCategory?.name || name}...`}
                    placeholderTextColor={BLUE.textTertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={BLUE.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );

    const renderError = () => (
        <Animated.View entering={FadeInDown.springify()} style={[styles.errorContainer, { backgroundColor: BLUE.white, borderColor: BLUE.borderLight }]}>
            <View style={[styles.errorIconWrapper, { backgroundColor: BLUE.errorBg }]}>
                <MaterialIcons name="wifi-off" size={48} color={BLUE.textTertiary} />
            </View>
            <Text style={[styles.errorTitle, { color: BLUE.text }]}>Something went wrong</Text>
            <Text style={[styles.errorSubtitle, { color: BLUE.textSecondary }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: BLUE.primary }]} onPress={fetchSubCategoryDetail}>
                <Text style={[styles.retryButtonText, { color: BLUE.textInverse }]}>Try Again</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    // ============================================
    // MAIN RENDER
    // ============================================

    if (loading && !refreshing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: BLUE.background }]}>
                <ActivityIndicator size="large" color={getColor()} />
                <Text style={[styles.loadingText, { color: BLUE.textSecondary }]}>Loading services...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: BLUE.background }]} edges={['bottom']}>
            <View style={[styles.container, { backgroundColor: BLUE.background }]}>
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[getColor()]}
                        />
                    }
                >
                    {renderHeader()}
                    {renderSearchBar()}

                    <View style={styles.content}>
                        {error && !refreshing ? (
                            renderError()
                        ) : filteredItems.length === 0 ? (
                            <Animated.View
                                entering={FadeInDown.springify()}
                                style={[styles.emptyContainer, { backgroundColor: BLUE.white, borderColor: BLUE.borderLight }]}
                            >
                                <View style={[styles.emptyIconWrapper, { backgroundColor: BLUE.background }]}>
                                    <MaterialIcons name="search-off" size={48} color={BLUE.textTertiary} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: BLUE.text }]}>
                                    {searchQuery
                                        ? 'No services match your search'
                                        : 'No services available'}
                                </Text>
                                <Text style={[styles.emptySubtitle, { color: BLUE.textSecondary }]}>
                                    {searchQuery
                                        ? 'Try a different search term'
                                        : 'Check back later for new services'}
                                </Text>
                            </Animated.View>
                        ) : (
                            <View style={styles.servicesList}>
                                {filteredItems.map((item, index) =>
                                    renderServiceItem(item, index),
                                )}
                            </View>
                        )}

                        {/* Spacer so last card isn't hidden behind floating button */}
                        {(cartCount || 0) > 0 && <View style={styles.bottomSpacer} />}
                    </View>
                </ScrollView>

                {/* Floating Cart Button */}
                {(cartCount || 0) > 0 && (
                    <Animated.View
                        entering={FadeInUp.springify().damping(15)}
                        style={styles.floatingCartWrapper}
                    >
                        <TouchableOpacity
                            style={styles.floatingCartButton}
                            onPress={handleCartPress}
                            activeOpacity={0.9}
                        >
                            <LinearGradient
                                colors={[getColor(), hexToRgba(getColor(), 0.8)]}
                                style={styles.floatingCartGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <View style={styles.floatingCartContent}>
                                    <View style={styles.floatingCartLeft}>
                                        <Ionicons name="cart" size={22} color={BLUE.textInverse} />
                                        <View style={[styles.floatingCartBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                            <Text style={[styles.floatingCartBadgeText, { color: BLUE.textInverse }]}>
                                                {cartCount || 0}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.floatingCartDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                                    <Text style={[styles.floatingCartText, { color: BLUE.textInverse }]}>
                                        View Cart • {formatPrice(cartData?.subtotal || 0)}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={20} color={BLUE.textInverse} />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
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
    scrollView: {
        flex: 1,
    },

    // ---- Loading ----
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },

    // ---- Header ----
    headerContainer: {
        borderBottomWidth: 1,
    },
    headerGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 20,
    },
    iconWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
    },
    icon: {
        width: 40,
        height: 40,
    },
    headerInitials: {
        fontSize: 28,
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    headerDescription: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 14,
        paddingHorizontal: 20,
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 12,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 14,
        marginHorizontal: 14,
    },

    // ---- Search ----
    searchContainer: {
        paddingHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 46,
        borderWidth: 1,
        gap: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 0,
    },

    // ---- Content area ----
    content: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    servicesList: {
        gap: 12,
        marginTop: 8,
    },

    // ---- Service card (vertical: info top, actions bottom) ----
    serviceItemCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTop: {
        flexDirection: 'row',
        padding: 14,
        paddingBottom: 10,
        gap: 12,
    },
    serviceImageContainer: {
        width: 72,
        height: 72,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
    },
    serviceImage: {
        width: '100%',
        height: '100%',
    },
    serviceImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceInitials: {
        fontSize: 24,
        fontWeight: '700',
    },
    popularBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 3,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '600',
    },
    serviceDescription: {
        fontSize: 12,
        lineHeight: 16,
    },
    serviceMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 4,
    },
    priceLabel: {
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: '700',
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    durationText: {
        fontSize: 11,
        fontWeight: '500',
    },

    // ---- Card action buttons ----
    cardActions: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingBottom: 14,
        gap: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 6,
    },
    addedButton: {
        borderWidth: 1.5,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    orderButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    orderButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },

    // ---- Empty state ----
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        borderRadius: 20,
        borderWidth: 1,
        marginTop: 12,
    },
    emptyIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    // ---- Error state ----
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        borderRadius: 20,
        borderWidth: 1,
        marginTop: 12,
    },
    errorIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    errorSubtitle: {
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },

    // ---- Bottom spacer ----
    bottomSpacer: {
        height: 80,
    },

    // ---- Cart header icon ----
    cartHeaderButton: {
        marginRight: 16,
    },
    cartIconContainer: {
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    cartBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        paddingHorizontal: 4,
        color: '#ffffff',
    },

    // ---- Floating cart button ----
    floatingCartWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        backgroundColor: 'transparent',
    },
    floatingCartButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    floatingCartGradient: {
        paddingVertical: 14,
        paddingHorizontal: 18,
    },
    floatingCartContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    floatingCartLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    floatingCartBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    floatingCartBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    floatingCartDivider: {
        width: 1,
        height: 24,
    },
    floatingCartText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        color: '#ffffff',
    },
});