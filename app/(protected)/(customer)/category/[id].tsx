// app/(protected)/(customer)/category/[id].tsx

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
    Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

// ============================================
// TYPES
// ============================================

interface SubCategory {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    isPopular: boolean;
    displayOrder: number;
    itemCount: number;
}

interface CategoryInfo {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconColor: string;
    subCategories: SubCategory[];
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

export default function CategoryServicesScreen() {
    const { id, name, serviceId } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    
    const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Services',
            headerTitleStyle: { fontWeight: '600', fontSize: 18 },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
        });
    }, [name]);

    useEffect(() => {
        fetchCategoryWithSubCategories();
    }, [id, serviceId]);

    const fetchCategoryWithSubCategories = async () => {
        setLoading(true);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/public/categories/${serviceId || id}`;
            console.log('Fetching category from:', url);
            
            const response = await fetch(url, {
                headers: {
                    'ngrok-skip-browser-warning': 'true',
                },
            });
            const data = await response.json();

            if (response.ok && data.success) {
                const category = data.category;
                setCategoryInfo(category);
                setSubCategories(category.subCategories || []);
            } else {
                console.log('Failed to fetch category:', data.message);
                setSubCategories([]);
            }
        } catch (error) {
            console.error('Error fetching category:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCategoryWithSubCategories();
        setRefreshing(false);
    };

    const handleSubCategoryPress = (subCategory: SubCategory) => {
        router.push({
            pathname: '/sub-category/[id]',
            params: {
                id: subCategory.id,
                name: subCategory.name,
                categoryName: categoryInfo?.name,
                categoryColor: categoryInfo?.iconColor,
                categoryId: categoryInfo?.id,
            },
        });
    };

    const getCategoryColor = () => {
        return categoryInfo?.iconColor || '#e67e22';
    };

    const renderSubCategoryCard = (subCategory: SubCategory) => {
        const color = getCategoryColor();
        const initials = getInitials(subCategory.name);
        const hasItems = subCategory.itemCount > 0;
        const firstLetter = subCategory.name.charAt(0).toUpperCase();

        return (
            <TouchableOpacity
                key={subCategory.id}
                style={[
                    styles.subCategoryCard,
                    !hasItems && styles.subCategoryCardDisabled,
                ]}
                activeOpacity={0.7}
                onPress={() => handleSubCategoryPress(subCategory)}
                disabled={!hasItems}
            >
                <View style={styles.subCategoryIconContainer}>
                    {subCategory.imageUrl ? (
                        <Image
                            source={{ uri: subCategory.imageUrl }}
                            style={styles.subCategoryIcon}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.subCategoryIconPlaceholder, { backgroundColor: color + '15' }]}>
                            <Text style={[styles.subCategoryInitials, { color }]}>
                                {firstLetter}
                            </Text>
                        </View>
                    )}
                    {subCategory.isPopular && (
                        <View style={[styles.popularBadge, { backgroundColor: color }]}>
                            <Ionicons name="star" size={10} color="#fff" />
                        </View>
                    )}
                </View>

                <View style={styles.subCategoryInfo}>
                    <Text style={styles.subCategoryName} numberOfLines={1}>
                        {subCategory.name}
                    </Text>
                    {subCategory.description && (
                        <Text style={styles.subCategoryDescription} numberOfLines={2}>
                            {subCategory.description}
                        </Text>
                    )}
                    <View style={styles.subCategoryFooter}>
                        <Text style={styles.itemCountText}>
                            {subCategory.itemCount} {subCategory.itemCount === 1 ? 'service' : 'services'}
                        </Text>
                        <Ionicons 
                            name="chevron-forward" 
                            size={14} 
                            color={hasItems ? color : '#cbd5e1'} 
                        />
                    </View>
                </View>

                {!hasItems && (
                    <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderCategoryHeader = () => {
        const color = getCategoryColor();
        const categoryInitials = getInitials(categoryInfo?.name || (name as string));
        const firstLetter = (categoryInfo?.name || (name as string))?.charAt(0).toUpperCase() || '?';
        
        return (
            <View style={styles.headerContainer}>
                <View style={[styles.categoryIconWrapper, { borderColor: color + '30' }]}>
                    {categoryInfo?.iconUrl ? (
                        <Image 
                            source={{ uri: categoryInfo.iconUrl }} 
                            style={styles.categoryIcon}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={[styles.categoryIconFallback, { backgroundColor: color + '15' }]}>
                            <Text style={[styles.categoryIconText, { color }]}>
                                {firstLetter}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={styles.categoryName}>{categoryInfo?.name || name}</Text>
                {categoryInfo?.description && (
                    <Text style={styles.categoryDescription}>{categoryInfo.description}</Text>
                )}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <MaterialIcons name="folder" size={16} color={color} />
                        <Text style={styles.statText}>
                            {subCategories.length} {subCategories.length === 1 ? 'Category' : 'Categories'}
                        </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MaterialIcons name="handyman" size={16} color={color} />
                        <Text style={styles.statText}>
                            {subCategories.reduce((acc, sub) => acc + sub.itemCount, 0)} Services
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e67e22" />
                <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
        );
    }

    // Split sub-categories into pairs for 2-column grid
    const renderSubCategoriesInPairs = () => {
        const pairs = [];
        for (let i = 0; i < subCategories.length; i += 2) {
            pairs.push(subCategories.slice(i, i + 2));
        }
        return pairs;
    };

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
            }
        >
            {renderCategoryHeader()}

            <View style={styles.subCategoriesSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Sub-Categories
                    </Text>
                    <Text style={styles.serviceCount}>
                        {subCategories.filter(s => s.itemCount > 0).length} available
                    </Text>
                </View>

                {subCategories.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No sub-categories found</Text>
                        <Text style={styles.emptySubtitle}>No services available in this category yet</Text>
                    </View>
                ) : (
                    <View style={styles.subCategoriesGrid}>
                        {renderSubCategoriesInPairs().map((pair, index) => (
                            <View key={`row-${index}`} style={styles.gridRow}>
                                {pair.map((subCategory) => {
                                    const hasItems = subCategory.itemCount > 0;
                                    const color = getCategoryColor();
                                    const firstLetter = subCategory.name.charAt(0).toUpperCase();

                                    return (
                                        <TouchableOpacity
                                            key={subCategory.id}
                                            style={[
                                                styles.subCategoryCard,
                                                !hasItems && styles.subCategoryCardDisabled,
                                            ]}
                                            activeOpacity={0.7}
                                            onPress={() => handleSubCategoryPress(subCategory)}
                                            disabled={!hasItems}
                                        >
                                            <View style={styles.subCategoryIconContainer}>
                                                {subCategory.imageUrl ? (
                                                    <Image
                                                        source={{ uri: subCategory.imageUrl }}
                                                        style={styles.subCategoryIcon}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={[styles.subCategoryIconPlaceholder, { backgroundColor: color + '15' }]}>
                                                        <Text style={[styles.subCategoryInitials, { color }]}>
                                                            {firstLetter}
                                                        </Text>
                                                    </View>
                                                )}
                                                {subCategory.isPopular && (
                                                    <View style={[styles.popularBadge, { backgroundColor: color }]}>
                                                        <Ionicons name="star" size={10} color="#fff" />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.subCategoryInfo}>
                                                <Text style={styles.subCategoryName} numberOfLines={1}>
                                                    {subCategory.name}
                                                </Text>
                                                {subCategory.description && (
                                                    <Text style={styles.subCategoryDescription} numberOfLines={2}>
                                                        {subCategory.description}
                                                    </Text>
                                                )}
                                                <View style={styles.subCategoryFooter}>
                                                    <Text style={styles.itemCountText}>
                                                        {subCategory.itemCount} {subCategory.itemCount === 1 ? 'service' : 'services'}
                                                    </Text>
                                                    <Ionicons 
                                                        name="chevron-forward" 
                                                        size={14} 
                                                        color={hasItems ? color : '#cbd5e1'} 
                                                    />
                                                </View>
                                            </View>

                                            {!hasItems && (
                                                <View style={styles.comingSoonBadge}>
                                                    <Text style={styles.comingSoonText}>Coming Soon</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                                {/* Fill empty space if odd number */}
                                {pair.length === 1 && (
                                    <View style={[styles.subCategoryCard, styles.fillerCard]} />
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

// ============================================
// STYLES - CLEAN & MODERN
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f7fa',
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
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    categoryIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
    },
    categoryIconFallback: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryIconText: {
        fontSize: 32,
        fontWeight: '700',
    },
    categoryIcon: {
        width: 50,
        height: 50,
    },
    categoryName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    categoryDescription: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        marginBottom: 14,
        textAlign: 'center',
    },
    statsContainer: {
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
    subCategoriesSection: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    serviceCount: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
    },
    subCategoriesGrid: {
        gap: 12,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    subCategoryCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        alignItems: 'center',
        position: 'relative',
        maxWidth: CARD_WIDTH,
    },
    fillerCard: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
    },
    subCategoryCardDisabled: {
        opacity: 0.6,
    },
    subCategoryIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: 12,
        position: 'relative',
    },
    subCategoryIcon: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
    },
    subCategoryIconPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    subCategoryInitials: {
        fontSize: 26,
        fontWeight: '700',
    },
    popularBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    subCategoryInfo: {
        alignItems: 'center',
        width: '100%',
    },
    subCategoryName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 2,
    },
    subCategoryDescription: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 8,
    },
    subCategoryFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    itemCountText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    comingSoonBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    comingSoonText: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 10,
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