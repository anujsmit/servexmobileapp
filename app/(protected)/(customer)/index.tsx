// app/(protected)/(customer)/dashboard.tsx

import React, {
    useMemo,
    useCallback,
    useEffect,
    useState,
    useRef,
} from 'react';

import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Dimensions,
    RefreshControl,
    TextInput,
    Image,
    Modal,
    ActivityIndicator,
    Platform,
    StatusBar,
    Alert,
} from 'react-native';

import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { customerBrand as B, customerDashboardColors as C } from '../../../lib/customerDashboardTokens';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../context/LocationContext';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { HeroBanner } from '../../../components/HeroBanner';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useServices } from '../../../context/ServicesContext';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES - Updated for Service Hierarchy
// ============================================

interface ServiceItem {
    id: string;
    name: string;
    description: string | null;
    price: number | string;
    durationMinutes: number | null;
    imageUrl: string | null;
    isPopular?: boolean;
    displayOrder?: number;
    subCategoryId?: string;
    categoryName?: string;
    categoryId?: number;
}

interface SubCategory {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isPopular: boolean;
    items: ServiceItem[];
    itemCount: number;
}

interface ServiceCategory {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconColor: string | null;
    displayOrder: number;
    subCategories: SubCategory[];
    totalItems: number;
    popularItems: ServiceItem[];
}

interface HierarchyResponse {
    success: boolean;
    hierarchy: ServiceCategory[];
    popularServices: ServiceItem[];
    totalCategories: number;
    totalItems: number;
}

interface Banner {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    videoUrl: string | null;
    linkUrl: string | null;
    displayOrder: number;
    isActive: boolean;
    adType: 'ad1' | 'ad2' | 'both';
}

interface ServiceRequest {
    id: string;
    type: string;
    address: string;
    status: 'pending' | 'assigned' | 'canceled' | 'completed';
    createdAt: string;
    assignedAt?: string;
    assignedMistriId?: string;
    unpaid?: boolean;
    paymentAmount?: string;
    mistriName?: string;
    mistriPhone?: string;
}

// ============================================
// SKELETON COMPONENTS
// ============================================

const CategorySkeleton = () => {
    const animatedValue = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                Animated.timing(animatedValue, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0.3, 0.7],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.categoryCardSkeleton}>
            <Animated.View style={[styles.skeletonIcon, { opacity }]} />
            <Animated.View style={[styles.skeletonText, { opacity, width: 60, height: 12 }]} />
        </View>
    );
};

const PopularServiceSkeleton = () => {
    const animatedValue = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, { toValue: 0.7, duration: 800, useNativeDriver: true }),
                Animated.timing(animatedValue, { toValue: 0.3, duration: 800, useNativeDriver: true }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0.3, 0.7],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={styles.popularServiceCardRow}>
            <Animated.View style={[styles.skeletonPopularImageRow, { opacity }]} />
            <View style={styles.popularInfoContainerRow}>
                <Animated.View style={[styles.skeletonText, { opacity, width: '60%', height: 14, marginBottom: 6 }]} />
                <Animated.View style={[styles.skeletonText, { opacity, width: '80%', height: 10, marginBottom: 4 }]} />
                <Animated.View style={[styles.skeletonText, { opacity, width: '40%', height: 12 }]} />
            </View>
            <Animated.View style={[styles.skeletonButtonRow, { opacity }]} />
        </View>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CustomerDashboard() {
    const { user, token, refreshAccessToken, logout } = useAuth();
    const { address, isLoading: locationLoading, refetch: refetchLocation } = useLocation();
    const router = useRouter();
    const { getServiceByName, getServiceColor, getServiceIcon } = useServices();

    // State for service requests - using the correct endpoint
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);

    // State - Updated for hierarchy
    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [popularServices, setPopularServices] = useState<ServiceItem[]>([]);
    const [allServiceItems, setAllServiceItems] = useState<ServiceItem[]>([]);
    const [ad1Banners, setAd1Banners] = useState<Banner[]>([]);
    const [ad2Banners, setAd2Banners] = useState<Banner[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [popularServicesLoading, setPopularServicesLoading] = useState(true);
    const [bannersLoading, setBannersLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
    const [displayCategories, setDisplayCategories] = useState<ServiceCategory[]>([]);
    const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

    // ============================================
    // COMPUTED VALUES
    // ============================================

    const recentRequest = useMemo(() => {
        if (!requests || requests.length === 0) return null;
        const sorted = [...requests].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        return sorted[0];
    }, [requests]);

    const brandStyles = useMemo(() => ({
        avatar: { backgroundColor: B.accent },
        seeAll: { color: B.accent },
    }), []);

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [1, 0.96],
        extrapolate: 'clamp',
    });

    // ============================================
    // EFFECTS
    // ============================================

    useEffect(() => {
        fetchHierarchyData();
        fetchBanners();
        fetchServiceRequests(); // ✅ Fetch requests using correct endpoint
    }, []);

    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = categories.filter(category =>
                (category.name || '')
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
            );
            setDisplayCategories(filtered);
        } else {
            setDisplayCategories(categories);
        }
    }, [searchQuery, categories]);

    // ============================================
    // API FUNCTIONS - UPDATED FOR HIERARCHY
    // ============================================

    // ✅ FIXED: Fetch service requests using the correct endpoint
    const fetchServiceRequests = async () => {
        try {
            setRequestsLoading(true);
            
            // Use the correct endpoint for user service requests
            const url = `${API_BASE}/api/users/service-requests`;
            console.log('[Dashboard] Fetching requests from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired, try to refresh
                    const newToken = await refreshAccessToken();
                    if (newToken) {
                        // Retry with new token
                        const retryResponse = await fetch(url, {
                            headers: {
                                'Authorization': `Bearer ${newToken}`,
                                'Content-Type': 'application/json',
                                'ngrok-skip-browser-warning': 'true',
                            },
                        });
                        if (retryResponse.ok) {
                            const data = await retryResponse.json();
                            setRequests(data.requests || []);
                            return;
                        }
                    }
                    throw new Error('Authentication failed');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[Dashboard] Requests fetched:', data.requests?.length || 0);
            setRequests(data.requests || []);
        } catch (error) {
            console.error('[Dashboard] Error fetching requests:', error);
            // Don't show error to user, just show empty state
            setRequests([]);
        } finally {
            setRequestsLoading(false);
        }
    };

    const fetchHierarchyData = async () => {
        try {
            setCategoriesLoading(true);
            setPopularServicesLoading(true);
            setError(null);

            const url = `${API_BASE}/api/public/service-hierarchy`;
            console.log('[Dashboard] Fetching hierarchy from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            
            console.log('[Dashboard] Response status:', response.status);
            
            const data: HierarchyResponse = await response.json();

            if (response.ok && data.success) {
                console.log('[Dashboard] Categories found:', data.hierarchy?.length || 0);
                console.log('[Dashboard] Total items:', data.totalItems || 0);
                
                setCategories(data.hierarchy || []);
                setDisplayCategories(data.hierarchy || []);
                
                const flat: ServiceItem[] = [];
                (data.hierarchy || []).forEach((cat) => {
                    (cat.subCategories || []).forEach((sub) => {
                        (sub.items || []).forEach((item) => {
                            flat.push({
                                ...item,
                                categoryName: cat.name,
                                categoryId: cat.id,
                            });
                        });
                    });
                });
                setAllServiceItems(flat);
                
                if (data.popularServices && data.popularServices.length > 0) {
                    setPopularServices(data.popularServices.slice(0, 10));
                } else {
                    setPopularServices(flat.filter((s) => s.isPopular).slice(0, 10));
                }
            } else {
                console.error('[Dashboard] Hierarchy API error:', data);
                await fetchLegacyCategories();
            }
        } catch (error) {
            console.error('[Dashboard] Error fetching hierarchy:', error);
            setError('Failed to load services. Please check your connection.');
            await fetchLegacyCategories();
        } finally {
            setCategoriesLoading(false);
            setPopularServicesLoading(false);
        }
    };

    const fetchLegacyCategories = async () => {
        try {
            console.log('[Dashboard] Falling back to legacy categories');
            const url = `${API_BASE}/api/public/categories`;
            const response = await fetch(url, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await response.json();

            if (response.ok && data.success) {
                let categoriesData = data.categories || [];
                const mappedCategories = categoriesData.map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    description: cat.description || null,
                    iconUrl: cat.iconUrl || null,
                    iconColor: cat.iconColor || '#e67e22',
                    displayOrder: cat.displayOrder || 0,
                    subCategories: [],
                    totalItems: cat.subCategoryCount || 0,
                    popularItems: [],
                }));
                setCategories(mappedCategories);
                setDisplayCategories(mappedCategories);
            }
        } catch (error) {
            console.error('[Dashboard] Legacy fetch error:', error);
            setCategories([]);
            setDisplayCategories([]);
        }
    };

    const fetchBanners = async () => {
        try {
            setBannersLoading(true);

            const ad1Response = await fetch(`${API_BASE}/api/public/hero-banners/type/ad1`);
            const ad1Data = await ad1Response.json();
            if (ad1Data.success && ad1Data.banners && ad1Data.banners.length > 0) {
                setAd1Banners(ad1Data.banners);
            } else {
                setAd1Banners([]);
            }

            const ad2Response = await fetch(`${API_BASE}/api/public/hero-banners/type/ad2`);
            const ad2Data = await ad2Response.json();
            if (ad2Data.success && ad2Data.banners && ad2Data.banners.length > 0) {
                setAd2Banners(ad2Data.banners);
            } else {
                setAd2Banners([]);
            }
        } catch (error) {
            console.log('Failed to fetch banners:', error);
            setAd1Banners([]);
            setAd2Banners([]);
        } finally {
            setBannersLoading(false);
        }
    };

    const refreshAllData = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchHierarchyData(),
            fetchBanners(),
            fetchServiceRequests(),
        ]);
        setRefreshing(false);
    };

    const onRefresh = useCallback(() => { refreshAllData(); }, []);

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    const getInitials = (name: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getCategoryColor = (category: ServiceCategory, index: number) => {
        if (category.iconColor) return category.iconColor;
        const colors = ['#FF6B6B', '#4A90E2', '#4CAF50', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4'];
        return colors[index % colors.length];
    };

    const getCategoryName = (category: ServiceCategory) => {
        return category.name || 'Unnamed';
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            'pending': '#f59e0b',
            'assigned': '#3b82f6',
            'completed': '#10b981',
            'canceled': '#ef4444',
        };
        return colors[status] || '#94a3b8';
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'pending': 'Pending Approval',
            'assigned': 'Assigned',
            'completed': 'Completed ✅',
            'canceled': 'Canceled',
        };
        return labels[status] || status;
    };

    // ============================================
    // NAVIGATION HANDLERS
    // ============================================

    const openCategory = (category: ServiceCategory) => {
        const categoryId = category.id;
        const categoryName = getCategoryName(category);

        router.push({
            pathname: '/category/[id]',
            params: {
                id: categoryId.toString(),
                name: categoryName,
                serviceId: categoryId.toString()
            },
        });
    };

    const openPopularService = (service: ServiceItem) => {
        const categoryNameValue = service.categoryName || 'Service';

        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: service.id,
                name: service.name,
                price: String(service.price),
                description: service.description || '',
                imageUrl: service.imageUrl || '',
                categoryName: categoryNameValue,
                durationMinutes: String(service.durationMinutes || 0),
            },
        });
    };

    const handleTrackRecentOrder = () => {
        if (recentRequest) {
            router.push(`/(protected)/(customer)/service-status/${recentRequest.id}`);
        } else {
            Alert.alert(
                'No Recent Orders',
                "You don't have any recent service requests. Would you like to browse services?",
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Browse Services', onPress: () => router.push('/services') }
                ]
            );
        }
    };

    const handleVideoPress = (videoUrl: string) => {
        let embedUrl = videoUrl;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            const videoId = videoUrl.split('v=')[1]?.split('&')[0];
            if (videoId) {
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }
        } else if (videoUrl.includes('youtu.be/')) {
            const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
            if (videoId) {
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }
        }
        setSelectedVideoUrl(embedUrl);
        setShowVideoModal(true);
    };

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    const renderRecentOrder = () => {
        if (requestsLoading) {
            return (
                <View style={styles.recentOrderCard}>
                    <View style={styles.recentOrderHeader}>
                        <ActivityIndicator size="small" color={B.accent} />
                        <Text style={styles.recentOrderTitle}>Loading recent order...</Text>
                    </View>
                </View>
            );
        }

        if (!recentRequest) {
            return (
                <TouchableOpacity
                    style={styles.recentOrderCard}
                    onPress={handleTrackRecentOrder}
                    activeOpacity={0.7}
                >
                    <View style={styles.recentOrderHeader}>
                        <View style={styles.recentOrderIconContainer}>
                            <Feather name="package" size={20} color="#94a3b8" />
                        </View>
                        <Text style={styles.recentOrderTitle}>No Recent Orders</Text>
                    </View>
                    <Text style={styles.recentOrderSubtitle}>Tap to browse services</Text>
                    <View style={styles.recentOrderDivider} />
                    <View style={styles.recentOrderFooter}>
                        <Text style={styles.recentOrderFooterText}>Start your first booking today</Text>
                        <Ionicons name="arrow-forward" size={16} color={B.accent} />
                    </View>
                </TouchableOpacity>
            );
        }

        const statusColor = getStatusColor(recentRequest.status);
        const serviceDisplayName = getServiceByName(recentRequest.type)?.displayName ||
            recentRequest.type.charAt(0).toUpperCase() + recentRequest.type.slice(1);

        return (
            <TouchableOpacity
                style={styles.recentOrderCard}
                onPress={handleTrackRecentOrder}
                activeOpacity={0.7}
            >
                <View style={styles.recentOrderHeader}>
                    <View style={[styles.recentOrderIconContainer, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons
                            name={getServiceIcon(recentRequest.type, true) as any}
                            size={20}
                            color={statusColor}
                        />
                    </View>
                    <View style={styles.recentOrderInfo}>
                        <Text style={styles.recentOrderTitle} numberOfLines={1}>
                            {serviceDisplayName}
                        </Text>
                        <View style={styles.recentOrderStatusRow}>
                            <View style={[styles.recentOrderStatusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.recentOrderStatus, { color: statusColor }]}>
                                {getStatusLabel(recentRequest.status)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.recentOrderArrow}>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </View>
                </View>

                <View style={styles.recentOrderDivider} />

                <View style={styles.recentOrderFooter}>
                    <View style={styles.recentOrderFooterItem}>
                        <Ionicons name="location-outline" size={14} color="#94a3b8" />
                        <Text style={styles.recentOrderFooterText} numberOfLines={1}>
                            {recentRequest.address}
                        </Text>
                    </View>
                    <View style={styles.recentOrderFooterItem}>
                        <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                        <Text style={styles.recentOrderFooterText}>
                            {new Date(recentRequest.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                <View style={styles.recentOrderTrackButton}>
                    <Text style={styles.recentOrderTrackText}>View Details</Text>
                    <Ionicons name="arrow-forward" size={16} color={B.accent} />
                </View>
            </TouchableOpacity>
        );
    };

    const quickActions = [
        {
            id: 'book_again',
            icon: 'history',
            label: 'Book Again',
            color: '#e67e22',
            route: '/services'
        },
        {
            id: 'my_bookings',
            icon: 'calendar-check',
            label: 'My Bookings',
            color: '#3b82f6',
            route: '/requests'
        },
        {
            id: 'track_order',
            icon: 'map-marker-alt',
            label: 'Track Order',
            color: '#10b981',
            onPress: handleTrackRecentOrder
        },
        {
            id: 'support',
            icon: 'headset',
            label: 'Support',
            color: '#8b5cf6',
            route: '/support'
        }
    ];

    const renderQuickActions = () => (
        <View style={styles.quickActionsSection}>
            <View style={styles.quickActionsGrid}>
                {quickActions.map((action) => (
                    <TouchableOpacity
                        key={action.id}
                        style={styles.quickActionCard}
                        onPress={action.onPress || (() => router.push(action.route as any))}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.quickActionIconWrapper, { backgroundColor: action.color + '15' }]}>
                            <FontAwesome5 name={action.icon as any} size={20} color={action.color} />
                        </View>
                        <Text style={styles.quickActionLabel} numberOfLines={1}>{action.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderSearchBar = () => (
        <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
                <Feather name="search" size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search for services..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderBanner1 = () => {
        if (bannersLoading) {
            return (
                <View style={styles.bannerWrapper}>
                    <View style={styles.bannerSkeleton}>
                        <ActivityIndicator size="small" color={B.accent} />
                    </View>
                </View>
            );
        }

        if (!ad1Banners || ad1Banners.length === 0) {
            return (
                <View style={styles.bannerWrapper}>
                    <LinearGradient
                        colors={['#e67e22', '#f39c12']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fallbackBanner}
                    >
                        <View style={styles.fallbackBannerContent}>
                            <Text style={styles.fallbackBannerBadge}>Limited Time Offer</Text>
                            <Text style={styles.fallbackBannerTitle}>Get 20% OFF on Home Services</Text>
                            <Text style={styles.fallbackBannerSubtitle}>Book trusted professionals and save more!</Text>
                            <TouchableOpacity style={styles.fallbackBannerButton}>
                                <Text style={styles.fallbackBannerButtonText}>Book Now →</Text>
                            </TouchableOpacity>
                        </View>
                        <MaterialIcons name="handyman" size={80} color="rgba(255,255,255,0.15)" style={styles.fallbackBannerIcon} />
                    </LinearGradient>
                </View>
            );
        }

        return (
            <View style={styles.bannerWrapper}>
                <HeroBanner banners={ad1Banners} autoScroll={true} />
            </View>
        );
    };

    const renderBanner2 = () => {
        if (bannersLoading) {
            return (
                <View style={styles.bannerWrapper}>
                    <View style={styles.bannerSkeleton}>
                        <ActivityIndicator size="small" color={B.accent} />
                    </View>
                </View>
            );
        }

        if (!ad2Banners || ad2Banners.length === 0) {
            return (
                <View style={styles.bannerWrapper}>
                    <LinearGradient
                        colors={['#9e95b3', '#1a043e']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fallbackBanner}
                    >
                        <View style={styles.fallbackBannerContent}>
                            <Text style={styles.fallbackBannerBadge}>✨ Premium Services</Text>
                            <Text style={styles.fallbackBannerTitle}>Expert Professionals at Your Doorstep</Text>
                            <Text style={styles.fallbackBannerSubtitle}>Quality service guaranteed with certified mistris</Text>
                            <TouchableOpacity style={[styles.fallbackBannerButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                <Text style={styles.fallbackBannerButtonText}>Explore →</Text>
                            </TouchableOpacity>
                        </View>
                        <MaterialIcons name="verified" size={80} color="rgba(255,255,255,0.15)" style={styles.fallbackBannerIcon} />
                    </LinearGradient>
                </View>
            );
        }

        return (
            <View style={styles.bannerWrapper}>
                <HeroBanner banners={ad2Banners} autoScroll={true} />
            </View>
        );
    };

    // ============================================
    // RENDER CATEGORIES
    // ============================================

    const renderCategories = () => {
        const categoriesToShow = searchQuery.trim() ? displayCategories : categories;

        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                        <Text style={styles.sectionTitle}>What are you looking for?</Text>
                    </View>
                </View>

                {categoriesLoading && !refreshing ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesHorizontalScroll}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                            <CategorySkeleton key={item} />
                        ))}
                    </ScrollView>
                ) : error ? (
                    <View style={styles.errorState}>
                        <MaterialIcons name="error-outline" size={40} color="#ef4444" />
                        <Text style={styles.errorTitle}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={refreshAllData}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : categoriesToShow.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="search-off" size={40} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>
                            {searchQuery.trim() ? 'No categories match your search' : 'No categories available'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesHorizontalScroll}
                    >
                        {categoriesToShow.slice(0, 12).map((category, index) => {
                            const iconColor = getCategoryColor(category, index);
                            const categoryName = getCategoryName(category);
                            const hasCustomIcon = category.iconUrl && category.iconUrl.length > 0;
                            const isImageFailed = failedImages[category.id];

                            const firstLetter = categoryName.charAt(0).toUpperCase();

                            return (
                                <TouchableOpacity
                                    key={category.id}
                                    style={styles.categoryCard}
                                    activeOpacity={0.7}
                                    onPress={() => openCategory(category)}
                                >
                                    <View style={[styles.categoryIconContainer, { backgroundColor: '#ffffff' }]}>
                                        {hasCustomIcon && !isImageFailed ? (
                                            <Image
                                                source={{ uri: category.iconUrl! }}
                                                style={styles.categoryCustomIcon}
                                                resizeMode="cover"  
                                                onError={() => {
                                                    setFailedImages(prev => ({ ...prev, [category.id]: true }));
                                                }}
                                            />
                                        ) : (
                                            <View style={[styles.categoryIconFallback, { backgroundColor: iconColor + '20' }]}>
                                                <Text style={[styles.categoryIconText, { color: iconColor }]}>
                                                    {firstLetter}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.categoryName} numberOfLines={1}>
                                        {categoryName}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}
            </View>
        );
    };

    const renderPopularServices = () => {
        const popularItems = popularServices.length > 0 
            ? popularServices 
            : allServiceItems.filter(s => s.isPopular).slice(0, 10);

        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                        <Text style={styles.sectionTitle}>Popular Services</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/services')}>
                        <Text style={[styles.seeAllText, { color: B.accent }]}>See All</Text>
                    </TouchableOpacity>
                </View>

                {popularServicesLoading && !refreshing ? (
                    <View style={styles.popularListContainer}>
                        {[1, 2, 3, 4].map((item) => (
                            <PopularServiceSkeleton key={item} />
                        ))}
                    </View>
                ) : popularItems.length === 0 ? (
                    <View style={styles.emptyPopularContainer}>
                        <MaterialIcons name="info-outline" size={28} color="#cbd5e1" />
                        <Text style={styles.emptySubtitle}>No popular services available</Text>
                    </View>
                ) : (
                    <View style={styles.popularListContainer}>
                        {popularItems.slice(0, 6).map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={styles.popularServiceCardRow}
                                activeOpacity={0.7}
                                onPress={() => openPopularService(service)}
                            >
                                <View style={styles.popularImageWrapper}>
                                    {service.imageUrl ? (
                                        <Image
                                            source={{ uri: service.imageUrl }}
                                            style={styles.popularServiceImageRow}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={[styles.popularServiceIconPlaceholderRow, { backgroundColor: B.accent + '08' }]}>
                                            <MaterialIcons name="build" size={28} color={B.accent} />
                                        </View>
                                    )}
                                </View>

                                <View style={styles.popularInfoContainerRow}>
                                    <View style={styles.serviceNameRow}>
                                        <Text style={styles.popularServiceNameRow} numberOfLines={1}>
                                            {service.name}
                                        </Text>
                                        {service.isPopular && (
                                            <View style={styles.popularBadge}>
                                                <MaterialIcons name="star" size={10} color="#faad14" />
                                                <Text style={styles.popularBadgeText}>Popular</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.popularServiceDescriptionRow} numberOfLines={2}>
                                        {service.description || 'Professional service at your doorstep'}
                                    </Text>
                                    <View style={styles.priceRow}>
                                        <Text style={styles.popularServicePriceLabelRow}>Starting from</Text>
                                        <Text style={styles.popularServicePriceRow}>
                                            रु {typeof service.price === 'string' ? parseFloat(service.price).toLocaleString() : service.price.toLocaleString()}
                                        </Text>
                                    </View>
                                </View>

                                <LinearGradient
                                    colors={[B.accent, B.accent + 'CC']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.popularBookButtonRow}
                                >
                                    <Text style={styles.popularBookTextRow}>Book</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    return (
        <SafeAreaContainer style={styles.safeRoot} showBottomNav>
            <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />

            <Animated.View style={[
                styles.header,
                {
                    opacity: headerOpacity,
                    shadowOpacity: scrollY.interpolate({
                        inputRange: [0, 40],
                        outputRange: [0, 0.05],
                        extrapolate: 'clamp',
                    }),
                }
            ]}>
                <View style={styles.headerLeft}>
                    <Text style={styles.greeting}>Namaste, {user?.fullName?.split(' ')[0] || 'Guest'} 👋</Text>
                    <View style={styles.locationContainer}>
                        <Ionicons name="location" size={14} color={B.accent} />
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {locationLoading ? 'Detecting location...' : (address || 'Kathmandu, Nepal')}
                        </Text>
                        <Ionicons name="chevron-down" size={12} color="#94a3b8" />
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.avatar, brandStyles.avatar]}
                    onPress={() => router.push('/(protected)/(customer)/settings')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.avatarText}>{user?.fullName ? getInitials(user.fullName) : 'U'}</Text>
                </TouchableOpacity>
            </Animated.View>

            <Animated.ScrollView
                ref={scrollViewRef}
                style={styles.content}
                contentContainerStyle={styles.scrollInner}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[B.accent]}
                        tintColor={B.accent}
                    />
                }
            >
                {renderSearchBar()}
                {renderBanner1()}
                {renderQuickActions()}
                {renderBanner2()}
                {renderCategories()}
                {renderPopularServices()}

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleContainer}>
                            <Ionicons name="time" size={20} color={B.accent} />
                            <Text style={styles.sectionTitle}>Recent Order</Text>
                        </View>
                        {recentRequest && (
                            <TouchableOpacity onPress={handleTrackRecentOrder}>
                                <Text style={[styles.seeAllText, { color: B.accent }]}>View Details</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {renderRecentOrder()}
                </View>
            </Animated.ScrollView>

            {/* Video Modal */}
            <Modal
                visible={showVideoModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowVideoModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity
                            onPress={() => setShowVideoModal(false)}
                            style={styles.modalCloseButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={24} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Video</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    {selectedVideoUrl && (
                        <WebView
                            source={{ uri: selectedVideoUrl }}
                            style={styles.webview}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            allowsFullscreenVideo={true}
                            startInLoadingState={true}
                            renderLoading={() => (
                                <ActivityIndicator color={B.accent} size="large" style={styles.modalLoader} />
                            )}
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaContainer>
    );
}

// ============================================
// STYLES - Same as before (no changes needed)
// ============================================

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        shadowOpacity: 0,
        elevation: 0,
    },
    headerLeft: {
        flex: 1,
        gap: 4,
    },
    greeting: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    content: {
        flex: 1,
    },
    scrollInner: {
        paddingBottom: 100,
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginTop: 16,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
        borderWidth: 1,
        borderColor: '#e8edf2',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '500',
        paddingVertical: 0,
    },
    bannerWrapper: {
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        height: 160,
    },
    bannerSkeleton: {
        height: 160,
        backgroundColor: '#e2e8f0',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackBanner: {
        height: 160,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        overflow: 'hidden',
    },
    fallbackBannerContent: {
        flex: 1,
        gap: 6,
    },
    fallbackBannerBadge: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        opacity: 0.9,
    },
    fallbackBannerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.3,
    },
    fallbackBannerSubtitle: {
        fontSize: 12,
        color: '#fff',
        opacity: 0.85,
    },
    fallbackBannerButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
    },
    fallbackBannerButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    fallbackBannerIcon: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        opacity: 0.15,
    },
    quickActionsSection: {
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    quickActionCard: {
        alignItems: 'center',
        flex: 1,
    },
    quickActionIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickActionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
    },
    categoriesHorizontalScroll: {
        paddingHorizontal: 20,
        gap: 4,
    },
    categoryCardSkeleton: {
        alignItems: 'center',
        marginRight: 16,
    },
    skeletonIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#e2e8f0',
        marginBottom: 8,
    },
    skeletonText: {
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
    },
    categoryCard: {
        alignItems: 'center',
        marginRight: 16,
        width: 80,
    },
    categoryIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    categoryCustomIcon: {
        width: '100%',
        height: '100%',
        borderRadius: 20, 
    },
    categoryIconFallback: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryIconText: {
        fontSize: 24,
        fontWeight: '800',
    },
    categoryName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
    },
    errorState: {
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        marginBottom: 12,
    },
    retryButton: {
        backgroundColor: '#e67e22',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
    },
    popularListContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    popularServiceCardRow: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f8fafc',
    },
    skeletonPopularImageRow: {
        width: 76,
        height: 76,
        borderRadius: 14,
        backgroundColor: '#e2e8f0',
    },
    popularImageWrapper: {
        marginRight: 12,
    },
    popularServiceImageRow: {
        width: 76,
        height: 76,
        borderRadius: 14,
    },
    popularServiceIconPlaceholderRow: {
        width: 76,
        height: 76,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popularInfoContainerRow: {
        flex: 1,
    },
    serviceNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    popularServiceNameRow: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        flex: 1,
    },
    popularBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 8,
        gap: 2,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#d97706',
    },
    popularServiceDescriptionRow: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 6,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    popularServicePriceLabelRow: {
        fontSize: 11,
        color: '#94a3b8',
    },
    popularServicePriceRow: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    popularBookButtonRow: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginLeft: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popularBookTextRow: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    skeletonButtonRow: {
        width: 60,
        height: 32,
        borderRadius: 12,
        backgroundColor: '#e2e8f0',
        marginLeft: 12,
    },
    emptyPopularContainer: {
        alignItems: 'center',
        padding: 20,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
    },
    recentOrderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#f0f2f5',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    recentOrderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    recentOrderIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentOrderInfo: {
        flex: 1,
    },
    recentOrderTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    recentOrderStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    recentOrderStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    recentOrderStatus: {
        fontSize: 12,
        fontWeight: '500',
    },
    recentOrderArrow: {
        padding: 4,
    },
    recentOrderDivider: {
        height: 1,
        backgroundColor: '#f0f2f5',
        marginVertical: 12,
    },
    recentOrderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    recentOrderFooterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    recentOrderFooterText: {
        fontSize: 12,
        color: '#64748b',
        flex: 1,
    },
    recentOrderSubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        marginLeft: 52,
    },
    recentOrderTrackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingVertical: 10,
        backgroundColor: '#fff7ed',
        borderRadius: 10,
        gap: 6,
    },
    recentOrderTrackText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ea580c',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#0f172a',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});