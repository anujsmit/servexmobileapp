// app/(protected)/(customer)/services/index.tsx

import React, {
    useEffect,
    useState,
    useCallback,
    useRef,
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
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { customerBrand as B } from '../../../lib/customerDashboardTokens';

const { width: screenWidth } = Dimensions.get('window');

/* ─── Types ─── */
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

interface CategoryGroup {
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
    hierarchy: CategoryGroup[];
    popularServices: ServiceItem[];
    totalCategories: number;
    totalItems: number;
}

/* ─── Helpers ─── */
const PALETTE = [
    '#6366f1', '#f43f5e', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444',
];

const categoryColor = (i: number) => PALETTE[i % PALETTE.length];

const formatPrice = (price: number | string) => {
    const n = typeof price === 'string' ? parseFloat(price) : price;
    return `रु ${n ? n.toLocaleString() : 0}`;
};

/* ─── Skeleton ─── */
function SkeletonBlock({ w, h, r = 12, mb = 0 }: { w: number | string; h: number; r?: number; mb?: number }) {
    return (
        <View
            style={{
                width: w,
                height: h,
                borderRadius: r,
                backgroundColor: '#e2e8f0',
                marginBottom: mb,
            }}
        />
    );
}

function SkeletonScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: 60 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                <SkeletonBlock w={100} h={12} r={6} mb={6} />
                <SkeletonBlock w={140} h={28} r={6} />
            </View>

            <View
                style={{
                    marginHorizontal: 20,
                    height: 170,
                    borderRadius: 24,
                    backgroundColor: '#e2e8f0',
                    marginBottom: 28,
                }}
            />

            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <SkeletonBlock w={160} h={22} r={6} mb={14} />
                {[1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#fff',
                            borderRadius: 16,
                            padding: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: '#f1f5f9',
                            gap: 14,
                        }}
                    >
                        <SkeletonBlock w={52} h={52} r={14} />
                        <View style={{ flex: 1 }}>
                            <SkeletonBlock w={160} h={16} r={4} mb={6} />
                            <SkeletonBlock w={100} h={12} r={4} mb={6} />
                            <SkeletonBlock w={70} h={14} r={4} />
                        </View>
                    </View>
                ))}
            </View>

            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <SkeletonBlock w={180} h={22} r={6} mb={14} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, gap: 14 }}>
                {[1, 2, 3].map((i) => (
                    <View key={i}>
                        <SkeletonBlock w={220} h={300} r={20} />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

/* ─── Main Screen ─── */
export default function ServicesScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState<CategoryGroup[]>([]);
    const [popularServices, setPopularServices] = useState<ServiceItem[]>([]);
    const [allServices, setAllServices] = useState<ServiceItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ServiceItem[]>([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const searchFadeAnim = useRef(new Animated.Value(0)).current;


    // app/(protected)/(customer)/services/index.tsx

    const fetchServices = async () => {
        try {
            // Try the new hierarchy endpoint
            // Option A: If you used Fix 2 (recommended)
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/public/service-hierarchy`;

            // Option B: If you used Fix 1
            // const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services/service-hierarchy`;

            console.log('[Services] Fetching from:', url);

            const res = await fetch(url);
            console.log('[Services] Response status:', res.status);

            if (!res.ok) {
                console.error('[Services] HTTP error:', res.status);
                // Fallback to platform services
                return fetchPlatformServices();
            }

            const data = await res.json();
            console.log('[Services] Data received:', data.success ? 'Success' : 'Failed');

            if (data.success) {
                setCategories(data.hierarchy || []);

                // Flatten all items for search
                const flat: ServiceItem[] = [];
                (data.hierarchy || []).forEach((cat: any) => {
                    (cat.subCategories || []).forEach((sub: any) => {
                        (sub.items || []).forEach((item: any) => {
                            flat.push({
                                ...item,
                                categoryName: cat.name,
                                categoryId: cat.id,
                            });
                        });
                    });
                });

                setAllServices(flat);
                setPopularServices(data.popularServices || flat.filter((s) => s.isPopular).slice(0, 6));
            } else {
                // If API returns success: false, fallback to platform services
                console.log('[Services] Hierarchy API returned false, falling back to platform services');
                return fetchPlatformServices();
            }
        } catch (error) {
            console.error('[Services] Error fetching hierarchy:', error);
            // Fallback to platform services
            return fetchPlatformServices();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Fallback function to use platform services
    const fetchPlatformServices = async () => {
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services`;
            console.log('[Services] Fallback fetching from:', url);

            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                let groups: CategoryGroup[] = [];
                let flat: ServiceItem[] = [];

                const source = data?.categories ?? (Array.isArray(data) ? data : data?.data ?? []);
                groups = source;

                source.forEach((cat: any) => {
                    (cat.services ?? []).forEach((s: any) => {
                        flat.push({
                            ...s,
                            isPopular: s.isPopular || false,
                            categoryName: cat.categoryName || cat.name || 'Service',
                        });
                    });
                });

                setCategories(groups);
                setAllServices(flat);
                setPopularServices(flat.filter((s) => s.isPopular).slice(0, 6));
            } else {
                setCategories([]);
                setAllServices([]);
                setPopularServices([]);
            }
        } catch (error) {
            console.error('[Services] Fallback error:', error);
            setCategories([]);
            setAllServices([]);
            setPopularServices([]);
        }
    };

    useEffect(() => {
        fetchServices();
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    useEffect(() => {
        if (showSearchModal) {
            Animated.timing(searchFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
            setTimeout(() => searchInputRef.current?.focus(), 300);
        } else {
            searchFadeAnim.setValue(0);
        }
    }, [showSearchModal]);

    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const q = searchQuery.toLowerCase();
            setSearchResults(
                allServices.filter(
                    (s) =>
                        s.name.toLowerCase().includes(q) ||
                        s.description?.toLowerCase().includes(q) ||
                        s.categoryName?.toLowerCase().includes(q),
                ),
            );
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, allServices]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchServices();
    }, []);

    /* ─── Navigation ─── */
    const goService = (item: ServiceItem) => {
        setShowSearchModal(false);
        setSearchQuery('');
        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: item.id,
                name: item.name,
                price: String(item.price),
                description: item.description || '',
                imageUrl: item.imageUrl || '',
                categoryName: item.categoryName || 'Service',
                durationMinutes: String(item.durationMinutes || 0),
            },
        });
    };

    const openSearch = () => setShowSearchModal(true);
    const closeSearch = () => {
        setShowSearchModal(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    /* ─── Renderers ─── */

    // Service Card (horizontal scroll)
    const renderServiceCard = ({ item, index }: { item: ServiceItem; index: number }) => {
        const color = categoryColor(index);
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                style={s.card}
                onPress={() => goService(item)}
            >
                <View style={s.cardImgWrap}>
                    {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={s.cardImg} />
                    ) : (
                        <LinearGradient colors={[color + '22', color + '0a']} style={s.cardImgPlaceholder}>
                            <MaterialIcons name="handyman" size={36} color={color + '80'} />
                        </LinearGradient>
                    )}

                    {item.isPopular && (
                        <View style={s.popChip}>
                            <MaterialIcons name="auto-awesome" size={10} color="#fff" />
                            <Text style={s.popChipText}>Popular</Text>
                        </View>
                    )}

                    {item.categoryName && (
                        <View style={[s.catChip, { backgroundColor: '#00000090' }]}>
                            <Text style={s.catChipText}>{item.categoryName}</Text>
                        </View>
                    )}
                </View>

                <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.cardDesc} numberOfLines={2}>
                        {item.description || 'Professional service at your doorstep.'}
                    </Text>
                    <View style={s.cardFooter}>
                        <View>
                            <Text style={s.cardPriceLabel}>Starting from</Text>
                            <Text style={[s.cardPrice, { color: B.accent }]}>{formatPrice(item.price)}</Text>
                        </View>
                        <LinearGradient colors={[B.accent, B.accent + 'bb']} style={s.bookBtn}>
                            <Text style={s.bookBtnText}>Book</Text>
                            <Ionicons name="arrow-forward" size={13} color="#fff" />
                        </LinearGradient>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Popular list item
    const renderPopularItem = ({ item }: { item: ServiceItem }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => goService(item)}>
            <View style={s.popRow}>
                <View style={s.popRowImgWrap}>
                    {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={s.popRowImg} />
                    ) : (
                        <View style={[s.popRowImgPH, { backgroundColor: B.accent + '12' }]}>
                            <MaterialIcons name="handyman" size={22} color={B.accent + '90'} />
                        </View>
                    )}
                </View>
                <View style={s.popRowBody}>
                    <Text style={s.popRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.popRowCat} numberOfLines={1}>{item.categoryName || 'Service'}</Text>
                    <Text style={[s.popRowPrice, { color: B.accent }]}>{formatPrice(item.price)}</Text>
                </View>
                <View style={s.popRowArrow}>
                    <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                </View>
            </View>
        </TouchableOpacity>
    );

    // Search result item
    const renderSearchItem = ({ item }: { item: ServiceItem }) => (
        <TouchableOpacity style={s.srItem} onPress={() => goService(item)} activeOpacity={0.7}>
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={s.srImg} />
            ) : (
                <View style={[s.srImgPH, { backgroundColor: B.accent + '10' }]}>
                    <MaterialIcons name="handyman" size={20} color={B.accent} />
                </View>
            )}
            <View style={s.srBody}>
                <Text style={s.srName}>{item.name}</Text>
                {item.categoryName && <Text style={s.srCat}>{item.categoryName}</Text>}
                <Text style={[s.srPrice, { color: B.accent }]}>{formatPrice(item.price)}</Text>
            </View>
            {item.isPopular && (
                <View style={s.srBadge}>
                    <Text style={s.srBadgeText}>★ Popular</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    /* ─── Loading ─── */
    if (loading) return <SkeletonScreen />;

    /* ─── Render ─── */
    return (
        <SafeAreaContainer style={s.root} showBottomNav>
            <StatusBar backgroundColor="#f8fafc" barStyle="dark-content" />

            <Animated.View style={[s.headerWrap, { opacity: fadeAnim }]}>
                <View style={s.header}>
                    <View>
                        <Text style={s.headerLabel}>Explore</Text>
                        <Text style={s.headerTitle}>Services</Text>
                    </View>
                    <TouchableOpacity style={s.searchBtn} onPress={openSearch} activeOpacity={0.7}>
                        <Feather name="search" size={20} color="#475569" />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[B.accent]} tintColor={B.accent} />}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
            >
                {/* ── Hero ── */}
                <LinearGradient
                    colors={[B.accent, B.accent + 'cc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.hero}
                >
                    <View style={s.heroInner}>
                        <View style={s.heroTag}>
                            <MaterialIcons name="local-fire-department" size={13} color="#fff" />
                            <Text style={s.heroTagText}>Trusted Professionals</Text>
                        </View>
                        <Text style={s.heroHeading}>
                            Find the Best{'\n'}Services Near You
                        </Text>
                        <Text style={s.heroSub}>
                            Verified experts, transparent pricing,{'\n'}seamless booking.
                        </Text>
                        <View style={s.heroStats}>
                            <View style={s.heroStat}>
                                <Text style={s.heroStatNum}>{allServices.length}+</Text>
                                <Text style={s.heroStatLab}>Services</Text>
                            </View>
                            <View style={s.heroStatSep} />
                            <View style={s.heroStat}>
                                <Text style={s.heroStatNum}>{categories.length}</Text>
                                <Text style={s.heroStatLab}>Categories</Text>
                            </View>
                        </View>
                    </View>
                    <View style={s.heroCircle1} />
                    <View style={s.heroCircle2} />
                </LinearGradient>

                {/* ── Popular ── */}
                {popularServices.length > 0 && (
                    <View style={s.section}>
                        <View style={s.secHead}>
                            <View style={s.secHeadLeft}>
                                <View style={s.secIcon}>
                                    <MaterialIcons name="auto-awesome" size={16} color="#f59e0b" />
                                </View>
                                <Text style={s.secTitle}>Popular Services</Text>
                            </View>
                        </View>
                        <View style={s.popList}>
                            {popularServices.slice(0, 4).map((item) => (
                                <View key={item.id} style={s.popItemWrap}>
                                    {renderPopularItem({ item })}
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Categories ── */}
                {categories.length === 0 ? (
                    <View style={s.empty}>
                        <View style={s.emptyIconWrap}>
                            <MaterialIcons name="category" size={40} color="#94a3b8" />
                        </View>
                        <Text style={s.emptyTitle}>No services available</Text>
                        <Text style={s.emptySub}>Pull down to refresh</Text>
                    </View>
                ) : (
                    categories.map((cat, idx) => {
                        // Get all items from this category (flatten sub-categories)
                        const allCategoryItems: ServiceItem[] = [];
                        cat.subCategories.forEach((sub) => {
                            sub.items.forEach((item) => {
                                allCategoryItems.push({
                                    ...item,
                                    categoryName: cat.name,
                                    categoryId: cat.id,
                                });
                            });
                        });

                        if (allCategoryItems.length === 0) return null;

                        const color = categoryColor(idx);
                        return (
                            <View key={cat.id} style={s.section}>
                                <View style={s.secHead}>
                                    <View style={s.secHeadLeft}>
                                        <View style={[s.secDot, { backgroundColor: color }]} />
                                        <Text style={s.catTitle}>{cat.name}</Text>
                                    </View>
                                    <Text style={s.count}>{allCategoryItems.length} services</Text>
                                </View>
                                <FlatList
                                    horizontal
                                    data={allCategoryItems}
                                    renderItem={({ item, index: i }) => renderServiceCard({ item, index: i })}
                                    keyExtractor={(item) => item.id.toString()}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={s.hScrollPad}
                                    decelerationRate="fast"
                                    snapToInterval={234}
                                    snapToAlignment="start"
                                />
                            </View>
                        );
                    })
                )}

                <View style={{ height: 100 }} />
            </Animated.ScrollView>

            {/* ── Search Modal ── */}
            <Modal visible={showSearchModal} animationType="fade" transparent onRequestClose={closeSearch}>
                <Animated.View style={[s.modalBg, { opacity: searchFadeAnim }]}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSearch} />
                    <Animated.View style={[s.modalSheet, { opacity: searchFadeAnim, transform: [{ translateY: searchFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
                        <View style={s.modalHandle} />
                        <View style={s.modalInputRow}>
                            <TouchableOpacity onPress={closeSearch} hitSlop={8}>
                                <Ionicons name="arrow-back" size={22} color="#334155" />
                            </TouchableOpacity>
                            <View style={s.modalInputWrap}>
                                <Feather name="search" size={18} color="#94a3b8" />
                                <TextInput
                                    ref={searchInputRef}
                                    style={s.modalInput}
                                    placeholder="Search services, categories..."
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoFocus
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                                        <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {searchQuery.length > 0 && (
                            <View style={s.modalResults}>
                                {searchResults.length > 0 ? (
                                    <FlatList
                                        data={searchResults}
                                        renderItem={renderSearchItem}
                                        keyExtractor={(item) => item.id.toString()}
                                        showsVerticalScrollIndicator={false}
                                        ItemSeparatorComponent={() => <View style={s.srSep} />}
                                        contentContainerStyle={{ paddingBottom: 40 }}
                                    />
                                ) : (
                                    <View style={s.noResults}>
                                        <MaterialIcons name="search-off" size={52} color="#cbd5e1" />
                                        <Text style={s.noResTitle}>No results found</Text>
                                        <Text style={s.noResSub}>Try different keywords</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {searchQuery.length === 0 && (
                            <View style={s.suggestions}>
                                <Text style={s.sugTitle}>Quick suggestions</Text>
                                <View style={s.sugChips}>
                                    {categories.slice(0, 6).map((cat) => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={s.sugChip}
                                            onPress={() => setSearchQuery(cat.name)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={s.sugChipText}>{cat.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </Animated.View>
            </Modal>
        </SafeAreaContainer>
    );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },

    /* Header */
    headerWrap: {
        backgroundColor: '#f8fafc',
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 14,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.8,
        marginTop: 2,
    },
    searchBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },

    /* Scroll */
    scroll: {
        paddingBottom: 40,
    },

    /* Hero */
    hero: {
        marginHorizontal: 20,
        marginBottom: 28,
        borderRadius: 24,
        padding: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    heroInner: { flex: 1, zIndex: 2 },
    heroTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff25',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 5,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#ffffff30',
    },
    heroTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 0.3,
    },
    heroHeading: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        lineHeight: 30,
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    heroSub: {
        fontSize: 13,
        color: '#ffffffcc',
        lineHeight: 18,
        marginBottom: 18,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    heroStat: {},
    heroStatNum: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
    },
    heroStatLab: {
        fontSize: 11,
        color: '#ffffffaa',
        fontWeight: '500',
        marginTop: -2,
    },
    heroStatSep: {
        width: 1,
        height: 32,
        backgroundColor: '#ffffff30',
    },
    heroCircle1: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#ffffff10',
        right: -40,
        top: -40,
    },
    heroCircle2: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#ffffff08',
        left: -20,
        bottom: -20,
    },

    /* Section common */
    section: {
        marginBottom: 30,
    },
    secHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    secHeadLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    secIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    secDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    secTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    catTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    count: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    seeAll: {
        fontSize: 13,
        fontWeight: '600',
        color: B.accent,
    },

    /* Popular list */
    popList: {
        paddingHorizontal: 20,
        gap: 4,
    },
    popItemWrap: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 8,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    popRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 14,
    },
    popRowImgWrap: {},
    popRowImg: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
    },
    popRowImgPH: {
        width: 52,
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popRowBody: {
        flex: 1,
    },
    popRowName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    popRowCat: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    popRowPrice: {
        fontSize: 15,
        fontWeight: '700',
        marginTop: 3,
    },
    popRowArrow: {
        paddingLeft: 4,
    },

    /* Horizontal scroll padding */
    hScrollPad: {
        paddingLeft: 20,
        paddingRight: 20,
        gap: 14,
    },

    /* Service Card */
    card: {
        width: 220,
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    cardImgWrap: {
        position: 'relative',
        height: 140,
    },
    cardImg: {
        width: '100%',
        height: 140,
        backgroundColor: '#f1f5f9',
        resizeMode: 'cover',
    },
    cardImgPlaceholder: {
        width: '100%',
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popChip: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: B.accent,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 4,
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 4,
    },
    popChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    catChip: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    catChipText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    cardBody: {
        padding: 14,
    },
    cardName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    cardDesc: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 16,
        height: 32,
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    cardPriceLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '500',
    },
    cardPrice: {
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    bookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    bookBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },

    /* Empty */
    empty: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 8,
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#475569',
    },
    emptySub: {
        fontSize: 13,
        color: '#94a3b8',
    },

    /* Search Modal */
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
    },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        minHeight: 420,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e2e8f0',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },
    modalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalInput: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
        paddingVertical: 2,
    },
    modalResults: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    srItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 14,
    },
    srImg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
    },
    srImgPH: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    srBody: { flex: 1 },
    srName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    srCat: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 1,
    },
    srPrice: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 3,
    },
    srBadge: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    srBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#d97706',
    },
    srSep: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginLeft: 62,
    },
    noResults: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 60,
    },
    noResTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
        marginTop: 8,
    },
    noResSub: {
        fontSize: 13,
        color: '#94a3b8',
    },

    /* Suggestions */
    suggestions: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    sugTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sugChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    sugChip: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sugChipText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
});