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
    StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../../context/AuthContext';

const { width, height } = Dimensions.get('window');

// ============================================
// BLUE THEME CONSTANTS
// ============================================

const THEME = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    gradientStart: '#2563eb',
    gradientEnd: '#1d4ed8',
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    textInverse: '#ffffff',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    white: '#ffffff',
    background: '#f8fafc',
    surface: '#ffffff',
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.08)',
    error: '#ef4444',
    errorBg: 'rgba(239, 68, 68, 0.08)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.08)',
    shadow: 'rgba(0, 0, 0, 0.08)',
    shadowDark: 'rgba(0, 0, 0, 0.16)',
};

// ============================================
// CONSTANTS
// ============================================

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const VAT_RATE = 0.13;
const DELIVERY_FEE = 50;

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
    paymentMethod: 'cash';
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
    const { user, token, refreshAccessToken, logout } = useAuth();
    const scrollViewRef = useRef<ScrollView>(null);
    const mapRef = useRef<MapView>(null);

    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [showMapModal, setShowMapModal] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);

    // Pincode validation states
    const [isValidatingPincode, setIsValidatingPincode] = useState(false);
    const [pincodeError, setPincodeError] = useState<string | null>(null);
    const [isPincodeValid, setIsPincodeValid] = useState(false);
    const [hasValidatedPincode, setHasValidatedPincode] = useState(false);

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
    const [vat, setVat] = useState(0);
    const [deliveryFee, setDeliveryFee] = useState(DELIVERY_FEE);
    const [discount, setDiscount] = useState(0);
    const [total, setTotal] = useState(0);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
    } | null>(null);

    // Animation values
    const progressWidth = useSharedValue(0);
    const stepOpacity = useSharedValue(1);

    // ============================================
    // PINCODE VALIDATION FUNCTION
    // ============================================

    const validatePincode = async (pincode: string): Promise<boolean> => {
        try {
            setIsValidatingPincode(true);
            setPincodeError(null);
            setHasValidatedPincode(false);

            let currentToken = token;
            if (!currentToken) {
                currentToken = await SecureStore.getItemAsync('token');
                if (!currentToken) {
                    setPincodeError('Please login to continue');
                    setIsPincodeValid(false);
                    setHasValidatedPincode(true);
                    return false;
                }
            }

            const url = `${API_BASE_URL}/api/users/pincode/validate-for-order`;
            console.log('📡 Validating pincode:', pincode);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`,
                },
                body: JSON.stringify({ pincode }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setIsPincodeValid(true);
                setPincodeError(null);
                setHasValidatedPincode(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return true;
            } else {
                setIsPincodeValid(false);
                setPincodeError(data.message || 'Delivery not available at this pincode');
                setHasValidatedPincode(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return false;
            }
        } catch (error) {
            console.error('❌ Error validating pincode:', error);
            setPincodeError('Network error. Please try again.');
            setIsPincodeValid(false);
            setHasValidatedPincode(true);
            return false;
        } finally {
            setIsValidatingPincode(false);
        }
    };

    // ============================================
    // useEffects
    // ============================================

    useEffect(() => {
        if (params.items) {
            try {
                const parsedItems = JSON.parse(params.items as string);
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

        if (params.zipCode) {
            const zip = params.zipCode as string;
            setOrderDetails(prev => ({ ...prev, zipCode: zip }));
            if (zip.length === 5) {
                setTimeout(() => {
                    validatePincode(zip);
                }, 500);
            }
        }

        if (params.subtotal) {
            const subTotalVal = parseFloat(params.subtotal as string);
            setSubtotal(subTotalVal);
            setVat(subTotalVal * VAT_RATE);
        }
        if (params.discount) setDiscount(parseFloat(params.discount as string) || 0);
        if (params.total) {
            setTotal(parseFloat(params.total as string));
        } else {
            const subTotalVal = parseFloat(params.subtotal as string) || 0;
            const vatVal = subTotalVal * VAT_RATE;
            const discountVal = parseFloat(params.discount as string) || 0;
            setTotal(subTotalVal + vatVal - discountVal);
        }
    }, []);

    useEffect(() => {
        if (cartItems.length > 0) {
            const subTotalVal = cartItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );
            const vatVal = subTotalVal * VAT_RATE;
            const totalVal = subTotalVal + vatVal + DELIVERY_FEE;

            setSubtotal(subTotalVal);
            setVat(vatVal);
            setTotal(totalVal);
        }
    }, [cartItems]);

    useEffect(() => {
        navigation.setOptions({
            title: 'Checkout',
            headerTitleStyle: { fontWeight: '600', fontSize: 18, color: THEME.text },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: THEME.white },
            headerLeft: () => (
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={THEME.text} />
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

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    const formatPrice = (price: number): string => {
        return `रु ${price.toLocaleString('en-IN')}`;
    };

    // Check if delivery is available for current pincode
    const isDeliveryAvailable = (): boolean => {
        const zip = orderDetails.zipCode.trim();
        if (zip.length !== 5) return false;
        if (!hasValidatedPincode) return false;
        return isPincodeValid;
    };

    // Check if address step is valid
    const isAddressStepValid = (): boolean => {
        const address = orderDetails.address.trim();
        const city = orderDetails.city.trim();
        const zip = orderDetails.zipCode.trim();
        
        if (!address || !city || zip.length !== 5) return false;
        if (!hasValidatedPincode) return false;
        return isPincodeValid;
    };

    // ============================================
    // LOCATION FUNCTIONS
    // ============================================

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

                // Validate pincode if present
                if (address.postalCode && address.postalCode.length === 5) {
                    await validatePincode(address.postalCode);
                }

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

    // ============================================
    // ORDER FUNCTIONS
    // ============================================

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!orderDetails.address.trim()) newErrors.address = 'Please select your delivery address';
            if (!orderDetails.city.trim()) newErrors.city = 'City is required';
            if (!orderDetails.zipCode.trim()) {
                newErrors.zipCode = 'ZIP code is required';
            } else if (!/^\d{5}$/.test(orderDetails.zipCode.trim())) {
                newErrors.zipCode = 'Please enter a valid 5-digit ZIP code';
            } else if (!isPincodeValid && hasValidatedPincode) {
                newErrors.zipCode = 'Delivery not available at this pincode';
            } else if (!hasValidatedPincode) {
                newErrors.zipCode = 'Please wait while we validate your pincode';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        // If on address step, validate pincode first
        if (currentStep === 1) {
            const zip = orderDetails.zipCode.trim();
            if (zip.length === 5 && !hasValidatedPincode) {
                Alert.alert('Validating', 'Please wait while we validate your pincode...');
                return;
            }
            if (zip.length === 5 && !isPincodeValid) {
                Alert.alert('Delivery Not Available', 'We do not deliver to this pincode. Please enter a different ZIP code.');
                return;
            }
        }

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
            if (!orderDetails.zipCode) {
                Alert.alert('Error', 'Please enter your ZIP code');
                setLoading(false);
                return;
            }

            if (!/^\d{5}$/.test(orderDetails.zipCode.trim())) {
                Alert.alert('Invalid Pincode', 'Please enter a valid 5-digit pincode');
                setLoading(false);
                return;
            }

            // Double-check pincode validation
            if (!isPincodeValid) {
                const isValid = await validatePincode(orderDetails.zipCode.trim());
                if (!isValid) {
                    Alert.alert(
                        'Delivery Not Available',
                        pincodeError || 'We do not deliver to this pincode yet. Please check your ZIP code.',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    if (currentStep === 2) {
                                        setCurrentStep(1);
                                    }
                                }
                            }
                        ]
                    );
                    setLoading(false);
                    return;
                }
            }

            let currentToken = token;
            if (!currentToken) {
                currentToken = await SecureStore.getItemAsync('token');
                if (!currentToken) {
                    Alert.alert('Error', 'Please login to place order');
                    setLoading(false);
                    return;
                }
            }

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
                paymentMethod: 'cash',
            };

            const response = await fetch(`${API_BASE_URL}/api/users/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`,
                },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.replace({
                    pathname: '/order-success',
                    params: { orderId: data.order.id },
                });
            } else if (response.status === 401) {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    const retryResponse = await fetch(`${API_BASE_URL}/api/users/orders`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${newToken}`,
                        },
                        body: JSON.stringify(orderData),
                    });
                    const retryData = await retryResponse.json();
                    if (retryResponse.ok && retryData.success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        router.replace({
                            pathname: '/order-success',
                            params: { orderId: retryData.order.id },
                        });
                        return;
                    }
                }
                Alert.alert('Error', 'Session expired. Please login again.');
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

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    const renderStepIndicator = () => (
        <View style={[styles.stepIndicatorContainer, { backgroundColor: THEME.white, borderBottomColor: THEME.border }]}>
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
                                <Text style={[styles.stepNumber, { color: step <= currentStep ? '#fff' : '#94a3b8' }]}>{step}</Text>
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
                <View style={[styles.progressBar, { backgroundColor: THEME.border }]}>
                    <Animated.View style={[styles.progressFill, { backgroundColor: THEME.primary, width: `${(currentStep - 1) * 50}%` }]} />
                </View>
            </View>
        </View>
    );

    const renderAddressStep = () => (
        <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.stepContainer}>
            <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: THEME.text }]}>Delivery Address</Text>
                <Text style={[styles.stepSubtitle, { color: THEME.textSecondary }]}>Where should we deliver your service?</Text>
            </View>

            <View style={styles.formContainer}>
                <TouchableOpacity
                    style={[styles.locationButton, { borderColor: THEME.border }]}
                    onPress={getCurrentLocation}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[THEME.primary + '10', THEME.primary + '05']}
                        style={styles.locationButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={styles.locationButtonContent}>
                            <View style={[styles.locationIconWrapper, { backgroundColor: THEME.primary + '20' }]}>
                                <Ionicons name="locate" size={22} color={THEME.primary} />
                            </View>
                            <View style={styles.locationButtonText}>
                                <Text style={[styles.locationButtonTitle, { color: THEME.text }]}>Use Current Location</Text>
                                <Text style={[styles.locationButtonSubtitle, { color: THEME.textSecondary }]}>Get your current address automatically</Text>
                            </View>
                            {isLoadingLocation ? (
                                <ActivityIndicator size="small" color={THEME.primary} />
                            ) : (
                                <Ionicons name="chevron-forward" size={20} color={THEME.textTertiary} />
                            )}
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.orDivider}>
                    <View style={[styles.orLine, { backgroundColor: THEME.border }]} />
                    <Text style={[styles.orText, { color: THEME.textTertiary }]}>OR</Text>
                    <View style={[styles.orLine, { backgroundColor: THEME.border }]} />
                </View>

                <TouchableOpacity
                    style={[styles.mapButton, { borderColor: THEME.border, backgroundColor: THEME.white }]}
                    onPress={openMapSelector}
                    activeOpacity={0.8}
                >
                    <View style={styles.mapButtonContent}>
                        <View style={[styles.mapIconWrapper, { backgroundColor: THEME.primary + '10' }]}>
                            <MaterialIcons name="map" size={24} color={THEME.primary} />
                        </View>
                        <View style={styles.mapButtonText}>
                            <Text style={[styles.mapButtonTitle, { color: THEME.text }]}>Choose on Map</Text>
                            <Text style={[styles.mapButtonSubtitle, { color: THEME.textSecondary }]}>Select location by dropping a pin</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={THEME.textTertiary} />
                    </View>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: THEME.border }]} />

                <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: THEME.text }]}>Street Address</Text>
                    <View style={[styles.inputWrapper, errors.address && styles.inputError, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                        <Feather name="map-pin" size={20} color={THEME.textTertiary} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { color: THEME.text }]}
                            placeholder="123 Main Street"
                            placeholderTextColor={THEME.textTertiary}
                            value={orderDetails.address}
                            onChangeText={(text) => setOrderDetails({ ...orderDetails, address: text })}
                        />
                        {orderDetails.address && (
                            <TouchableOpacity onPress={() => setOrderDetails({ ...orderDetails, address: '' })}>
                                <Ionicons name="close-circle" size={18} color={THEME.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {errors.address && <Text style={[styles.errorText, { color: THEME.error }]}>{errors.address}</Text>}
                </View>

                <View style={styles.rowInputs}>
                    <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={[styles.inputLabel, { color: THEME.text }]}>City</Text>
                        <View style={[styles.inputWrapper, errors.city && styles.inputError, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                            <TextInput
                                style={[styles.input, { color: THEME.text }]}
                                placeholder="Kathmandu"
                                placeholderTextColor={THEME.textTertiary}
                                value={orderDetails.city}
                                onChangeText={(text) => setOrderDetails({ ...orderDetails, city: text })}
                            />
                        </View>
                        {errors.city && <Text style={[styles.errorText, { color: THEME.error }]}>{errors.city}</Text>}
                    </View>

                    <View style={[styles.inputGroup, styles.halfInput]}>
                        <Text style={[styles.inputLabel, { color: THEME.text }]}>ZIP Code *</Text>
                        <View style={[
                            styles.inputWrapper,
                            errors.zipCode && styles.inputError,
                            isPincodeValid && styles.inputSuccess,
                            {
                                backgroundColor: THEME.white,
                                borderColor: isPincodeValid ? THEME.success : (errors.zipCode ? THEME.error : THEME.border)
                            }
                        ]}>
                            <TextInput
                                style={[styles.input, { color: THEME.text }]}
                                placeholder="44600"
                                placeholderTextColor={THEME.textTertiary}
                                keyboardType="numeric"
                                maxLength={5}
                                value={orderDetails.zipCode}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/[^0-9]/g, '');
                                    setOrderDetails(prev => ({ ...prev, zipCode: cleaned }));
                                    setIsPincodeValid(false);
                                    setPincodeError(null);
                                    setHasValidatedPincode(false);
                                    if (errors.zipCode) {
                                        setErrors(prev => ({ ...prev, zipCode: undefined }));
                                    }
                                    if (cleaned.length === 5) {
                                        validatePincode(cleaned);
                                    }
                                }}
                                onBlur={() => {
                                    if (orderDetails.zipCode.trim().length === 5 && !hasValidatedPincode) {
                                        validatePincode(orderDetails.zipCode.trim());
                                    }
                                }}
                            />
                            <View style={styles.inputRightIcon}>
                                {isValidatingPincode && (
                                    <ActivityIndicator size="small" color={THEME.primary} />
                                )}
                                {isPincodeValid && !isValidatingPincode && (
                                    <Ionicons name="checkmark-circle" size={20} color={THEME.success} />
                                )}
                                {!isPincodeValid && orderDetails.zipCode.trim().length === 5 && !isValidatingPincode && hasValidatedPincode && (
                                    <Ionicons name="alert-circle" size={20} color={THEME.error} />
                                )}
                            </View>
                        </View>
                        {errors.zipCode && <Text style={[styles.errorText, { color: THEME.error }]}>{errors.zipCode}</Text>}
                        {pincodeError && !errors.zipCode && (
                            <Text style={[styles.errorText, { color: THEME.error }]}>{pincodeError}</Text>
                        )}
                        {isPincodeValid && (
                            <View style={styles.successBadge}>
                                <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                                <Text style={[styles.successText, { color: THEME.success }]}>✓ Delivery available at this pincode</Text>
                            </View>
                        )}
                        {!isPincodeValid && orderDetails.zipCode.trim().length === 5 && !isValidatingPincode && !hasValidatedPincode && (
                            <View style={styles.successBadge}>
                                <ActivityIndicator size="small" color={THEME.primary} />
                                <Text style={[styles.successText, { color: THEME.textTertiary }]}>Validating pincode...</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: THEME.text }]}>Special Instructions (Optional)</Text>
                    <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: THEME.text }]}
                            placeholder="Any special instructions for delivery..."
                            placeholderTextColor={THEME.textTertiary}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            value={orderDetails.notes}
                            onChangeText={(text) => setOrderDetails({ ...orderDetails, notes: text })}
                        />
                    </View>
                </View>

                {/* Delivery availability warning */}
                {!isDeliveryAvailable() && orderDetails.zipCode.trim().length === 5 && hasValidatedPincode && (
                    <View style={styles.deliveryWarning}>
                        <Ionicons name="warning-outline" size={20} color={THEME.error} />
                        <Text style={[styles.deliveryWarningText, { color: THEME.error }]}>
                            Delivery is not available at this pincode. Please enter a different ZIP code.
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );

    const renderConfirmStep = () => (
        <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.stepContainer}>
            <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: THEME.text }]}>Confirm Order</Text>
                <Text style={[styles.stepSubtitle, { color: THEME.textSecondary }]}>Review your order details</Text>
            </View>

            <View style={styles.confirmContainer}>
                <View style={[styles.confirmSection, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <View style={styles.confirmSectionHeader}>
                        <View style={styles.confirmIconWrapper}>
                            <Ionicons name="location-outline" size={18} color={THEME.primary} />
                        </View>
                        <Text style={[styles.confirmSectionTitle, { color: THEME.text }]}>Delivery Address</Text>
                        {isDeliveryAvailable() && (
                            <View style={styles.deliveryBadge}>
                                <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                                <Text style={[styles.deliveryBadgeText, { color: THEME.success }]}>Available</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.confirmContent}>
                        <View style={styles.confirmRow}>
                            <Ionicons name="home-outline" size={16} color={THEME.textTertiary} />
                            <Text style={[styles.confirmText, { color: THEME.textSecondary }]}>{orderDetails.address}</Text>
                        </View>
                        <View style={styles.confirmRow}>
                            <Ionicons name="location-outline" size={16} color={THEME.textTertiary} />
                            <Text style={[styles.confirmText, { color: THEME.textSecondary }]}>
                                {orderDetails.city}, {orderDetails.zipCode}
                                {isPincodeValid && (
                                    <Text style={{ color: THEME.success, marginLeft: 4 }}> ✓</Text>
                                )}
                            </Text>
                        </View>
                        {orderDetails.notes && (
                            <View style={styles.confirmRow}>
                                <Ionicons name="chatbubble-outline" size={16} color={THEME.textTertiary} />
                                <Text style={[styles.confirmText, { color: THEME.textSecondary }]}>{orderDetails.notes}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={[styles.confirmSection, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <View style={styles.confirmSectionHeader}>
                        <View style={styles.confirmIconWrapper}>
                            <Ionicons name="cart-outline" size={18} color={THEME.primary} />
                        </View>
                        <Text style={[styles.confirmSectionTitle, { color: THEME.text }]}>Order Items</Text>
                        <Text style={[styles.itemCount, { color: THEME.textTertiary }]}>({cartItems.length})</Text>
                    </View>
                    <View style={styles.orderItemsList}>
                        {cartItems.map((item, index) => (
                            <View key={index} style={[styles.orderItemRow, index < cartItems.length - 1 && { borderBottomColor: THEME.borderLight }]}>
                                <View style={styles.orderItemLeft}>
                                    <View style={styles.orderItemQuantityBadge}>
                                        <Text style={styles.orderItemQuantityText}>{item.quantity}</Text>
                                    </View>
                                    <Text style={[styles.orderItemName, { color: THEME.textSecondary }]} numberOfLines={1}>
                                        {item.serviceName || item.name}
                                    </Text>
                                </View>
                                <Text style={[styles.orderItemPrice, { color: THEME.text }]}>
                                    {formatPrice(item.price * item.quantity)}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.paymentSection, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <Text style={[styles.paymentTitle, { color: THEME.text }]}>Payment Method</Text>
                    <View style={styles.paymentOptions}>
                        <View style={[
                            styles.paymentOption,
                            styles.paymentOptionActive,
                            { borderColor: THEME.primary },
                        ]}>
                            <View style={[
                                styles.paymentOptionCircle,
                                styles.paymentOptionCircleActive,
                                { borderColor: THEME.primary },
                            ]}>
                                <View style={[styles.paymentOptionCircleInner, { backgroundColor: THEME.primary }]} />
                            </View>
                            <View style={styles.paymentOptionContent}>
                                <View style={[styles.paymentOptionIcon, { backgroundColor: THEME.primaryBg }]}>
                                    <Ionicons name="cash-outline" size={22} color={THEME.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.paymentOptionTitle, { color: THEME.text }]}>Cash on Service</Text>
                                    <Text style={[styles.paymentOptionSubtitle, { color: THEME.textSecondary }]}>Pay at the time of service</Text>
                                </View>
                            </View>
                            <Ionicons name="checkmark-circle" size={22} color={THEME.primary} />
                        </View>
                    </View>
                </View>

                <View style={[styles.priceSummary, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: THEME.textSecondary }]}>Subtotal ({cartItems.length} items)</Text>
                        <Text style={[styles.priceValue, { color: THEME.text }]}>{formatPrice(subtotal)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: THEME.textSecondary }]}>VAT ({Math.round(VAT_RATE * 100)}%)</Text>
                        <Text style={[styles.priceValue, { color: THEME.text }]}>{formatPrice(vat)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: THEME.textSecondary }]}>Delivery Fee</Text>
                        <Text style={[styles.priceValue, { color: THEME.text }]}>{formatPrice(DELIVERY_FEE)}</Text>
                    </View>
                    {discount > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: THEME.success }]}>
                                <Ionicons name="pricetag" size={14} color={THEME.success} /> Discount
                            </Text>
                            <Text style={[styles.priceValue, { color: THEME.success, fontWeight: '700' }]}>
                                -{formatPrice(discount)}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.dividerLine, { backgroundColor: THEME.border }]} />
                    <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={[styles.totalLabel, { color: THEME.text }]}>Total Amount</Text>
                        <Text style={[styles.totalValue, { color: THEME.primary }]}>{formatPrice(total)}</Text>
                    </View>
                </View>

                {/* Delivery unavailable warning on confirm step */}
                {!isDeliveryAvailable() && (
                    <View style={[styles.deliveryWarning, styles.deliveryWarningConfirm]}>
                        <Ionicons name="warning-outline" size={24} color={THEME.error} />
                        <View style={styles.deliveryWarningContent}>
                            <Text style={[styles.deliveryWarningTitle, { color: THEME.error }]}>
                                Delivery Not Available
                            </Text>
                            <Text style={[styles.deliveryWarningText, { color: THEME.textSecondary }]}>
                                We don't deliver to this pincode. Please go back and enter a different ZIP code.
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Animated.View>
    );

    const renderNavigationButtons = () => {
        // Determine if next button should be disabled
        let isNextDisabled = loading;

        if (currentStep === 1) {
            // Address step - check if all fields are valid and delivery is available
            const zip = orderDetails.zipCode.trim();
            if (zip.length !== 5) {
                isNextDisabled = true;
            } else if (!hasValidatedPincode) {
                isNextDisabled = true;
            } else if (!isPincodeValid) {
                isNextDisabled = true;
            } else if (!orderDetails.address.trim() || !orderDetails.city.trim()) {
                isNextDisabled = true;
            }
        } else if (currentStep === 2) {
            // Confirm step - check if delivery is available
            if (!isDeliveryAvailable()) {
                isNextDisabled = true;
            }
        }

        return (
            <View style={[
                styles.navigationContainer, 
                isKeyboardVisible && styles.navigationContainerKeyboard, 
                { backgroundColor: THEME.white, borderTopColor: THEME.border }
            ]}>
                {currentStep > 1 && (
                    <TouchableOpacity
                        style={[styles.navButton, styles.prevButton, { backgroundColor: THEME.background, borderColor: THEME.border }]}
                        onPress={handlePrevious}
                        disabled={loading}
                    >
                        <Ionicons name="arrow-back" size={20} color={THEME.textTertiary} />
                        <Text style={[styles.prevButtonText, { color: THEME.textSecondary }]}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[
                        styles.navButton,
                        styles.nextButton,
                        currentStep === 1 && styles.fullWidth,
                        isNextDisabled && styles.nextButtonDisabled
                    ]}
                    onPress={handleNext}
                    disabled={isNextDisabled}
                >
                    <LinearGradient
                        colors={[THEME.gradientStart, THEME.gradientEnd]}
                        style={[
                            styles.nextButtonGradient, 
                            isNextDisabled && styles.nextButtonGradientDisabled
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Text style={[styles.nextButtonText, { color: THEME.textInverse }]}>
                                    {currentStep === 2 ? 'Place Order' : 'Continue'}
                                </Text>
                                {currentStep !== 2 && <Ionicons name="arrow-forward" size={20} color={THEME.textInverse} />}
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    const renderMapModal = () => (
        <Modal
            visible={showMapModal}
            animationType="slide"
            transparent={false}
            presentationStyle="fullScreen"
        >
            <SafeAreaView style={[styles.modalContainer, { backgroundColor: THEME.white }]}>
                <StatusBar barStyle="dark-content" backgroundColor={THEME.white} />
                <View style={[styles.modalHeader, { borderBottomColor: THEME.border }]}>
                    <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.modalCloseButton}>
                        <Ionicons name="close" size={24} color={THEME.text} />
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: THEME.text }]}>Select Location</Text>
                    <TouchableOpacity onPress={getCurrentLocation} style={styles.modalLocateButton}>
                        <Ionicons name="locate" size={24} color={THEME.primary} />
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
                                    <View style={[styles.markerPulse, { backgroundColor: THEME.primary + '20', borderColor: THEME.primary + '30' }]} />
                                    <View style={[styles.markerPin, { backgroundColor: THEME.primary }]}>
                                        <Ionicons name="location" size={20} color="#fff" />
                                    </View>
                                </View>
                            </Marker>
                        )}
                    </MapView>

                    {selectedLocation && (
                        <View style={[styles.selectedLocationCard, { backgroundColor: THEME.white, borderColor: THEME.border }]}>
                            <View style={styles.selectedLocationContent}>
                                <Ionicons name="location" size={20} color={THEME.primary} />
                                <Text style={[styles.selectedLocationText, { color: THEME.text }]} numberOfLines={2}>
                                    {selectedLocation.address}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.confirmLocationButton, { backgroundColor: THEME.primary }]}
                                onPress={confirmLocation}
                            >
                                <Text style={[styles.confirmLocationText, { color: THEME.textInverse }]}>Confirm Location</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </Modal>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: THEME.background }]}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={[styles.loadingText, { color: THEME.textSecondary }]}>Placing your order...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: THEME.background }]} edges={['bottom']}>
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: THEME.background }]}
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
    },
    container: {
        flex: 1,
    },
    innerContainer: {
        flex: 1,
    },
    backButton: {
        padding: 8,
    },
    stepIndicatorContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    stepsWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    stepItem: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        shadowColor: THEME.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    stepCircleActive: {
        backgroundColor: THEME.primary,
        shadowOpacity: 0.3,
    },
    stepCircleInactive: {
        backgroundColor: THEME.border,
    },
    stepNumber: {
        fontSize: 14,
        fontWeight: '600',
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
    stepLabelActive: {
        color: THEME.primary,
    },
    stepLabelInactive: {
        color: THEME.textTertiary,
    },
    progressBarContainer: {
        width: '100%',
        height: 4,
        paddingHorizontal: 4,
    },
    progressBar: {
        width: '100%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    stepContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    stepHeader: {
        marginBottom: 24,
    },
    stepTitle: {
        fontSize: 26,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    stepSubtitle: {
        fontSize: 14,
        marginTop: 4,
        letterSpacing: 0.2,
    },
    formContainer: {
        gap: 16,
    },
    locationButton: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
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
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationButtonText: {
        flex: 1,
    },
    locationButtonTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    locationButtonSubtitle: {
        fontSize: 12,
        marginTop: 2,
        letterSpacing: 0.1,
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
    },
    orText: {
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    mapButton: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    mapButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    mapIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapButtonText: {
        flex: 1,
    },
    mapButtonTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    mapButtonSubtitle: {
        fontSize: 12,
        marginTop: 2,
        letterSpacing: 0.1,
    },
    divider: {
        height: 1,
        marginVertical: 4,
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
        letterSpacing: 0.2,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        minHeight: 50,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    inputError: {
        borderColor: THEME.error,
    },
    inputSuccess: {
        borderColor: THEME.success,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        paddingVertical: Platform.OS === 'ios' ? 14 : 0,
        letterSpacing: 0.2,
    },
    inputRightIcon: {
        marginLeft: 8,
    },
    textAreaWrapper: {
        minHeight: 100,
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    textArea: {
        height: 80,
        paddingTop: 0,
        textAlignVertical: 'top',
    },
    errorText: {
        fontSize: 12,
        marginLeft: 4,
        marginTop: 4,
        letterSpacing: 0.1,
    },
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    successText: {
        fontSize: 12,
        letterSpacing: 0.1,
        fontWeight: '500',
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
        borderTopWidth: 1,
        gap: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        shadowColor: THEME.shadowDark,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
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
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
        flex: 0.4,
    },
    prevButtonText: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    nextButton: {
        flex: 0.6,
    },
    nextButtonDisabled: {
        opacity: 0.5,
    },
    nextButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
        borderRadius: 12,
    },
    nextButtonGradientDisabled: {
        opacity: 0.6,
    },
    nextButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
        letterSpacing: 0.3,
    },
    confirmContainer: {
        gap: 20,
        paddingBottom: 20,
    },
    confirmSection: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    confirmSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    confirmIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: THEME.primaryBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    confirmContent: {
        gap: 8,
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    confirmText: {
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    itemCount: {
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 'auto',
    },
    orderItemsList: {
        gap: 4,
    },
    orderItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    orderItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    orderItemQuantityBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: THEME.primaryBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orderItemQuantityText: {
        fontSize: 12,
        fontWeight: '700',
        color: THEME.primary,
    },
    orderItemName: {
        fontSize: 14,
        flex: 1,
        letterSpacing: 0.1,
    },
    orderItemPrice: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    paymentSection: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    paymentTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        letterSpacing: 0.2,
    },
    paymentOptions: {
        gap: 12,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        gap: 12,
        opacity: 1,
    },
    paymentOptionActive: {
        borderWidth: 2,
    },
    paymentOptionCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentOptionCircleActive: {
        borderWidth: 2,
    },
    paymentOptionCircleInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    paymentOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    paymentOptionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentOptionTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    paymentOptionSubtitle: {
        fontSize: 12,
        marginTop: 1,
        letterSpacing: 0.1,
    },
    priceSummary: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        shadowColor: THEME.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    priceLabel: {
        fontSize: 14,
        letterSpacing: 0.1,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: 0.1,
    },
    dividerLine: {
        height: 1,
        marginVertical: 8,
    },
    totalRow: {
        paddingVertical: 4,
        marginTop: 4,
    },
    totalLabel: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    bottomSpacer: {
        height: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        letterSpacing: 0.2,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    modalCloseButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 0.2,
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
        borderWidth: 1,
    },
    markerPin: {
        width: 42,
        height: 42,
        borderRadius: 21,
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
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
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
        fontWeight: '500',
        letterSpacing: 0.1,
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
        letterSpacing: 0.2,
    },
    deliveryWarning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        backgroundColor: THEME.errorBg,
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: THEME.error + '30',
    },
    deliveryWarningConfirm: {
        marginTop: 0,
        padding: 16,
    },
    deliveryWarningContent: {
        flex: 1,
        gap: 2,
    },
    deliveryWarningTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    deliveryWarningText: {
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
        letterSpacing: 0.1,
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: THEME.successBg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 'auto',
    },
    deliveryBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});