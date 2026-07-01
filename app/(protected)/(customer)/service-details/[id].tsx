// app/(protected)/(customer)/service-details/[id].tsx

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
    Dimensions,
    Animated,
    Easing,
    Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { useLocation } from '../../../../context/LocationContext';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { useAddToCart } from '../../../../hooks/cart';

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

interface ServiceDetails {
    id: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
    duration_minutes: number | null;
    categoryName?: string;
}

interface Coordinates {
    latitude: number;
    longitude: number;
}

// ============================================
// HELPERS
// ============================================

const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

const hexToRgba = (hex: string, alpha: number): string => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const darkenHex = (hex: string, amount: number = 0.15): string => {
    const clean = hex.replace('#', '');
    let r = parseInt(clean.substring(0, 2), 16);
    let g = parseInt(clean.substring(2, 4), 16);
    let b = parseInt(clean.substring(4, 6), 16);
    r = Math.round(r * (1 - amount));
    g = Math.round(g * (1 - amount));
    b = Math.round(b * (1 - amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ServiceDetailsScreen() {
    const { id, name, price, description, imageUrl, categoryName, categoryColor } =
        useLocalSearchParams();
    const { user, token, refreshAccessToken, logout, isTokenRefreshing } = useAuth();
    const {
        address: contextAddress,
        coordinates: contextCoordinates,
        setCustomLocation,
    } = useLocation();
    const router = useRouter();
    const navigation = useNavigation();
    const { mutateAsync: addToCart } = useAddToCart();

    // Dynamic theming from category color
    const primaryColor = (categoryColor as string) || BLUE.primary;

    const [service, setService] = useState<ServiceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isInCart, setIsInCart] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Success animation states
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [bookingData, setBookingData] = useState<{
        requestId: string;
        serviceName: string;
    } | null>(null);
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    // Location states
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
    const [locationAddress, setLocationAddress] = useState<string>('');
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);
    const [manualAddress, setManualAddress] = useState('');
    const [locationMethod, setLocationMethod] = useState<'auto' | 'manual'>('auto');
    const [tempMarkerLocation, setTempMarkerLocation] = useState<Coordinates | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);

    const mapRef = useRef<MapView>(null);

    // ---- Initialize location modal state from context ----
    useEffect(() => {
        if (showLocationModal) {
            setTempMarkerLocation(contextCoordinates);
            setSelectedLocation(contextCoordinates);
            setLocationAddress(contextAddress || '');
            setManualAddress(contextAddress || '');
            setSearchResults([]);
            setSearchQuery('');
        }
    }, [showLocationModal]);

    // ---- Header config & initial fetch ----
    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Service Details',
            headerTitleStyle: { fontWeight: '600', fontSize: 18, color: BLUE.text },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: BLUE.white },
        });
        fetchServiceDetails();
    }, [id]);

    // ---- Success animation ----
    useEffect(() => {
        if (successModalVisible) {
            scaleAnim.setValue(0);
            checkAnim.setValue(0);
            fadeAnim.setValue(0);
            slideAnim.setValue(50);

            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 500,
                    easing: Easing.bounce,
                    useNativeDriver: true,
                }),
                Animated.timing(checkAnim, {
                    toValue: 1,
                    duration: 300,
                    easing: Easing.ease,
                    useNativeDriver: true,
                }),
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(slideAnim, {
                        toValue: 0,
                        duration: 400,
                        easing: Easing.out(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        }
    }, [successModalVisible]);

    // ============================================
    // DATA FETCHING
    // ============================================

    const fetchServiceDetails = async () => {
        setLoading(true);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/platform-services/${id}`;
            const response = await fetch(url);
            const data = await response.json();

            if (response.ok && data.success) {
                setService(data.service);
            } else {
                setService({
                    id: id as string,
                    name: name as string,
                    description: (description as string) || null,
                    price: price as string,
                    imageUrl: (imageUrl as string) || null,
                    duration_minutes: null,
                    categoryName: categoryName as string,
                });
            }
        } catch (error) {
            console.error('Error fetching service details:', error);
            setService({
                id: id as string,
                name: name as string,
                description: (description as string) || null,
                price: price as string,
                imageUrl: (imageUrl as string) || null,
                duration_minutes: null,
                categoryName: categoryName as string,
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // LOCATION HELPERS
    // ============================================

    const searchAddress = async (query: string) => {
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearchingAddress(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                { headers: { 'User-Agent': 'ServiceApp/1.0' } },
            );
            const data = await response.json();
            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching address:', error);
        } finally {
            setIsSearchingAddress(false);
        }
    };

    const handleSelectSearchResult = (result: any) => {
        const coords = {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
        };

        setTempMarkerLocation(coords);
        setSelectedLocation(coords);
        setLocationAddress(result.display_name);
        setManualAddress(result.display_name);
        setSearchResults([]);
        setSearchQuery('');
        Keyboard.dismiss();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const detectCurrentLocation = async () => {
        setIsDetectingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Please enable location permissions to use auto-detection.',
                );
                setLocationMethod('manual');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setTempMarkerLocation(coords);
            setSelectedLocation(coords);

            const addressResult = await Location.reverseGeocodeAsync(coords);
            if (addressResult.length > 0) {
                const { name: locName, street, city, country } = addressResult[0];
                const formattedAddress = `${locName || street || ''}, ${city || ''}, ${country || ''}`
                    .replace(/^,\s*|,\s*$/, '');
                setLocationAddress(formattedAddress);
                setManualAddress(formattedAddress);
            }

            if (mapRef.current) {
                mapRef.current.animateToRegion(
                    { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                    1000,
                );
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Error detecting location:', error);
            Alert.alert(
                'Error',
                'Failed to detect your location. Please try manual entry.',
            );
            setLocationMethod('manual');
        } finally {
            setIsDetectingLocation(false);
        }
    };

    const handleManualAddressSubmit = async () => {
        if (!manualAddress.trim()) {
            Alert.alert('Error', 'Please enter an address');
            return;
        }

        setIsDetectingLocation(true);
        try {
            const geocoded = await Location.geocodeAsync(manualAddress);
            if (geocoded.length > 0) {
                const coords = {
                    latitude: geocoded[0].latitude,
                    longitude: geocoded[0].longitude,
                };
                setTempMarkerLocation(coords);
                setSelectedLocation(coords);
                setLocationAddress(manualAddress);

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Alert.alert('Error', 'Address not found. Please try a different address.');
            }
        } catch (error) {
            console.error('Error geocoding address:', error);
            Alert.alert('Error', 'Failed to find location. Please check the address.');
        } finally {
            setIsDetectingLocation(false);
        }
    };

    const confirmLocation = async () => {
        if (tempMarkerLocation) {
            await setCustomLocation({
                latitude: tempMarkerLocation.latitude,
                longitude: tempMarkerLocation.longitude,
                address: locationAddress,
            });
            setShowLocationModal(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            Alert.alert('Location Empty', 'Please select or discover a location before saving.');
        }
    };

    // ============================================
    // CART & BOOKING ACTIONS
    // ============================================

    const handleAddToCart = async () => {
        if (isUpdating || !service) return;
        setIsUpdating(true);

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await addToCart({ serviceItemId: service.id, quantity: 1 });
            setIsInCart(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Added to Cart', `${service.name} has been added to your cart.`, [
                { text: 'Continue Shopping', style: 'cancel' },
                { text: 'View Cart', onPress: () => router.push('/cart') },
            ]);
        } catch (error) {
            console.error('Error adding to cart:', error);
            Alert.alert('Error', 'Failed to add to cart. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsUpdating(false);
        }
    };

    // ✅ FIXED: Order Now adds to cart directly
    const handleOrderNow = async () => {
        if (!contextCoordinates) {
            Alert.alert(
                'Location Required',
                'Please set your service location before ordering.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Set Location', onPress: () => setShowLocationModal(true) },
                ],
            );
            return;
        }
        
        if (!token) {
            Alert.alert('Error', 'Please login to continue');
            router.replace('/(auth)/login');
            return;
        }

        if (!service) {
            Alert.alert('Error', 'Service not available');
            return;
        }

        // ✅ Add to cart directly
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await addToCart({ serviceItemId: service.id, quantity: 1 });
            setIsInCart(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // ✅ Navigate to cart directly
            router.push('/cart');
        } catch (error) {
            console.error('Error adding to cart:', error);
            Alert.alert('Error', 'Failed to add to cart. Please try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsUpdating(false);
        }
    };

    const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
        let currentToken = token;
        if (!currentToken) throw new Error('No token available');

        const makeRequest = async (authToken: string) => {
            return fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                    Authorization: `Bearer ${authToken}`,
                },
            });
        };

        let response = await makeRequest(currentToken);

        if (response.status === 401) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                response = await makeRequest(newToken);
            } else {
                Alert.alert('Session Expired', 'Your session has expired. Please login again.', [
                    {
                        text: 'OK',
                        onPress: () => {
                            logout();
                            router.replace('/(auth)/login');
                        },
                    },
                ]);
                throw new Error('Session expired');
            }
        }
        return response;
    };

    const handleSuccessAction = (action: 'home' | 'status') => {
        setSuccessModalVisible(false);
        if (action === 'home') {
            router.push('/(protected)/(customer)');
        } else if (action === 'status' && bookingData) {
            router.push(`/service-status/${bookingData.requestId}`);
        }
    };

    // ============================================
    // RENDER: SERVICE DETAILS
    // ============================================

    const getServiceData = () =>
        service || {
            id: id as string,
            name: name as string,
            description: description as string,
            price: price as string,
            imageUrl: imageUrl as string,
        };

    const renderServiceDetails = () => {
        const data = getServiceData();
        const initials = getInitials(data.name);

        return (
            <>
                {/* ---- Hero Image ---- */}
                <View style={styles.imageContainer}>
                    {data.imageUrl ? (
                        <Image
                            source={{ uri: data.imageUrl }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={[primaryColor, darkenHex(primaryColor, 0.2)]}
                            style={styles.heroImagePlaceholder}
                        >
                            <Text style={styles.heroInitials}>{initials}</Text>
                        </LinearGradient>
                    )}

                    {/* Gradient overlay for readability */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.45)']}
                        style={styles.imageGradientOverlay}
                    />

                    {/* Price badge — positioned at bottom-left over the gradient */}
                    <View style={[styles.priceBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.priceBadgeText}>
                            रु {parseFloat(data.price || '0').toLocaleString('en-IN')}
                        </Text>
                    </View>
                </View>

                {/* ---- Service Info ---- */}
                <View style={[styles.infoContainer, { backgroundColor: BLUE.white }]}>
                    {categoryName && (
                        <View
                            style={[
                                styles.categoryChip,
                                { backgroundColor: hexToRgba(primaryColor, 0.08) },
                            ]}
                        >
                            <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600' }}>
                                {categoryName}
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.serviceName, { color: BLUE.text }]}>{data.name}</Text>

                    {service?.duration_minutes && (
                        <View style={styles.durationRow}>
                            <Ionicons name="time-outline" size={16} color={BLUE.textTertiary} />
                            <Text style={[styles.durationText, { color: BLUE.textSecondary }]}>
                                {service.duration_minutes} minutes estimated
                            </Text>
                        </View>
                    )}

                    {data.description && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: BLUE.text }]}>Description</Text>
                            <Text style={[styles.descriptionText, { color: BLUE.textSecondary }]}>{data.description}</Text>
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: BLUE.text }]}>What&apos;s Included</Text>
                        <View style={styles.featuresList}>
                            {[
                                { icon: 'verified', label: 'Professional & insured' },
                                { icon: 'timer', label: 'On-time arrival guaranteed' },
                                { icon: 'security', label: 'Quality workmanship' },
                                { icon: 'support-agent', label: '24/7 customer support' },
                            ].map((feat) => (
                                <View key={feat.icon} style={styles.featureItem}>
                                    <MaterialIcons name={feat.icon as any} size={20} color={primaryColor} />
                                    <Text style={[styles.featureText, { color: BLUE.textSecondary }]}>{feat.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ---- Location ---- */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: BLUE.text }]}>Service Location</Text>
                        <TouchableOpacity
                            style={[
                                styles.locationCard,
                                { borderColor: hexToRgba(primaryColor, 0.12) },
                            ]}
                            onPress={() => setShowLocationModal(true)}
                            activeOpacity={0.7}
                        >
                            <View
                                style={[
                                    styles.locationIconContainer,
                                    { backgroundColor: hexToRgba(primaryColor, 0.08) },
                                ]}
                            >
                                <Ionicons name="location-sharp" size={22} color={primaryColor} />
                            </View>
                            <View style={styles.locationInfo}>
                                <Text style={[styles.locationLabel, { color: BLUE.textTertiary }]}>Your Address</Text>
                                <Text style={[styles.locationAddress, { color: BLUE.text }]} numberOfLines={2}>
                                    {contextAddress || 'Tap to set your location'}
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={BLUE.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom spacer so footer doesn't overlap last section */}
                    <View style={styles.contentBottomSpacer} />
                </View>
            </>
        );
    };

    // ============================================
    // RENDER: FOOTER
    // ============================================

    const renderFooter = () => {
        const data = getServiceData();

        return (
            <View style={[styles.footer, { backgroundColor: BLUE.white, borderTopColor: BLUE.border }]}>
                <View style={styles.priceContainer}>
                    <Text style={[styles.priceLabel, { color: BLUE.textTertiary }]}>Price</Text>
                    <Text style={[styles.priceAmount, { color: primaryColor }]}>
                        रु {parseFloat(data.price || '0').toLocaleString('en-IN')}
                    </Text>
                </View>
                <View style={styles.buttonGroup}>
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            isInCart && [
                                styles.addedButton,
                                {
                                    borderColor: primaryColor,
                                    backgroundColor: hexToRgba(primaryColor, 0.06),
                                },
                            ],
                            { borderColor: BLUE.border, backgroundColor: BLUE.white },
                        ]}
                        onPress={handleAddToCart}
                        disabled={isUpdating}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={isInCart ? 'checkmark-circle' : 'cart-outline'}
                            size={20}
                            color={isInCart ? primaryColor : BLUE.textTertiary}
                        />
                        <Text
                            style={[styles.addButtonText, isInCart && { color: primaryColor }, { color: BLUE.textSecondary }]}
                        >
                            {isInCart ? 'Added' : 'Cart'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.bookButton, { backgroundColor: primaryColor }]}
                        onPress={handleOrderNow}
                        disabled={isTokenRefreshing || isUpdating}
                        activeOpacity={0.85}
                    >
                        {isTokenRefreshing ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={[styles.bookButtonText, { color: BLUE.textInverse }]}>Order Now</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // ============================================
    // RENDER: LOCATION MODAL
    // ============================================

    const renderLocationModal = () => {
        return (
            <Modal
                visible={showLocationModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowLocationModal(false)}
            >
                <SafeAreaView style={[styles.locationModalSafeArea, { backgroundColor: BLUE.background }]} edges={['top']}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity
                                    onPress={() => setShowLocationModal(false)}
                                    style={styles.modalCloseButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close" size={24} color={BLUE.text} />
                                </TouchableOpacity>
                                <Text style={[styles.modalTitle, { color: BLUE.text }]}>Select Location</Text>
                                <View style={{ width: 40 }} />
                            </View>

                            {/* Method selector */}
                            <View style={[styles.methodSelector, { backgroundColor: BLUE.white, borderColor: BLUE.border }]}>
                                {(['auto', 'manual'] as const).map((method) => (
                                    <TouchableOpacity
                                        key={method}
                                        style={[
                                            styles.methodButton,
                                            locationMethod === method && [
                                                styles.methodButtonActive,
                                                { borderColor: primaryColor },
                                            ],
                                        ]}
                                        onPress={() => setLocationMethod(method)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons
                                            name={method === 'auto' ? 'location' : 'create-outline'}
                                            size={20}
                                            color={locationMethod === method ? primaryColor : BLUE.textTertiary}
                                        />
                                        <Text
                                            style={[
                                                styles.methodText,
                                                locationMethod === method && {
                                                    color: primaryColor,
                                                    fontWeight: '600',
                                                },
                                                { color: BLUE.textSecondary },
                                            ]}
                                        >
                                            {method === 'auto' ? 'Auto Detect' : 'Enter Manually'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <ScrollView
                                style={styles.locationModalBody}
                                contentContainerStyle={styles.locationModalBodyContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                {locationMethod === 'auto'
                                    ? renderAutoLocation()
                                    : renderManualLocation()}
                            </ScrollView>

                            <View style={[styles.modalFooter, { borderTopColor: BLUE.border }]}>
                                <TouchableOpacity
                                    style={[styles.cancelButton, { borderColor: BLUE.border, backgroundColor: BLUE.white }]}
                                    onPress={() => setShowLocationModal(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.cancelButtonText, { color: BLUE.textSecondary }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.confirmButton,
                                        { backgroundColor: primaryColor },
                                        !tempMarkerLocation && styles.confirmButtonDisabled,
                                    ]}
                                    onPress={confirmLocation}
                                    disabled={!tempMarkerLocation}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.confirmButtonText, { color: BLUE.textInverse }]}>Confirm Location</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </SafeAreaView>
            </Modal>
        );
    };

    const renderAutoLocation = () => {
        if (!tempMarkerLocation) {
            return (
                <View style={styles.detectContainer}>
                    <View
                        style={[
                            styles.detectIconContainer,
                            { backgroundColor: hexToRgba(primaryColor, 0.08) },
                        ]}
                    >
                        <Ionicons name="locate" size={48} color={primaryColor} />
                    </View>
                    <Text style={[styles.detectTitle, { color: BLUE.text }]}>Detect Your Location</Text>
                    <Text style={[styles.detectSubtitle, { color: BLUE.textSecondary }]}>
                        We&apos;ll use your GPS to find your current location
                    </Text>
                    <TouchableOpacity
                        style={[styles.detectButton, { backgroundColor: primaryColor }]}
                        onPress={detectCurrentLocation}
                        disabled={isDetectingLocation}
                        activeOpacity={0.85}
                    >
                        {isDetectingLocation ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Ionicons name="location-sharp" size={20} color="#fff" />
                                <Text style={[styles.detectButtonText, { color: BLUE.textInverse }]}>Detect Location</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: tempMarkerLocation.latitude,
                        longitude: tempMarkerLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                >
                    <Marker
                        coordinate={tempMarkerLocation}
                        draggable
                        onDragEnd={(e) => {
                            const coords = e.nativeEvent.coordinate;
                            setTempMarkerLocation(coords);
                            setSelectedLocation(coords);
                            Location.reverseGeocodeAsync(coords).then((result) => {
                                if (result.length > 0) {
                                    const { name: locName, street, city, country } = result[0];
                                    const addr = `${locName || street || ''}, ${city || ''}, ${country || ''}`
                                        .replace(/^,\s*|,\s*$/, '');
                                    setLocationAddress(addr);
                                    setManualAddress(addr);
                                }
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        <View style={styles.markerContainer}>
                            <View style={[styles.markerPulse, { backgroundColor: hexToRgba(primaryColor, 0.2) }]} />
                            <View style={[styles.markerPin, { backgroundColor: primaryColor }]}>
                                <Ionicons name="location" size={24} color="#fff" />
                            </View>
                        </View>
                    </Marker>
                </MapView>
                <View style={[styles.mapAddressContainer, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
                    <Ionicons name="location-sharp" size={18} color={primaryColor} />
                    <Text style={[styles.mapAddressText, { color: BLUE.text }]} numberOfLines={2}>
                        {locationAddress || 'Drag pin to set location'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.recenterButton, { borderColor: primaryColor, backgroundColor: BLUE.white }]}
                    onPress={detectCurrentLocation}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="locate" size={20} color={primaryColor} />
                </TouchableOpacity>
            </View>
        );
    };

    const renderManualLocation = () => {
        return (
            <View style={styles.manualLocationContainer}>
                {/* Search input */}
                <View style={styles.searchInputWrapper}>
                    <View
                        style={[
                            styles.searchInputContainer,
                            { borderColor: hexToRgba(primaryColor, 0.3), backgroundColor: BLUE.white },
                        ]}
                    >
                        <Feather name="search" size={20} color={BLUE.textTertiary} />
                        <TextInput
                            style={[styles.searchAddressInput, { color: BLUE.text }]}
                            placeholder="Search for a location..."
                            placeholderTextColor={BLUE.textTertiary}
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                searchAddress(text);
                            }}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close-circle" size={18} color={BLUE.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSearchingAddress && (
                        <View style={styles.searchingContainer}>
                            <ActivityIndicator size="small" color={primaryColor} />
                            <Text style={[styles.searchingText, { color: BLUE.textSecondary }]}>Searching...</Text>
                        </View>
                    )}

                    {searchResults.length > 0 && (
                        <View style={[styles.searchResultsContainer, { backgroundColor: BLUE.white, borderColor: BLUE.border }]}>
                            {searchResults.map((result, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.searchResultItem, { borderBottomColor: BLUE.borderLight }]}
                                    onPress={() => handleSelectSearchResult(result)}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        style={[
                                            styles.searchResultIcon,
                                            { backgroundColor: hexToRgba(primaryColor, 0.08) },
                                        ]}
                                    >
                                        <Ionicons
                                            name="location-outline"
                                            size={18}
                                            color={primaryColor}
                                        />
                                    </View>
                                    <View style={styles.searchResultTextContainer}>
                                        <Text style={[styles.searchResultTitle, { color: BLUE.text }]} numberOfLines={1}>
                                            {result.display_name.split(',')[0]}
                                        </Text>
                                        <Text style={[styles.searchResultSubtitle, { color: BLUE.textSecondary }]} numberOfLines={2}>
                                            {result.display_name}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Manual address text input */}
                <View style={styles.manualInputWrapper}>
                    <Text style={[styles.manualInputLabel, { color: BLUE.text }]}>Or type your address</Text>
                    <View
                        style={[
                            styles.manualInputContainer,
                            { borderColor: hexToRgba(primaryColor, 0.3), backgroundColor: BLUE.white },
                        ]}
                    >
                        <Ionicons name="create-outline" size={18} color={BLUE.textTertiary} />
                        <TextInput
                            style={[styles.manualAddressInput, { color: BLUE.text }]}
                            placeholder="e.g. Lazimpat, Kathmandu"
                            placeholderTextColor={BLUE.textTertiary}
                            value={manualAddress}
                            onChangeText={setManualAddress}
                            returnKeyType="done"
                            onSubmitEditing={handleManualAddressSubmit}
                        />
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.geocodeButton,
                            { backgroundColor: primaryColor },
                            (isDetectingLocation || !manualAddress.trim()) &&
                            styles.geocodeButtonDisabled,
                        ]}
                        onPress={handleManualAddressSubmit}
                        disabled={isDetectingLocation || !manualAddress.trim()}
                        activeOpacity={0.85}
                    >
                        {isDetectingLocation ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <MaterialIcons name="my-location" size={18} color="#fff" />
                                <Text style={[styles.geocodeButtonText, { color: BLUE.textInverse }]}>Find on Map</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Preview map when location is selected */}
                {tempMarkerLocation && (
                    <View
                        style={[
                            styles.previewMapContainer,
                            { borderColor: hexToRgba(primaryColor, 0.2), backgroundColor: BLUE.white },
                        ]}
                    >
                        <View style={styles.previewMapHeader}>
                            <Text style={[styles.previewMapTitle, { color: BLUE.text }]}>Selected Location</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setTempMarkerLocation(null);
                                    setSelectedLocation(null);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="refresh" size={20} color={primaryColor} />
                            </TouchableOpacity>
                        </View>
                        <MapView
                            style={styles.previewMap}
                            provider={PROVIDER_GOOGLE}
                            region={{
                                latitude: tempMarkerLocation.latitude,
                                longitude: tempMarkerLocation.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                        >
                            <Marker coordinate={tempMarkerLocation}>
                                <View
                                    style={[
                                        styles.markerPin,
                                        { backgroundColor: primaryColor, width: 32, height: 32 },
                                    ]}
                                >
                                    <Ionicons name="location" size={16} color="#fff" />
                                </View>
                            </Marker>
                        </MapView>
                        <View style={[styles.previewAddressContainer, { borderTopColor: BLUE.borderLight }]}>
                            <Ionicons name="location-sharp" size={16} color={primaryColor} />
                            <Text style={[styles.previewAddressText, { color: BLUE.textSecondary }]} numberOfLines={2}>
                                {locationAddress}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // ============================================
    // RENDER: SUCCESS MODAL
    // ============================================

    const renderSuccessModal = () => {
        return (
            <Modal
                visible={successModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={styles.successOverlay}>
                    <TouchableWithoutFeedback onPress={() => setSuccessModalVisible(false)}>
                        <View style={styles.successOverlayTapArea} />
                    </TouchableWithoutFeedback>

                    <Animated.View
                        style={[
                            styles.successContainer,
                            {
                                transform: [{ scale: scaleAnim }],
                                opacity: scaleAnim,
                            },
                        ]}
                    >
                        {/* Success icon */}
                        <View style={styles.successIconContainer}>
                            <LinearGradient
                                colors={['#10b981', '#059669']}
                                style={styles.successCircle}
                            >
                                <Animated.View
                                    style={{
                                        transform: [
                                            {
                                                scale: checkAnim.interpolate({
                                                    inputRange: [0, 0.5, 1],
                                                    outputRange: [0, 1.2, 1],
                                                }),
                                            },
                                        ],
                                    }}
                                >
                                    <Ionicons name="checkmark" size={60} color="#fff" />
                                </Animated.View>
                            </LinearGradient>
                        </View>

                        {/* Success text */}
                        <Animated.View style={{ opacity: fadeAnim }}>
                            <Text style={[styles.successTitle, { color: BLUE.text }]}>Booking Confirmed!</Text>
                            <Animated.View
                                style={{
                                    transform: [{ translateY: slideAnim }],
                                }}
                            >
                                <Text style={[styles.successSubtitle, { color: BLUE.textSecondary }]}>
                                    {bookingData?.serviceName || 'Your service'} has been booked
                                    successfully.
                                </Text>
                                {bookingData?.requestId && (
                                    <View style={[styles.requestIdContainer, { backgroundColor: BLUE.background }]}>
                                        <Text style={[styles.requestIdLabel, { color: BLUE.textTertiary }]}>Request ID</Text>
                                        <Text style={[styles.requestIdValue, { color: BLUE.text }]}>
                                            {bookingData.requestId}
                                        </Text>
                                    </View>
                                )}
                            </Animated.View>
                        </Animated.View>

                        {/* Actions */}
                        <Animated.View
                            style={[
                                styles.successActions,
                                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                            ]}
                        >
                            <TouchableOpacity
                                style={[styles.successHomeButton, { borderColor: BLUE.border, backgroundColor: BLUE.white }]}
                                onPress={() => handleSuccessAction('home')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.successHomeButtonText, { color: BLUE.textSecondary }]}>Go Home</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.successTrackButton, { backgroundColor: primaryColor }]}
                                onPress={() => handleSuccessAction('status')}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="navigate" size={18} color="#fff" />
                                <Text style={[styles.successTrackButtonText, { color: BLUE.textInverse }]}>Track Status</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </View>
            </Modal>
        );
    };

    // ============================================
    // MAIN RENDER
    // ============================================

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: BLUE.background }]}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={[styles.loadingText, { color: BLUE.textSecondary }]}>Loading service details...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: BLUE.background }]} edges={['bottom']}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {renderServiceDetails()}
            </ScrollView>

            {renderFooter()}
            {renderLocationModal()}
            {renderSuccessModal()}
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // ---- Loading ----
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },

    // ---- Hero image ----
    imageContainer: {
        position: 'relative',
        height: 220,
        backgroundColor: '#e2e8f0',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroImagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroInitials: {
        fontSize: 56,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.85)',
    },
    imageGradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
    },
    priceBadge: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    priceBadgeText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },

    // ---- Info section ----
    infoContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -20,
        position: 'relative',
        zIndex: 2,
    },
    categoryChip: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 8,
    },
    serviceName: {
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    durationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    durationText: {
        fontSize: 13,
        fontWeight: '500',
    },
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    descriptionText: {
        fontSize: 14,
        lineHeight: 22,
    },
    featuresList: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureText: {
        fontSize: 14,
        fontWeight: '500',
    },

    // ---- Location card ----
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 12,
    },
    locationIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    locationAddress: {
        fontSize: 14,
        fontWeight: '500',
    },
    contentBottomSpacer: {
        height: 20,
    },

    // ---- Fixed footer ----
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
    },
    priceContainer: {
        flexShrink: 0,
    },
    priceLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    priceAmount: {
        fontSize: 18,
        fontWeight: '800',
    },
    buttonGroup: {
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
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
    bookButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    bookButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },

    // ---- Location modal ----
    locationModalSafeArea: {
        flex: 1,
    },
    modalContainer: {
        flex: 1,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodSelector: {
        flexDirection: 'row',
        marginHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
        padding: 4,
    },
    methodButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 10,
    },
    methodButtonActive: {
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
    },
    methodText: {
        fontSize: 13,
        fontWeight: '500',
    },
    locationModalBody: {
        flex: 1,
        marginTop: 16,
    },
    locationModalBodyContent: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },

    // ---- Auto location ----
    detectContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    detectIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    detectTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    detectSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    detectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    detectButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },

    // ---- Map ----
    mapContainer: {
        height: 320,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerPulse: {
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    markerPin: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    mapAddressContainer: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    mapAddressText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
    },
    recenterButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 12,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // ---- Manual location ----
    manualLocationContainer: {
        gap: 16,
    },
    searchInputWrapper: {
        gap: 0,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 14,
        height: 48,
        gap: 10,
    },
    searchAddressInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 0,
    },
    searchingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    searchingText: {
        fontSize: 13,
    },
    searchResultsContainer: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderBottomWidth: 1,
    },
    searchResultIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    searchResultTextContainer: {
        flex: 1,
    },
    searchResultTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    searchResultSubtitle: {
        fontSize: 12,
        lineHeight: 16,
    },

    // ---- Manual address input ----
    manualInputWrapper: {
        gap: 10,
    },
    manualInputLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 2,
    },
    manualInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.5,
        paddingHorizontal: 14,
        height: 48,
        gap: 10,
    },
    manualAddressInput: {
        flex: 1,
        fontSize: 14,
        paddingVertical: 0,
    },
    geocodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
    },
    geocodeButtonDisabled: {
        opacity: 0.5,
    },
    geocodeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },

    // ---- Preview map ----
    previewMapContainer: {
        borderRadius: 16,
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    previewMapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
    },
    previewMapTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    previewMap: {
        height: 160,
        width: '100%',
    },
    previewAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderTopWidth: 1,
    },
    previewAddressText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },

    // ---- Success modal ----
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successOverlayTapArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    successContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 32,
        width: width * 0.85,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
    successIconContainer: {
        marginBottom: 20,
    },
    successCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    successSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
    },
    requestIdContainer: {
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        width: '100%',
        marginBottom: 4,
    },
    requestIdLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    requestIdValue: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    successActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
        marginTop: 24,
    },
    successHomeButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    successHomeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    successTrackButton: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    successTrackButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
});