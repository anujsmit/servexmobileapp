// app/(protected)/(customer)/dashboard.tsx - Full updated file

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
import { useCustomerRequestsQuery } from '../../../hooks/queries';
import { useServices } from '../../../context/ServicesContext';

const { width: screenWidth } = Dimensions.get('window');

interface ServiceCategory {
    id: number;
    serviceName: string;
    description?: string;
    customIconUrl?: string | null;
    iconColor?: string;
    mapIconColor?: string;
    isActive?: boolean;
}

interface PlatformService {
    id: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
    serviceId?: number;
    categoryName?: string;
    isPopular?: boolean;
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

export default function CustomerDashboard() {
    const { user, token, refreshAccessToken, logout } = useAuth();
    const { address, isLoading: locationLoading, refetch: refetchLocation } = useLocation();
    const router = useRouter();
    const { getServiceByName, getServiceColor, getServiceIcon } = useServices();

    const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useCustomerRequestsQuery();

    const [categories, setCategories] = useState<ServiceCategory[]>([]);
    const [popularServices, setPopularServices] = useState<PlatformService[]>([]);
    const [ad1Banners, setAd1Banners] = useState<Banner[]>([]);
    const [ad2Banners, setAd2Banners] = useState<Banner[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [popularServicesLoading, setPopularServicesLoading] = useState(true);
    const [bannersLoading, setBannersLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
    const [filteredCategories, setFilteredCategories] = useState<ServiceCategory[]>([]);
    const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

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

    useEffect(() => {
        fetchCategories();
        fetchPopularServices();
        fetchBanners();
    }, []);

    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = categories.filter(category =>
                category.serviceName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredCategories(filtered);
        } else {
            setFilteredCategories(categories);
        }
    }, [searchQuery, categories]);

    const fetchCategories = async () => {
        try {
            setCategoriesLoading(true);
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/services`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                let categoriesData = [];
                if (Array.isArray(data)) categoriesData = data;
                else if (Array.isArray(data.services)) categoriesData = data.services;
                else if (Array.isArray(data.categories)) categoriesData = data.categories;
                else if (Array.isArray(data.data)) categoriesData = data.data;

                const mappedCategories = categoriesData.map(cat => ({
                    id: cat.id,
                    serviceName: cat.serviceName || cat.name,
                    description: cat.description,
                    customIconUrl: cat.customIconUrl || cat.custom_icon_url || null,
                    iconColor: cat.iconColor || cat.icon_color || cat.mapIconColor || '#e67e22',
                    isActive: cat.isActive !== false,
                }));

                const activeCategories = mappedCategories.filter(cat => cat.isActive);
                setCategories(activeCategories);
                setFilteredCategories(activeCategories);
            } else {
                setCategories([]);
            }
        } catch (error) {
            console.log('Failed to fetch categories:', error);
            setCategories([]);
        } finally {
            setCategoriesLoading(false);
        }
    };

    const fetchPopularServices = async () => {
        try {
            setPopularServicesLoading(true);
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services/popular`);
            const data = await response.json();

            if (response.ok && data.success && data.services) {
                const popularServicesList = data.services.map((service: any) => ({
                    id: service.id,
                    name: service.name,
                    description: service.description,
                    price: service.price,
                    imageUrl: service.imageUrl,
                    serviceId: service.categoryId,
                    categoryName: service.categoryName,
                    isPopular: true,
                }));
                setPopularServices(popularServicesList.slice(0, 10));
            } else {
                console.log('Popular endpoint not found, falling back to filter all services');
                const fallbackResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services`);
                const fallbackData = await fallbackResponse.json();

                if (fallbackResponse.ok && fallbackData.categories) {
                    const allServices: PlatformService[] = [];
                    fallbackData.categories.forEach((category: any) => {
                        if (category.services && Array.isArray(category.services)) {
                            category.services.forEach((service: any) => {
                                if (service.isPopular === true) {
                                    allServices.push({
                                        id: service.id,
                                        name: service.name,
                                        description: service.description,
                                        price: service.price,
                                        imageUrl: service.imageUrl,
                                        serviceId: category.categoryId,
                                        categoryName: category.categoryName,
                                        isPopular: true,
                                    });
                                }
                            });
                        }
                    });
                    setPopularServices(allServices.slice(0, 10));
                } else {
                    setPopularServices([]);
                }
            }
        } catch (error) {
            console.log('Failed to fetch popular services:', error);
            setPopularServices([]);
        } finally {
            setPopularServicesLoading(false);
        }
    };

    const fetchBanners = async () => {
        try {
            setBannersLoading(true);

            const ad1Response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/hero-banners/type/ad1`);
            const ad1Data = await ad1Response.json();
            if (ad1Data.success && ad1Data.banners && ad1Data.banners.length > 0) {
                setAd1Banners(ad1Data.banners);
            } else {
                setAd1Banners([]);
            }

            const ad2Response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/hero-banners/type/ad2`);
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
            fetchCategories(),
            fetchPopularServices(),
            fetchBanners(),
            refetchRequests(),
        ]);
        setRefreshing(false);
    };

    const onRefresh = useCallback(() => { refreshAllData(); }, []);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getCategoryColor = (category: ServiceCategory, index: number) => {
        if (category.iconColor) return category.iconColor;
        if (category.mapIconColor) return category.mapIconColor;
        const colors = ['#FF6B6B', '#4A90E2', '#4CAF50', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4'];
        return colors[index % colors.length];
    };

    const openCategory = (category: ServiceCategory) => {
        router.push({
            pathname: '/category/[id]',
            params: {
                id: category.id.toString(),
                name: category.serviceName,
                serviceId: category.id.toString()
            },
        });
    };

    const openPopularService = (service: PlatformService) => {
        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: service.id,
                name: service.name,
                price: service.price,
                description: service.description || '',
                imageUrl: service.imageUrl || ''
            },
        });
    };

    const handleTrackRecentOrder = () => {
        if (recentRequest) {
            router.push(`/requests/${recentRequest.id}`);
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
                            name={getServiceIcon(recentRequest.type, true)}
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
            id: 'emergency',
            icon: 'bolt',
            label: 'Emergency',
            color: '#dc2626',
            route: '/emergency'
        },
        {
            id: 'my_bookings',
            icon: 'calendar-check',
            label: 'My Bookings',
            route: '/requests'
        },
        {
            id: 'track_order',
            icon: 'map-marker-alt',
            label: 'Track Order',
            color: B.accent,
            onPress: handleTrackRecentOrder
        },
    ];

    const renderQuickActions = () => (
        <View style={styles.quickActionsSection}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
                {quickActions.map((action) => (
                    <TouchableOpacity
                        key={action.id}
                        style={styles.quickActionCard}
                        onPress={action.onPress || (() => router.push(action.route as any))}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.quickActionIconWrapper, { backgroundColor: (action.color || B.accent) + '15' }]}>
                            <FontAwesome5 name={action.icon} size={20} color={action.color || B.accent} />
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

    const renderCategories = () => (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>What are you looking for?</Text>
                </View>
            </View>

            {categoriesLoading && !refreshing ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesHorizontalScroll}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <CategorySkeleton key={item} />)}
                </ScrollView>
            ) : filteredCategories.length === 0 ? (
                <View style={styles.emptyState}>
                    <MaterialIcons name="search-off" size={40} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No categories found</Text>
                </View>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesHorizontalScroll}
                >
                    {filteredCategories.slice(0, 12).map((category, index) => {
                        const iconColor = getCategoryColor(category, index);
                        const hasCustomIcon = category.customIconUrl && category.customIconUrl.length > 0;
                        const isImageFailed = failedImages[category.id];

                        return (
                            <TouchableOpacity
                                key={category.id}
                                style={styles.categoryCard}
                                activeOpacity={0.7}
                                onPress={() => openCategory(category)}
                            >
                                <View style={[
                                    styles.categoryIconContainer,
                                    { backgroundColor: iconColor + '15' }
                                ]}>
                                    {hasCustomIcon && !isImageFailed ? (
                                        <Image
                                            source={{ uri: category.customIconUrl! }}
                                            style={styles.categoryCustomIcon}
                                            resizeMode="contain"
                                            onError={() => {
                                                setFailedImages(prev => ({ ...prev, [category.id]: true }));
                                            }}
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={[iconColor + '80', iconColor + '20']}
                                            style={styles.categoryIconGradient}
                                        >
                                            <Text style={[styles.categoryInitialText, { color: '#fff' }]}>
                                                {category.serviceName?.charAt(0).toUpperCase()}
                                            </Text>
                                        </LinearGradient>
                                    )}
                                </View>
                                <Text style={styles.categoryName} numberOfLines={1}>
                                    {category.serviceName}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );

    const renderPopularServices = () => (
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
            ) : popularServices.length === 0 ? (
                <View style={styles.emptyPopularContainer}>
                    <MaterialIcons name="info-outline" size={28} color="#cbd5e1" />
                    <Text style={styles.emptySubtitle}>No popular services available</Text>
                </View>
            ) : (
                <View style={styles.popularListContainer}>
                    {popularServices.map((service) => (
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
                                        रु {parseFloat(service.price).toLocaleString()}
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

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: '#f8fafc',
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
        borderRadius: 20,
        overflow: 'hidden',
        height: 180,
    },
    bannerSkeleton: {
        height: 180,
        backgroundColor: '#e2e8f0',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fallbackBanner: {
        height: 180,
        borderRadius: 20,
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
        gap: 6,
        paddingVertical: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    recentOrderTrackText: {
        fontSize: 13,
        fontWeight: '600',
        color: B.accent,
    },
    quickActionsSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    quickActionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 12,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quickActionCard: {
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    quickActionIconWrapper: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: '#475569',
        textAlign: 'center',
    },
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 20,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    categoriesHorizontalScroll: {
        paddingLeft: 20,
        paddingRight: 12,
        gap: 12,
    },
    categoryCard: {
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
        width: 88,
        minHeight: 110,
        justifyContent: 'center',
    },
    categoryCardSkeleton: {
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        width: 88,
        minHeight: 110,
        justifyContent: 'center',
    },
    categoryIconContainer: {
        width: 54,
        height: 54,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
        overflow: 'hidden',
    },
    categoryIconGradient: {
        width: 54,
        height: 54,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryCustomIcon: {
        width: 54,
        height: 54,
        borderRadius: 8,
    },
    categoryInitialText: {
        fontSize: 22,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        color: '#fff',
    },
    categoryName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        textAlign: 'center',
        marginTop: 2,
    },
    popularListContainer: {
        paddingHorizontal: 20,
        gap: 12,
    },
    popularServiceCardRow: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: '#f0f2f5',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
        alignItems: 'center',
        gap: 14,
    },
    popularImageWrapper: {
        width: 80,
        height: 80,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
    },
    popularServiceImageRow: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    popularServiceIconPlaceholderRow: {
        width: 80,
        height: 80,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    popularInfoContainerRow: {
        flex: 1,
        gap: 4,
    },
    serviceNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    popularServiceNameRow: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    popularBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#d97706',
    },
    popularServiceDescriptionRow: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginTop: 4,
    },
    popularServicePriceLabelRow: {
        fontSize: 11,
        color: '#94a3b8',
    },
    popularServicePriceRow: {
        fontSize: 16,
        fontWeight: '700',
        color: '#e67e22',
    },
    popularBookButtonRow: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    popularBookTextRow: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    emptyState: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingVertical: 32,
        marginHorizontal: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f0f2f5',
    },
    emptyPopularContainer: {
        paddingVertical: 24,
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: '#f0f2f5',
    },
    emptyTitle: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#94a3b8',
    },
    skeletonIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
    },
    skeletonPopularImageRow: {
        width: 80,
        height: 80,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
    },
    skeletonText: {
        height: 10,
        borderRadius: 5,
        backgroundColor: '#e2e8f0',
    },
    skeletonButtonRow: {
        width: 70,
        height: 36,
        borderRadius: 30,
        backgroundColor: '#e2e8f0',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#0a0c10',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
        backgroundColor: '#1a1e26',
        paddingTop: Platform.OS === 'ios' ? 10 : 0,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: '#2d3340',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000000',
    },
    modalLoader: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -15 }, { translateY: -15 }],
    },
});