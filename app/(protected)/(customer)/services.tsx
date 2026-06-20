import React, {
    useEffect,
    useState,
    useCallback,
    useRef,
    useMemo,
} from 'react';

import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    RefreshControl,
    Animated,
    Dimensions,
    TextInput,
    Modal,
    StatusBar,
} from 'react-native';

import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { customerBrand as B, customerDashboardColors as C } from '../../../lib/customerDashboardTokens';

const { width: screenWidth } = Dimensions.get('window');

interface ServiceItem {
    id: string;
    name: string;
    description: string | null;
    price: number | string;
    imageUrl: string | null;
    isPopular?: boolean;
    categoryName?: string;
}

interface CategoryGroup {
    categoryId: number;
    categoryName: string;
    services: ServiceItem[];
}

export default function ServicesScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [categories, setCategories] = useState<CategoryGroup[]>([]);
    const [popularServices, setPopularServices] = useState<ServiceItem[]>([]);
    const [allServices, setAllServices] = useState<ServiceItem[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<ServiceItem[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);

    const fetchAllMarketplaceServices = async () => {
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok) {
                let formattedGroups: CategoryGroup[] = [];
                let allServicesList: ServiceItem[] = [];

                if (data && Array.isArray(data.categories)) {
                    formattedGroups = data.categories;
                    data.categories.forEach((category: any) => {
                        if (category.services && Array.isArray(category.services)) {
                            category.services.forEach((service: any) => {
                                allServicesList.push({
                                    ...service,
                                    isPopular: service.isPopular || false,
                                    categoryName: category.categoryName,
                                });
                            });
                        }
                    });
                } else if (Array.isArray(data)) {
                    formattedGroups = data;
                } else if (data && Array.isArray(data.data)) {
                    formattedGroups = data.data;
                }

                setCategories(formattedGroups);
                setAllServices(allServicesList);

                const popular = allServicesList.filter(s => s.isPopular === true);
                setPopularServices(popular.slice(0, 10));
            } else {
                setCategories([]);
                setAllServices([]);
                setPopularServices([]);
            }
        } catch (error) {
            console.log('Error fetching services:', error);
            setCategories([]);
            setAllServices([]);
            setPopularServices([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAllMarketplaceServices();
    }, []);

    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const results = allServices.filter(service =>
                service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (service.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (service.categoryName?.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, allServices]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAllMarketplaceServices();
    }, []);

    const handleServiceNavigation = (item: ServiceItem) => {
        setShowSearchModal(false);
        setSearchQuery('');
        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: item.id,
                name: item.name,
                price: item.price.toString(),
                description: item.description || '',
                imageUrl: item.imageUrl || ''
            },
        });
    };

    const handleSeeAllPopular = () => {
        router.push('/popular-services');
    };

    const openSearch = () => {
        setShowSearchModal(true);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 300);
    };

    const closeSearch = () => {
        setShowSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const getCategoryColor = (index: number) => {
        const colors = ['#FF6B6B', '#4A90E2', '#4CAF50', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4', '#FF5722'];
        return colors[index % colors.length];
    };

    const renderService = ({ item, index }: { item: ServiceItem; index: number }) => {
        const parsedPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
        const color = getCategoryColor(index);

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => handleServiceNavigation(item)}
            >
                <View style={styles.cardImageWrapper}>
                    {item.imageUrl ? (
                        <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.cardImage}
                        />
                    ) : (
                        <LinearGradient
                            colors={[color + '20', color + '10']}
                            style={styles.cardImagePlaceholder}
                        >
                            <MaterialIcons name="build" size={40} color={color} />
                        </LinearGradient>
                    )}

                    {item.isPopular && (
                        <View style={styles.popularBadge}>
                            <MaterialIcons name="star" size={10} color="#fff" />
                            <Text style={styles.popularBadgeText}>Popular</Text>
                        </View>
                    )}

                    {item.categoryName && (
                        <View style={[styles.categoryTag, { backgroundColor: color + '20' }]}>
                            <Text style={[styles.categoryTagText, { color: color }]}>
                                {item.categoryName}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardBody}>
                    <Text style={styles.serviceName} numberOfLines={1}>
                        {item.name}
                    </Text>

                    <Text numberOfLines={2} style={styles.description}>
                        {item.description || 'Professional service at your doorstep.'}
                    </Text>

                    <View style={styles.footer}>
                        <View>
                            <Text style={styles.priceLabel}>Starting from</Text>
                            <Text style={[styles.price, { color: B.accent }]}>
                                रु {parsedPrice ? parsedPrice.toLocaleString() : 0}
                            </Text>
                        </View>

                        <LinearGradient
                            colors={[B.accent, B.accent + 'CC']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bookButton}
                        >
                            <Text style={styles.bookButtonText}>Book</Text>
                            <MaterialIcons name="arrow-forward" size={14} color="#fff" />
                        </LinearGradient>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderPopularService = ({ item }: { item: ServiceItem }) => {
        const parsedPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                style={styles.popularCard}
                onPress={() => handleServiceNavigation(item)}
            >
                <LinearGradient
                    colors={[B.accent + '15', B.accent + '05']}
                    style={styles.popularCardGradient}
                >
                    <View style={styles.popularCardLeft}>
                        {item.imageUrl ? (
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.popularImage}
                            />
                        ) : (
                            <View style={[styles.popularImagePlaceholder, { backgroundColor: `${B.accent}10` }]}>
                                <MaterialIcons name="build" size={28} color={B.accent} />
                            </View>
                        )}
                    </View>

                    <View style={styles.popularCardBody}>
                        <View style={styles.popularHeader}>
                            <Text style={styles.popularName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <View style={styles.popularMiniBadge}>
                                <MaterialIcons name="star" size={10} color="#faad14" />
                            </View>
                        </View>

                        <Text style={styles.popularDescription} numberOfLines={1}>
                            {item.description || 'Professional service'}
                        </Text>

                        <View style={styles.popularPriceRow}>
                            <Text style={styles.popularPriceLabel}>From</Text>
                            <Text style={[styles.popularPrice, { color: B.accent }]}>
                                रु {parsedPrice ? parsedPrice.toLocaleString() : 0}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.popularArrow}>
                        <MaterialIcons name="chevron-right" size={24} color={B.accent} />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderSearchResult = ({ item }: { item: ServiceItem }) => {
        const parsedPrice = typeof item.price === 'string' ? parseFloat(item.price) : item.price;

        return (
            <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleServiceNavigation(item)}
            >
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.searchResultImage} />
                ) : (
                    <View style={[styles.searchResultImagePlaceholder, { backgroundColor: `${B.accent}10` }]}>
                        <MaterialIcons name="build" size={24} color={B.accent} />
                    </View>
                )}

                <View style={styles.searchResultBody}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    {item.categoryName && (
                        <Text style={styles.searchResultCategory}>{item.categoryName}</Text>
                    )}
                    <Text style={[styles.searchResultPrice, { color: B.accent }]}>
                        रु {parsedPrice ? parsedPrice.toLocaleString() : 0}
                    </Text>
                </View>

                {item.isPopular && (
                    <View style={styles.searchResultBadge}>
                        <Text style={styles.searchResultBadgeText}>Popular</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderPopularServicesSection = () => {
        if (popularServices.length === 0) return null;

        return (
            <View style={styles.popularSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Popular Services</Text>
                </View>

                <View style={styles.popularList}>
                    {popularServices.slice(0, 4).map((item) => (
                        <View key={item.id}>
                            {renderPopularService({ item })}
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [1, 0.96],
        extrapolate: 'clamp',
    });

    if (loading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color={B.accent} />
            </View>
        );
    }

    return (
        <SafeAreaContainer style={styles.safeContainer} showBottomNav={true}>
            <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />

            <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerSubtitle}>Discover</Text>
                        <Text style={styles.headerTitle}>Services</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.searchIcon}
                        onPress={openSearch}
                        activeOpacity={0.8}
                    >
                        <Feather name="search" size={22} color="#1e293b" />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Animated.ScrollView
                style={styles.container}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollInner}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[B.accent]}
                        tintColor={B.accent}
                    />
                }
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >

                {/* Hero Banner */}
                <LinearGradient
                    colors={[B.accent + '20', B.accent + '08']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroBanner}
                >
                    <View style={styles.heroContent}>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>🔥 Featured</Text>
                        </View>
                        <Text style={styles.heroTitle}>Find the Best{'\n'}Professional Services</Text>
                        <Text style={styles.heroSubtitle}>
                            Browse through our curated list of{'\n'}trusted professionals
                        </Text>
                        <View style={styles.heroStats}>
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatNumber}>{allServices.length}+</Text>
                                <Text style={styles.heroStatLabel}>Services</Text>
                            </View>
                            <View style={styles.heroStatDivider} />
                            <View style={styles.heroStat}>
                                <Text style={styles.heroStatNumber}>{categories.length}</Text>
                                <Text style={styles.heroStatLabel}>Categories</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroIconContainer}>
                        <MaterialIcons name="handyman" size={80} color={B.accent + '15'} />
                    </View>
                </LinearGradient>

                {/* Popular Services Section */}
                {renderPopularServicesSection()}

                {/* All Categories */}
                {categories.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="grid-off" size={48} color="#94a3b8" />
                        <Text style={styles.emptyText}>No service listings found</Text>
                    </View>
                ) : (
                    categories.map((category, index) => {
                        if (!category.services || category.services.length === 0) return null;
                        const color = getCategoryColor(index);

                        return (
                            <View key={category.categoryId} style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={styles.categoryHeaderLeft}>
                                        <View style={[styles.categoryDot, { backgroundColor: color }]} />
                                        <Text style={styles.categoryTitle}>
                                            {category.categoryName}
                                        </Text>
                                    </View>
                                    <Text style={styles.count}>
                                        {category.services.length} {category.services.length === 1 ? 'service' : 'services'}
                                    </Text>
                                </View>

                                <FlatList
                                    horizontal
                                    data={category.services}
                                    renderItem={({ item, index: idx }) => renderService({ item, index: idx })}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalScrollPadding}
                                    snapToInterval={234}
                                    snapToAlignment="start"
                                    decelerationRate="fast"
                                />
                            </View>
                        );
                    })
                )}

                {/* Bottom Spacer */}
                <View style={styles.bottomSpacer} />
            </Animated.ScrollView>

            {/* Search Modal */}
            <Modal
                visible={showSearchModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeSearch}
            >
                <View style={styles.searchModalContainer}>
                    <View style={styles.searchModalContent}>
                        <View style={styles.searchModalHeader}>
                            <TouchableOpacity
                                onPress={closeSearch}
                                style={styles.searchModalBack}
                            >
                                <Ionicons name="arrow-back" size={24} color="#1e293b" />
                            </TouchableOpacity>
                            <View style={styles.searchModalInputWrapper}>
                                <Feather name="search" size={20} color="#94a3b8" />
                                <TextInput
                                    ref={searchInputRef}
                                    style={styles.searchModalInput}
                                    placeholder="Search for services..."
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus={true}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <Ionicons name="close-circle" size={20} color="#94a3b8" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {searchQuery.length > 0 && (
                            <View style={styles.searchResultsContainer}>
                                {searchResults.length > 0 ? (
                                    <FlatList
                                        data={searchResults}
                                        renderItem={renderSearchResult}
                                        keyExtractor={(item) => item.id.toString()}
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={styles.searchResultsList}
                                        ItemSeparatorComponent={() => (
                                            <View style={styles.searchResultSeparator} />
                                        )}
                                    />
                                ) : (
                                    <View style={styles.noSearchResults}>
                                        <MaterialIcons name="search-off" size={48} color="#94a3b8" />
                                        <Text style={styles.noSearchResultsText}>No services found</Text>
                                        <Text style={styles.noSearchResultsSubtext}>
                                            Try adjusting your search terms
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
    },
    scrollInner: {
        paddingBottom: 110,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    header: {
        backgroundColor: '#ffffff',
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    searchIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickSearchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e8edf2',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
        gap: 12,
    },
    quickSearchText: {
        flex: 1,
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '400',
    },
    quickSearchShortcut: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    quickSearchShortcutText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
    },
    heroBanner: {
        marginHorizontal: 20,
        marginBottom: 24,
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: B.accent + '10',
    },
    heroContent: {
        flex: 1,
    },
    heroBadge: {
        backgroundColor: B.accent + '20',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    heroBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: B.accent,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
        lineHeight: 28,
    },
    heroSubtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        marginBottom: 12,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    heroStat: {
        alignItems: 'center',
    },
    heroStatNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    heroStatLabel: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
    },
    heroStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#e8edf2',
    },
    heroIconContainer: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        opacity: 0.4,
    },
    popularSection: {
        marginBottom: 28,
        paddingHorizontal: 20,
    },
    popularList: {
        marginTop: 4,
        gap: 8,
    },
    popularCard: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 8,
    },
    popularCardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: B.accent + '10',
    },
    popularCardLeft: {
        marginRight: 12,
    },
    popularImage: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    popularImagePlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popularCardBody: {
        flex: 1,
    },
    popularHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    popularName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        flex: 1,
    },
    popularMiniBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    popularDescription: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    popularPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    popularPriceLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    popularPrice: {
        fontSize: 14,
        fontWeight: '700',
    },
    popularArrow: {
        paddingLeft: 8,
    },
    section: {
        marginBottom: 28,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: '600',
    },
    categoryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    categoryTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    count: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    horizontalScrollPadding: {
        paddingLeft: 20,
        paddingRight: 4,
    },
    card: {
        width: 240,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginRight: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 4,
    },
    cardImageWrapper: {
        position: 'relative',
        height: 140,
    },
    cardImage: {
        width: '100%',
        height: 140,
        backgroundColor: '#f1f5f9',
        resizeMode: 'cover',
    },
    cardImagePlaceholder: {
        width: '100%',
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popularBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: B.accent,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    popularBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#ffffff',
    },
    categoryTag: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    categoryTagText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cardBody: {
        padding: 14,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    description: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 16,
        height: 32,
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    priceLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '500',
    },
    price: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    bookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    bookButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '500',
    },
    bottomSpacer: {
        height: 20,
    },
    // Search Modal Styles
    searchModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    searchModalContent: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: 40,
        overflow: 'hidden',
    },
    searchModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 12,
    },
    searchModalBack: {
        padding: 4,
    },
    searchModalInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 10,
    },
    searchModalInput: {
        flex: 1,
        fontSize: 16,
        color: '#0f172a',
        paddingVertical: 4,
    },
    searchResultsContainer: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    searchResultsList: {
        paddingBottom: 16,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    searchResultImage: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    searchResultImagePlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchResultBody: {
        flex: 1,
    },
    searchResultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    searchResultCategory: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 1,
    },
    searchResultPrice: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    searchResultBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    searchResultBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#d97706',
    },
    searchResultSeparator: {
        height: 1,
        backgroundColor: '#f1f5f9',
    },
    noSearchResults: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    noSearchResultsText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    noSearchResultsSubtext: {
        fontSize: 14,
        color: '#94a3b8',
    },
    searchSuggestions: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    searchSuggestionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 12,
    },
    searchSuggestionsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    searchChip: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e8edf2',
    },
    searchChipText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
});