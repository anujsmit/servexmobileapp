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
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredItems, setFilteredItems] = useState<ServiceItem[]>([]);

    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Services',
            headerTitleStyle: { fontWeight: '600', fontSize: 18 },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
        });
    }, [name]);

    useEffect(() => {
        fetchSubCategoryDetail();
    }, [id]);

    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredItems(filtered);
        } else {
            setFilteredItems(items);
        }
    }, [searchQuery, items]);

    const fetchSubCategoryDetail = async () => {
        setLoading(true);
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
                console.log('Failed to fetch sub-category:', data.message);
                setItems([]);
            }
        } catch (error) {
            console.error('Error fetching sub-category:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchSubCategoryDetail();
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

    const getColor = () => {
        return (categoryColor as string) || '#e67e22';
    };

    const renderServiceItem = (item: ServiceItem) => {
        const color = getColor();
        const initials = getInitials(item.name);
        
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.serviceItemCard}
                activeOpacity={0.7}
                onPress={() => handleServicePress(item)}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.serviceImageContainer, { backgroundColor: color + '15' }]}>
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
                    </View>

                    <View style={styles.serviceInfo}>
                        <View style={styles.serviceNameRow}>
                            <Text style={styles.serviceName} numberOfLines={1}>
                                {item.name}
                            </Text>
                            {item.isPopular && (
                                <View style={[styles.popularBadge, { backgroundColor: color + '15' }]}>
                                    <MaterialIcons name="star" size={10} color={color} />
                                    <Text style={[styles.popularBadgeText, { color }]}>Popular</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.serviceDescription} numberOfLines={2}>
                            {item.description || 'Professional service at your doorstep'}
                        </Text>
                        <View style={styles.serviceFooter}>
                            <View>
                                <Text style={styles.priceLabel}>Starting from</Text>
                                <Text style={[styles.servicePrice, { color }]}>
                                    रु {parseFloat(item.price || '0').toLocaleString()}
                                </Text>
                            </View>
                            {item.durationMinutes && (
                                <View style={styles.durationBadge}>
                                    <Ionicons name="time-outline" size={14} color="#64748b" />
                                    <Text style={styles.durationText}>
                                        {item.durationMinutes} mins
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <LinearGradient
                    colors={[color, color + 'CC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bookButton}
                >
                    <Text style={styles.bookButtonText}>Book</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderHeader = () => {
        const color = getColor();
        const initials = getInitials(subCategory?.name || (name as string));
        
        return (
            <LinearGradient
                colors={[color + '08', '#ffffff']}
                style={styles.headerContainer}
            >
                <View style={[styles.iconWrapper, { borderColor: color + '20' }]}>
                    {subCategory?.imageUrl ? (
                        <Image 
                            source={{ uri: subCategory.imageUrl }} 
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    ) : (
                        <Text style={[styles.headerInitials, { color }]}>
                            {initials}
                        </Text>
                    )}
                </View>
                <Text style={styles.headerTitle}>{subCategory?.name || name}</Text>
                {subCategory?.description && (
                    <Text style={styles.headerDescription}>{subCategory.description}</Text>
                )}
                <View style={styles.headerStats}>
                    <View style={styles.statItem}>
                        <MaterialIcons name="handyman" size={16} color={color} />
                        <Text style={styles.statText}>
                            {items.length} {items.length === 1 ? 'Service' : 'Services'}
                        </Text>
                    </View>
                    {subCategory?.isPopular && (
                        <>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <MaterialIcons name="star" size={16} color="#fbbf24" />
                                <Text style={styles.statText}>Popular</Text>
                            </View>
                        </>
                    )}
                </View>
            </LinearGradient>
        );
    };

    const renderSearchBar = () => (
        <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
                <Feather name="search" size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder={`Search ${subCategory?.name || name} services...`}
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e67e22" />
                <Text style={styles.loadingText}>Loading services...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
            }
        >
            {renderHeader()}
            {renderSearchBar()}

            <View style={styles.content}>
                {filteredItems.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>
                            {searchQuery ? 'No services match your search' : 'No services available'}
                        </Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery ? 'Try a different search term' : 'Check back later for new services'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.servicesList}>
                        {filteredItems.map(renderServiceItem)}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    headerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        backgroundColor: '#ffffff',
    },
    iconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
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
        width: 44,
        height: 44,
    },
    headerInitials: {
        fontSize: 28,
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    headerDescription: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 14,
        paddingHorizontal: 20,
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f0f2f5',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 14,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 14,
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginTop: 12,
        marginBottom: 4,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 46,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        paddingVertical: 0,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    servicesList: {
        gap: 14,
        marginTop: 8,
    },
    serviceItemCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
        gap: 12,
    },
    cardLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    serviceImageContainer: {
        width: 72,
        height: 72,
        borderRadius: 16,
        overflow: 'hidden',
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
        fontSize: 22,
        fontWeight: '700',
    },
    serviceInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    serviceNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    popularBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        gap: 3,
    },
    popularBadgeText: {
        fontSize: 9,
        fontWeight: '600',
    },
    serviceDescription: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16,
    },
    serviceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    priceLabel: {
        fontSize: 9,
        color: '#94a3b8',
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: '700',
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    durationText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    bookButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    bookButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});