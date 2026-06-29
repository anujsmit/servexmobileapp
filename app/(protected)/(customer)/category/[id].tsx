// app/(protected)/(customer)/category/[id].tsx

import React, { useState, useEffect, useCallback, memo } from 'react';
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
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

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
// MEMOIZED SUB-CATEGORY CARD
// ============================================

const SubCategoryCard = memo(({ 
    subCategory, 
    color, 
    onPress 
}: { 
    subCategory: SubCategory; 
    color: string; 
    onPress: () => void;
}) => {
    const hasItems = subCategory.itemCount > 0;
    const firstLetter = subCategory.name?.charAt(0).toUpperCase() || '?';

    return (
        <TouchableOpacity
            style={[
                styles.subCategoryCard,
                !hasItems && styles.subCategoryCardDisabled,
            ]}
            activeOpacity={0.85}
            onPress={onPress}
            disabled={!hasItems}
        >
            <View style={styles.imageContainer}>
                {subCategory.imageUrl ? (
                    <Image
                        source={{ uri: subCategory.imageUrl }}
                        style={styles.subCategoryImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: color + '12' }]}>
                        <Text style={[styles.imagePlaceholderText, { color: color + '40' }]}>
                            {firstLetter}
                        </Text>
                    </View>
                )}
                
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.15)']}
                    style={styles.imageGradient}
                />
                
                {subCategory.isPopular && (
                    <View style={[styles.popularBadge, { backgroundColor: color }]}>
                        <Ionicons name="star" size={10} color="#fff" />
                    </View>
                )}
                
                {!hasItems && (
                    <View style={styles.comingSoonOverlay}>
                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                )}
            </View>

            <View style={styles.cardContent}>
                <Text style={styles.subCategoryName} numberOfLines={1}>
                    {subCategory.name}
                </Text>
                
                {subCategory.description && (
                    <Text style={styles.subCategoryDescription} numberOfLines={2}>
                        {subCategory.description}
                    </Text>
                )}
                
                <View style={styles.cardFooter}>
                    <View style={styles.serviceCountBadge}>
                        <MaterialIcons name="handyman" size={12} color={hasItems ? color : '#cbd5e1'} />
                        <Text style={[styles.serviceCountText, { color: hasItems ? '#64748b' : '#cbd5e1' }]}>
                            {subCategory.itemCount}
                        </Text>
                    </View>
                    
                    {hasItems && (
                        <View style={[styles.arrowButton, { backgroundColor: color + '12' }]}>
                            <Ionicons name="arrow-forward" size={14} color={color} />
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});

SubCategoryCard.displayName = 'SubCategoryCard';

// ============================================
// CONSULTATION BUTTON COMPONENT
// ============================================

const ConsultationButton = memo(({ onPress }: { onPress: () => void }) => {
    return (
        <TouchableOpacity 
            style={styles.consultationButton}
            activeOpacity={0.9}
            onPress={onPress}
        >
            <LinearGradient
                colors={['#f97316', '#e67e22']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.consultationGradient}
            >
                <View style={styles.consultationContent}>
                    <View style={styles.consultationIconWrapper}>
                        <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
                    </View>
                    <View style={styles.consultationTextWrapper}>
                        <Text style={styles.consultationTitle}>Book a Consultation</Text>
                        <Text style={styles.consultationSubtitle}>Get expert advice instantly</Text>
                    </View>
                    <View style={styles.consultationArrow}>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
});

ConsultationButton.displayName = 'ConsultationButton';

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
    }, [name, navigation]);

    const fetchCategoryWithSubCategories = useCallback(async () => {
        setLoading(true);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/public/categories/${serviceId || id}`;
            
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
                setSubCategories([]);
            }
        } catch (error) {
            console.error('Error fetching category:', error);
        } finally {
            setLoading(false);
        }
    }, [id, serviceId]);

    useEffect(() => {
        fetchCategoryWithSubCategories();
    }, [fetchCategoryWithSubCategories]);

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
                categoryId: categoryInfo?.id?.toString(),
            },
        });
    };

    const handleConsultationPress = () => {
        router.push('/book/consultation');
    };

    const getCategoryColor = () => categoryInfo?.iconColor || '#e67e22';

    const renderCategoryHeader = () => {
        const color = getCategoryColor();
        const firstLetter = (categoryInfo?.name || (name as string) || '')?.charAt(0).toUpperCase() || '?';
        const totalServices = subCategories.reduce((acc, sub) => acc + sub.itemCount, 0);
        
        return (
            <View style={styles.headerContainer}>
                <View style={[styles.headerAccent, { backgroundColor: color + '08' }]} />
                
                <View style={styles.headerContent}>
                    <View style={[styles.categoryIconWrapper, { borderColor: color + '25' }]}>
                        {categoryInfo?.iconUrl ? (
                            <Image 
                                source={{ uri: categoryInfo.iconUrl }} 
                                style={styles.categoryIcon}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={[styles.categoryIconFallback, { backgroundColor: color + '12' }]}>
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
                        <View style={[styles.statItem, { backgroundColor: color + '08' }]}>
                            <MaterialIcons name="category" size={14} color={color} />
                            <Text style={[styles.statText, { color }]}>
                                {subCategories.length}
                            </Text>
                            <Text style={styles.statLabel}>Categories</Text>
                        </View>
                        
                        <View style={[styles.statItem, { backgroundColor: color + '08' }]}>
                            <MaterialIcons name="handyman" size={14} color={color} />
                            <Text style={[styles.statText, { color }]}>
                                {totalServices}
                            </Text>
                            <Text style={styles.statLabel}>Services</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderSubCategoriesGrid = () => {
        const pairs: SubCategory[][] = [];
        for (let i = 0; i < subCategories.length; i += 2) {
            pairs.push(subCategories.slice(i, i + 2));
        }

        const color = getCategoryColor();

        return pairs.map((pair, index) => (
            <View key={`row-${index}`} style={styles.gridRow}>
                {pair.map((subCategory) => (
                    <SubCategoryCard
                        key={subCategory.id}
                        subCategory={subCategory}
                        color={color}
                        onPress={() => handleSubCategoryPress(subCategory)}
                    />
                ))}
                {pair.length === 1 && (
                    <View style={[styles.subCategoryCard, styles.fillerCard]} />
                )}
            </View>
        ));
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e67e22" />
                <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
        );
    }

    const availableCount = subCategories.filter(s => s.itemCount > 0).length;

    return (
        <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
            }
        >
            {renderCategoryHeader()}

            {/* Consultation Button */}
            <View style={styles.consultationSection}>
                <ConsultationButton onPress={handleConsultationPress} />
            </View>

            <View style={styles.subCategoriesSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Sub-Categories</Text>
                    <View style={styles.availableBadge}>
                        <View style={styles.availableDot} />
                        <Text style={styles.availableText}>{availableCount} available</Text>
                    </View>
                </View>

                {subCategories.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconWrapper}>
                            <MaterialIcons name="search-off" size={40} color="#cbd5e1" />
                        </View>
                        <Text style={styles.emptyTitle}>No sub-categories found</Text>
                        <Text style={styles.emptySubtitle}>No services available in this category yet</Text>
                    </View>
                ) : (
                    <View style={styles.subCategoriesGrid}>
                        {renderSubCategoriesGrid()}
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
    scrollContent: {
        paddingBottom: 40,
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
        backgroundColor: '#ffffff',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
        position: 'relative',
        marginHorizontal: 0,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerAccent: {
        position: 'absolute',
        top: -60,
        left: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
    },
    headerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 28,
    },
    categoryIconWrapper: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 16,
            },
            android: {
                elevation: 4,
            },
        }),
        borderWidth: 2,
    },
    categoryIconFallback: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryIconText: {
        fontSize: 36,
        fontWeight: '800',
    },
    categoryIcon: {
        width: 56,
        height: 56,
    },
    categoryName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 6,
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    categoryDescription: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 18,
        textAlign: 'center',
        maxWidth: 300,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    statText: {
        fontSize: 16,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },

    consultationSection: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    consultationButton: {
        borderRadius: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#f97316',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    consultationGradient: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
    },
    consultationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    consultationIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    consultationTextWrapper: {
        flex: 1,
    },
    consultationTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.2,
    },
    consultationSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
    },
    consultationArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    subCategoriesSection: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    availableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    availableDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    availableText: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '600',
    },

    subCategoriesGrid: {
        gap: 14,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 14,
    },

    subCategoryCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
            },
            android: {
                elevation: 3,
            },
        }),
        overflow: 'hidden',
        maxWidth: CARD_WIDTH,
    },
    fillerCard: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
    },
    subCategoryCardDisabled: {
        opacity: 0.55,
    },

    imageContainer: {
        width: '100%',
        height: 130,
        position: 'relative',
        overflow: 'hidden',
    },
    subCategoryImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePlaceholderText: {
        fontSize: 48,
        fontWeight: '800',
    },
    imageGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 40,
    },
    popularBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    comingSoonOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(241, 245, 249, 0.92)',
        paddingVertical: 6,
        alignItems: 'center',
    },
    comingSoonText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    cardContent: {
        padding: 14,
    },
    subCategoryName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
        letterSpacing: -0.2,
    },
    subCategoryDescription: {
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 16,
        marginBottom: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    serviceCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    serviceCountText: {
        fontSize: 12,
        fontWeight: '600',
    },
    arrowButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },

    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 10,
    },
    emptyIconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
        paddingHorizontal: 30,
        lineHeight: 18,
    },
});