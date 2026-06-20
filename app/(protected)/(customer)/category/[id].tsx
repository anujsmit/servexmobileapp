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
    TextInput,
    RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PlatformService {
    id: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
    duration_minutes: number | null;
    isActive: boolean;
}

interface CategoryInfo {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconColor: string;
}

const getInitials = (name: string): string => {
    if (!name) return 'SR';
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

export default function CategoryServicesScreen() {
    const { id, name, serviceId } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    
    const [services, setServices] = useState<PlatformService[]>([]);
    const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredServices, setFilteredServices] = useState<PlatformService[]>([]);

    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Services',
            headerTitleStyle: { fontWeight: '600', fontSize: 18 },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
        });
    }, [name]);

    useEffect(() => {
        fetchCategoryServices();
    }, [id, serviceId]);

    useEffect(() => {
        if (searchQuery.trim()) {
            const filtered = services.filter(service =>
                service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredServices(filtered);
        } else {
            setFilteredServices(services);
        }
    }, [searchQuery, services]);

    const fetchCategoryServices = async () => {
        setLoading(true);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services/category/${serviceId || id}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                setCategoryInfo(data.category);
                setServices(data.services || []);
                setFilteredServices(data.services || []);
            } else {
                console.log('Failed to fetch services:', data.message);
                setServices([]);
            }
        } catch (error) {
            console.error('Error fetching category services:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchCategoryServices();
        setRefreshing(false);
    };

    const handleServicePress = (service: PlatformService) => {
        router.push({
            pathname: '/service-details/[id]',
            params: {
                id: service.id,
                name: service.name,
                price: service.price,
                description: service.description || '',
                imageUrl: service.imageUrl || '',
                categoryName: categoryInfo?.name,
            },
        });
    };

    const getCategoryColor = () => {
        return categoryInfo?.iconColor || '#e67e22';
    };

    const renderServiceCard = (service: PlatformService) => {
        const categoryColor = getCategoryColor();
        const initials = getInitials(service.name);
        
        return (
            <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                activeOpacity={0.7}
                onPress={() => handleServicePress(service)}
            >
                <View style={styles.cardMainContent}>
                    <View style={styles.serviceImageContainer}>
                        {service.imageUrl ? (
                            <Image 
                                source={{ uri: service.imageUrl }} 
                                style={styles.serviceImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.serviceImagePlaceholder, { backgroundColor: categoryColor + '15' }]}>
                                <Text style={[styles.serviceInitials, { color: categoryColor }]}>
                                    {initials}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName} numberOfLines={1}>
                            {service.name}
                        </Text>
                        <Text style={styles.serviceDescription} numberOfLines={2}>
                            {service.description || 'Professional service at your doorstep'}
                        </Text>
                        <View style={styles.serviceFooter}>
                            <View>
                                <Text style={styles.priceLabel}>Starting from</Text>
                                <Text style={styles.servicePrice}>
                                    रु {parseFloat(service.price || '0').toLocaleString()}
                                </Text>
                            </View>
                            {service.duration_minutes && (
                                <View style={styles.durationBadge}>
                                    <Ionicons name="time-outline" size={12} color="#64748b" />
                                    <Text style={styles.durationText}>
                                        {service.duration_minutes} mins
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={[styles.bookButton, { backgroundColor: categoryColor }]}>
                    <Text style={styles.bookButtonText}>Book</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                </View>
            </TouchableOpacity>
        );
    };

    const renderCategoryHeader = () => {
        const categoryColor = getCategoryColor();
        const categoryInitials = getInitials(categoryInfo?.name || (name as string));
        
        return (
            <LinearGradient
                colors={[categoryColor + '08', '#ffffff']}
                style={styles.headerContainer}
            >
                <View style={[styles.categoryIconWrapper, { borderColor: categoryColor + '20' }]}>
                    {categoryInfo?.iconUrl ? (
                        <Image 
                            source={{ uri: categoryInfo.iconUrl }} 
                            style={styles.categoryIcon}
                            resizeMode="contain"
                        />
                    ) : (
                        <Text style={[styles.categoryInitials, { color: categoryColor }]}>
                            {categoryInitials}
                        </Text>
                    )}
                </View>
                <Text style={styles.categoryName}>{categoryInfo?.name || name}</Text>
                {categoryInfo?.description && (
                    <Text style={styles.categoryDescription}>{categoryInfo.description}</Text>
                )}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <MaterialIcons name="handyman" size={16} color={categoryColor} />
                        <Text style={styles.statText}>
                            {services.length} {services.length === 1 ? 'Service' : 'Services'}
                        </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MaterialIcons name="star" size={16} color="#fbbf24" />
                        <Text style={styles.statText}>Trusted Pros</Text>
                    </View>
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
                    placeholder={`Search ${categoryInfo?.name || name} services...`}
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
            {renderCategoryHeader()}
            {renderSearchBar()}

            <View style={styles.servicesSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Available Services
                    </Text>
                    <Text style={styles.serviceCount}>{filteredServices.length} options</Text>
                </View>

                {filteredServices.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No services found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery ? 'Try a different search term' : 'No services available in this category yet'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.servicesList}>
                        {filteredServices.map(renderServiceCard)}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

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
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        backgroundColor: '#ffffff',
    },
    categoryIconWrapper: {
        width: 86,
        height: 86,
        borderRadius: 43,
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
    categoryIcon: {
        width: 50,
        height: 50,
    },
    categoryInitials: {
        fontSize: 30,
        fontWeight: '700',
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
    servicesSection: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    serviceCount: {
        fontSize: 12,
        color: '#94a3b8',
    },
    servicesList: {
        gap: 14,
    },
    serviceCard: {
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
    cardMainContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    serviceImageContainer: {
        width: 76,
        height: 76,
        borderRadius: 14,
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
        fontSize: 24,
        fontWeight: '700',
    },
    serviceInfo: {
        flex: 1,
        justifyContent: 'center',
        gap: 4,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.2,
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
        marginTop: 2,
    },
    priceLabel: {
        fontSize: 9,
        color: '#94a3b8',
    },
    servicePrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#e67e22',
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    durationText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '500',
    },
    bookButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 4,
    },
    bookButtonText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 10,
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});