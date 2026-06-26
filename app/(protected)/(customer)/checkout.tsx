// app/(protected)/(customer)/checkout.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons, Feather, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    Layout,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

// ============================================
// CONSTANTS
// ============================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// ============================================
// TYPES
// ============================================

interface CheckoutItem {
    id: string;
    serviceName: string;
    name?: string;
    price: number;
    quantity: number;
    total: number;
    description?: string;
    imageUrl?: string;
    durationMinutes?: number | null;
}

interface OrderDetails {
    address: string;
    city: string;
    zipCode: string;
    notes: string;
    paymentMethod: 'cash' | 'card' | 'online';
    latitude?: number;
    longitude?: number;
    placeId?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CheckoutScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams();
    const scrollViewRef = useRef<ScrollView>(null);
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [showMapModal, setShowMapModal] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);

    const [orderDetails, setOrderDetails] = useState<OrderDetails>({
        address: '',
        city: '',
        zipCode: '',
        notes: '',
        paymentMethod: 'cash',
        latitude: 27.7172,
        longitude: 85.3240,
    });

    const [cartItems, setCartItems] = useState<CheckoutItem[]>([]);
    const [subtotal, setSubtotal] = useState(0);
    const [tax, setTax] = useState(0);
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [total, setTotal] = useState(0);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
    } | null>(null);

    const TAX_RATE = 0.13;
    const DELIVERY_FEE = 50;
    const THEME_COLOR = '#2563eb';
    const THEME_COLOR_LIGHT = '#3b82f6';
    const THEME_COLOR_DARK = '#1d4ed8';

    // Animation values
    const progressWidth = useSharedValue(0);
    const stepOpacity = useSharedValue(1);

    useEffect(() => {
        // Parse cart data from params
        if (params.items) {
            try {
                const parsedItems = JSON.parse(params.items as string);
                // Map the items to the expected format
                const mappedItems = parsedItems.map((item: any) => ({
                    id: item.id || item.serviceId,
                    serviceName: item.name || item.serviceName || 'Service',
                    name: item.name || item.serviceName,
                    price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
                    quantity: item.quantity || 1,
                    total: (typeof item.price === 'string' ? parseFloat(item.price) : item.price) * (item.quantity || 1),
                    description: item.description,
                    imageUrl: item.imageUrl,
                    durationMinutes: item.durationMinutes,
                }));
                setCartItems(mappedItems);
            } catch (error) {
                console.error('Error parsing checkout items:', error);
                setCartItems([]);
            }
        }

        if (params.subtotal) setSubtotal(parseFloat(params.subtotal as string));
        if (params.tax) setTax(parseFloat(params.tax as string));
        if (params.deliveryFee) setDeliveryFee(parseFloat(params.deliveryFee as string));
        if (params.discount) setDiscount(parseFloat(params.discount as string) || 0);
        if (params.total) setTotal(parseFloat(params.total as string));
    }, [params]);

    useEffect(() => {
        navigation.setOptions({
            title: 'Checkout',
            headerTitleStyle: { fontWeight: '600', fontSize: 18, color: '#0f172a' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
            headerLeft: () => (
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
            ),
        });
    }, []);

    useEffect(() => {
        progressWidth.value = withSpring((currentStep - 1) * 50, {
            damping: 15,
            stiffness: 100,
        });
        stepOpacity.value = withTiming(1, { duration: 300 });
    }, [currentStep]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setIsKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setIsKeyboardVisible(false);
        });

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const getCurrentLocation = async () => {
        setIsLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location access to use this feature.');
                setIsLoadingLocation(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const { latitude, longitude } = location.coords;

            // Reverse geocode to get address
            const addressResponse = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            const address = addressResponse[0];
            const formattedAddress = `${address.street || ''} ${address.district || ''} ${address.city || ''} ${address.region || ''}`.trim();

            setSelectedLocation({
                latitude,
                longitude,
                address: formattedAddress || 'Current Location',
            });

            setOrderDetails({
                ...orderDetails,
                address: formattedAddress || '',
                city: address.city || '',
                zipCode: address.postalCode || '',
                latitude,
                longitude,
            });

            // Animate map to location
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            }

            setShowMapModal(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert('Error', 'Failed to get current location. Please try again.');
        } finally {
            setIsLoadingLocation(false);
        }
    };

    const openMapSelector = () => {
        setShowMapModal(true);
        if (orderDetails.latitude && orderDetails.longitude && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: orderDetails.latitude,
                longitude: orderDetails.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 1000);
        }
    };

    const confirmLocation = async () => {
        if (selectedLocation) {
            // Reverse geocode to get full address
            try {
                const addressResponse = await Location.reverseGeocodeAsync({
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });

                const address = addressResponse[0];
                const formattedAddress = `${address.street || ''} ${address.district || ''} ${address.city || ''} ${address.region || ''}`.trim();

                setOrderDetails({
                    ...orderDetails,
                    address: formattedAddress || selectedLocation.address || '',
                    city: address.city || '',
                    zipCode: address.postalCode || '',
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                console.error('Error reverse geocoding:', error);
                setOrderDetails({
                    ...orderDetails,
                    address: selectedLocation.address || '',
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude,
                });
            }
        }
        setShowMapModal(false);
    };

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!orderDetails.address.trim()) newErrors.address = 'Please select your delivery address';
            if (!orderDetails.city.trim()) newErrors.city = 'City is required';
            if (!orderDetails.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 2) {
                setCurrentStep(currentStep + 1);
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
                handlePlaceOrder();
            }
        } else {
            const firstErrorKey = Object.keys(errors)[0];
            if (firstErrorKey) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Validation Error', errors[firstErrorKey]);
            }
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handlePlaceOrder = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            if (!token) {
                Alert.alert('Error', 'Please login to place order');
                return;
            }

            // Prepare order data from cart items
            const orderData = {
                items: cartItems.map(item => ({
                    serviceItemId: item.id,
                    quantity: item.quantity || 1,
                })),
                address: orderDetails.address,
                city: orderDetails.city || '',
                zipCode: orderDetails.zipCode || '',
                latitude: orderDetails.latitude,
                longitude: orderDetails.longitude,
                customerNotes: orderDetails.notes || '',
                paymentMethod: orderDetails.paymentMethod || 'cash',
            };

            console.log('📦 Placing order:', JSON.stringify(orderData, null, 2));

            const response = await fetch(`${API_BASE_URL}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Clear cart after successful order
                // You can clear the cart state here if needed
                router.replace({
                    pathname: '/order-success',
                    params: { orderId: data.order.id },
                });
            } else {
                Alert.alert('Error', data.message || 'Failed to place order');
            }
        } catch (error: any) {
            console.error('❌ Order error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to place order. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <View style={styles.stepIndicatorContainer}>
            <View style={styles.stepsWrapper}>
                {[1, 2].map((step) => (
                    <View key={step} style={styles.stepItem}>
                        <View
                            style={[
                                styles.stepCircle,
                                step <= currentStep ? styles.stepCircleActive : styles.stepCircleInactive,
                            ]}
                        >
                            {step < currentStep ? (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                            ) : (
                                <Text style={styles.stepNumber}>{step}</Text>
                            )}
                        </View>
                        <Text
                            style={[
                                styles.stepLabel,
                                step <= currentStep ? styles.stepLabelActive : styles.stepLabelInactive,
                            ]}
                        >
                            {step === 1 ? 'Delivery Address' : 'Confirm'}
                        </Text>
                    </View>
                ))}
            </View>
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, { width: `${(currentStep - 1) * 50}%` }]} />
                </View>
            </View>
        </View>
    );

    const renderAddressStep = () => (
        <Animated.View entering={FadeInDown.springify()} style={styles.stepContainer}>
            <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Delivery Address</Text>
                <Text style={styles.stepSubtitle}>Where should we deliver your service?</Text>
            </View>

            <View style={styles.formContainer}>
                <TouchableOpacity
                    style={styles.locationButton}
                    onPress={getCurrentLocation}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[THEME_COLOR + '10', THEME_COLOR + '05']}
                        style={styles.locationButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={styles.locationButtonContent}>
                            <View style={[styles.locationIconWrapper, { backgroundColor: THEME_COLOR + '20' }]}>
                                <Ionicons name="locate" size={22} color={THEME_COLOR} />
                            </View>
                            <View style={styles.locationButtonText}>
                                <Text style={styles.locationButtonTitle}>Use Current Location</Text>
                                <Text style={styles.locationButtonSubtitle}>Get your current address automatically</Text>
                            </View>
                            {isLoadingLocation ? (
                                <ActivityIndicator size="small" color={THEME_COLOR} />
                            ) : (
                                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                            )}
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.orDivider}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.orLine} />
                </View>

                <TouchableOpacity
                    style={styles.mapButton}
                    onPress={openMapSelector}
                    activeOpacity={0.8}
                >
                    <View style={styles.mapButtonContent}>
                        <View style={[styles.mapIconWrapper, { backgroundColor: THEME_COLOR + '10' }]}>
                            <MaterialIcons name="map" size={24} color={THEME_COLOR} />
                        </View>
                        <View style={styles.mapButtonText}>
                            <Text style={styles.mapButtonTitle}>Choose on Map</Text>
                            <Text style={styles.mapButtonSubtitle}>Select location by dropping a pin</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                    </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Street Address</Text>
                    <View style={[styles.inputWrapper, errors.address && styles.inputError]}>
                        <Feather name="map-pin" size={20} color="#94a3b8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="123 Main Street"
                            placeholderTextColor="#94a3b8"
                            value={orderDetails.address}
                            onChangeText={(text) => setOrderDetails({ ...orderDetails, address: text })}
                        />
                        {orderDetails.address && (
                            <TouchableOpacity onPress={() => setOrderDetails({ ...orderDetails, address: '' })}>
                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
                </View>

                <View style={styles.rowInputs}>
                    <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.inputLabel}>City</Text>
                        <View style={[styles.inputWrapper, errors.city && styles.inputError]}>
                            <TextInput
                                style={styles.input}
                                placeholder="Kathmandu"
                                placeholderTextColor="#94a3b8"
                                value={orderDetails.city}
                                onChangeText={(text) => setOrderDetails({ ...orderDetails, city: text })}
                            />
                        </View>
                        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
                    </View>

                    <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={styles.inputLabel}>ZIP Code</Text>
                        <View style={[styles.inputWrapper, errors.zipCode && styles.inputError]}>
                            <TextInput
                                style={styles.input}
                                placeholder="44600"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={orderDetails.zipCode}
                                onChangeText={(text) => setOrderDetails({ ...orderDetails, zipCode: text })}
                            />
                        </View>
                        {errors.zipCode && <Text style={styles.errorText}>{errors.zipCode}</Text>}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Special Instructions (Optional)</Text>
                    <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Any special instructions for delivery..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            value={orderDetails.notes}
                            onChangeText={(text) => setOrderDetails({ ...orderDetails, notes: text })}
                        />
                    </View>
                </View>
            </View>
        </Animated.View>
    );

    const renderConfirmStep = () => (
        <Animated.View entering={FadeInDown.springify()} style={styles.stepContainer}>
            <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>Confirm Order</Text>
                <Text style={styles.stepSubtitle}>Review your order details</Text>
            </View>

            <View style={styles.confirmContainer}>
                <View style={styles.confirmSection}>
                    <View style={styles.confirmSectionHeader}>
                        <Ionicons name="location-outline" size={20} color={THEME_COLOR} />
                        <Text style={styles.confirmSectionTitle}>Delivery Address</Text>
                    </View>
                    <Text style={styles.confirmText}>
                        <Text style={styles.confirmLabel}>Address: </Text>
                        {orderDetails.address}
                    </Text>
                    <Text style={styles.confirmText}>
                        <Text style={styles.confirmLabel}>City: </Text>
                        {orderDetails.city}
                    </Text>
                    <Text style={styles.confirmText}>
                        <Text style={styles.confirmLabel}>ZIP: </Text>
                        {orderDetails.zipCode}
                    </Text>
                    {orderDetails.notes && (
                        <Text style={styles.confirmText}>
                            <Text style={styles.confirmLabel}>Notes: </Text>
                            {orderDetails.notes}
                        </Text>
                    )}
                </View>

                <View style={styles.confirmSection}>
                    <View style={styles.confirmSectionHeader}>
                        <Ionicons name="cart-outline" size={20} color={THEME_COLOR} />
                        <Text style={styles.confirmSectionTitle}>Order Items</Text>
                    </View>
                    {cartItems.map((item, index) => (
                        <View key={index} style={styles.orderItemRow}>
                            <Text style={styles.orderItemName}>
                                {item.serviceName || item.name} × {item.quantity}
                            </Text>
                            <Text style={styles.orderItemPrice}>
                                रु {(item.price * item.quantity).toLocaleString()}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.paymentSection}>
                    <Text style={styles.paymentTitle}>Payment Method</Text>
                    <View style={styles.paymentOptions}>
                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                orderDetails.paymentMethod === 'cash' && styles.paymentOptionActive,
                            ]}
                            onPress={() => setOrderDetails({ ...orderDetails, paymentMethod: 'cash' })}
                        >
                            <FontAwesome5 name="money-bill-wave" size={20} color={orderDetails.paymentMethod === 'cash' ? THEME_COLOR : '#94a3b8'} />
                            <Text style={[
                                styles.paymentOptionText,
                                orderDetails.paymentMethod === 'cash' && styles.paymentOptionTextActive,
                            ]}>
                                Cash
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                orderDetails.paymentMethod === 'card' && styles.paymentOptionActive,
                            ]}
                            onPress={() => setOrderDetails({ ...orderDetails, paymentMethod: 'card' })}
                        >
                            <FontAwesome5 name="credit-card" size={20} color={orderDetails.paymentMethod === 'card' ? THEME_COLOR : '#94a3b8'} />
                            <Text style={[
                                styles.paymentOptionText,
                                orderDetails.paymentMethod === 'card' && styles.paymentOptionTextActive,
                            ]}>
                                Card
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.paymentOption,
                                orderDetails.paymentMethod === 'online' && styles.paymentOptionActive,
                            ]}
                            onPress={() => setOrderDetails({ ...orderDetails, paymentMethod: 'online' })}
                        >
                            <FontAwesome5 name="mobile-alt" size={20} color={orderDetails.paymentMethod === 'online' ? THEME_COLOR : '#94a3b8'} />
                            <Text style={[
                                styles.paymentOptionText,
                                orderDetails.paymentMethod === 'online' && styles.paymentOptionTextActive,
                            ]}>
                                Online
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.priceSummary}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Subtotal ({cartItems.length} items)</Text>
                        <Text style={styles.priceValue}>रु {subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>VAT ({Math.round(TAX_RATE * 100)}%)</Text>
                        <Text style={styles.priceValue}>रु {tax.toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Delivery Fee</Text>
                        <Text style={styles.priceValue}>
                            {deliveryFee > 0 ? `रु ${deliveryFee.toLocaleString()}` : 'Free'}
                        </Text>
                    </View>
                    {discount > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: THEME_COLOR }]}>
                                <Ionicons name="pricetag" size={14} color={THEME_COLOR} /> Discount
                            </Text>
                            <Text style={[styles.priceValue, { color: THEME_COLOR, fontWeight: '700' }]}>
                                -रु {discount.toLocaleString()}
                            </Text>
                        </View>
                    )}
                    <View style={styles.divider} />
                    <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={[styles.totalValue, { color: THEME_COLOR }]}>रु {total.toLocaleString()}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );

    const renderNavigationButtons = () => (
        <View style={[styles.navigationContainer, isKeyboardVisible && styles.navigationContainerKeyboard]}>
            {currentStep > 1 && (
                <TouchableOpacity
                    style={[styles.navButton, styles.prevButton]}
                    onPress={handlePrevious}
                    disabled={loading}
                >
                    <Ionicons name="arrow-back" size={20} color="#64748b" />
                    <Text style={styles.prevButtonText}>Back</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[
                    styles.navButton,
                    styles.nextButton,
                    currentStep === 1 && styles.fullWidth,
                ]}
                onPress={handleNext}
                disabled={loading}
            >
                <LinearGradient
                    colors={[THEME_COLOR, THEME_COLOR_LIGHT]}
                    style={styles.nextButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.nextButtonText}>
                        {currentStep === 2 ? 'Place Order' : 'Continue'}
                    </Text>
                    {currentStep !== 2 && <Ionicons name="arrow-forward" size={20} color="#fff" />}
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );

    const renderMapModal = () => (
        <Modal
            visible={showMapModal}
            animationType="slide"
            transparent={false}
            presentationStyle="fullScreen"
        >
            <SafeAreaView style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.modalCloseButton}>
                        <Ionicons name="close" size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Location</Text>
                    <TouchableOpacity onPress={getCurrentLocation} style={styles.modalLocateButton}>
                        <Ionicons name="locate" size={24} color={THEME_COLOR} />
                    </TouchableOpacity>
                </View>

                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={{
                            latitude: orderDetails.latitude || 27.7172,
                            longitude: orderDetails.longitude || 85.3240,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        onPress={(e) => {
                            const { latitude, longitude } = e.nativeEvent.coordinate;
                            setSelectedLocation({
                                latitude,
                                longitude,
                                address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                            });
                        }}
                    >
                        {selectedLocation && (
                            <Marker
                                coordinate={{
                                    latitude: selectedLocation.latitude,
                                    longitude: selectedLocation.longitude,
                                }}
                                draggable
                                onDragEnd={(e) => {
                                    const { latitude, longitude } = e.nativeEvent.coordinate;
                                    setSelectedLocation({
                                        latitude,
                                        longitude,
                                        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                                    });
                                }}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={styles.markerPulse} />
                                    <View style={[styles.markerPin, { backgroundColor: THEME_COLOR }]}>
                                        <Ionicons name="location" size={20} color="#fff" />
                                    </View>
                                </View>
                            </Marker>
                        )}
                    </MapView>

                    {selectedLocation && (
                        <View style={styles.selectedLocationCard}>
                            <View style={styles.selectedLocationContent}>
                                <Ionicons name="location" size={20} color={THEME_COLOR} />
                                <Text style={styles.selectedLocationText} numberOfLines={2}>
                                    {selectedLocation.address}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.confirmLocationButton, { backgroundColor: THEME_COLOR }]}
                                onPress={confirmLocation}
                            >
                                <Text style={styles.confirmLocationText}>Confirm Location</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={THEME_COLOR} />
                <Text style={styles.loadingText}>Placing your order...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.innerContainer}>
                        {renderStepIndicator()}

                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.scrollView}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {currentStep === 1 && renderAddressStep()}
                            {currentStep === 2 && renderConfirmStep()}
                            <View style={styles.bottomSpacer} />
                        </ScrollView>

                        {renderNavigationButtons()}
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {renderMapModal()}
        </SafeAreaView>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    innerContainer: {
        flex: 1,
    },
    backButton: {
        padding: 8,
    },
    stepIndicatorContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    stepsWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    stepItem: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    stepCircleActive: {
        backgroundColor: '#2563eb',
    },
    stepCircleInactive: {
        backgroundColor: '#e2e8f0',
    },
    stepNumber: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    stepLabelActive: {
        color: '#2563eb',
    },
    stepLabelInactive: {
        color: '#94a3b8',
    },
    progressBarContainer: {
        width: '100%',
        height: 4,
        paddingHorizontal: 20,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: '#e2e8f0',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: 4,
        backgroundColor: '#2563eb',
        borderRadius: 2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    stepContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    stepHeader: {
        marginBottom: 24,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    formContainer: {
        gap: 16,
    },
    locationButton: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    locationButtonGradient: {
        padding: 16,
    },
    locationButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    locationIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationButtonText: {
        flex: 1,
    },
    locationButtonTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    locationButtonSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 1,
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginVertical: 4,
    },
    orLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    orText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
    mapButton: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        backgroundColor: '#ffffff',
    },
    mapButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    mapIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapButtonText: {
        flex: 1,
    },
    mapButtonTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    mapButtonSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 1,
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 4,
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        minHeight: 48,
    },
    inputError: {
        borderColor: '#ef4444',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
        paddingVertical: Platform.OS === 'ios' ? 12 : 0,
    },
    textAreaWrapper: {
        minHeight: 100,
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    textArea: {
        height: 80,
        paddingTop: 0,
    },
    errorText: {
        fontSize: 12,
        color: '#ef4444',
        marginLeft: 4,
        marginTop: 2,
    },
    rowInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    navigationContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    },
    navigationContainerKeyboard: {
        position: 'relative',
    },
    navButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    fullWidth: {
        flex: 1,
    },
    prevButton: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    prevButtonText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '600',
    },
    nextButton: {
        flex: 1,
    },
    nextButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
        borderRadius: 12,
    },
    nextButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
    confirmContainer: {
        gap: 20,
        paddingBottom: 20,
    },
    confirmSection: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    confirmSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    confirmSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    confirmText: {
        fontSize: 14,
        color: '#334155',
        marginBottom: 4,
        lineHeight: 20,
    },
    confirmLabel: {
        color: '#64748b',
        fontWeight: '500',
    },
    orderItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    orderItemName: {
        fontSize: 14,
        color: '#334155',
        flex: 1,
        marginRight: 8,
    },
    orderItemPrice: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
    },
    paymentSection: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    paymentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 12,
    },
    paymentOptions: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    paymentOptionActive: {
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.05)',
    },
    paymentOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    paymentOptionTextActive: {
        color: '#2563eb',
    },
    priceSummary: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    priceLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0f172a',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 8,
    },
    totalRow: {
        paddingVertical: 4,
    },
    totalLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    bottomSpacer: {
        height: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748b',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalCloseButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0f172a',
    },
    modalLocateButton: {
        padding: 8,
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerPulse: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(37, 99, 235, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.3)',
    },
    markerPin: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    selectedLocationCard: {
        position: 'absolute',
        bottom: 30,
        left: 16,
        right: 16,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        gap: 12,
    },
    selectedLocationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectedLocationText: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
    },
    confirmLocationButton: {
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmLocationText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
});