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
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { useLocation } from '../../../../context/LocationContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

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

const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

export default function ServiceDetailsScreen() {
    const { id, name, price, description, imageUrl, categoryName } = useLocalSearchParams();
    const { user, token, refreshAccessToken, logout, isTokenRefreshing } = useAuth();
    const { 
        address: contextAddress, 
        coordinates: contextCoordinates,
        setCustomLocation,
    } = useLocation();
    const router = useRouter();
    const navigation = useNavigation();
    
    // Get role-based colors
    const isMistri = user?.role === 'mistri';
    const primaryColor = isMistri ? '#179d2e' : '#0177b8';
    const primaryLight = isMistri ? '#179d2e20' : '#0177b820';
    const gradientColors = isMistri ? ['#179d2e', '#0e6b20'] : ['#0177b8', '#005a8f'];
    
    const [service, setService] = useState<ServiceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [bookingModalVisible, setBookingModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Success animation states
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [bookingData, setBookingData] = useState<{ requestId: string; serviceName: string } | null>(null);
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
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);
    
    const mapRef = useRef<MapView>(null);

    // Initialize local states with context data when modal opens
    useEffect(() => {
        if (showLocationModal) {
            setTempMarkerLocation(contextCoordinates);
            setSelectedLocation(contextCoordinates);
            setLocationAddress(contextAddress || '');
            setManualAddress(contextAddress || '');
            setSearchResults([]);
        }
    }, [showLocationModal]);

    useEffect(() => {
        navigation.setOptions({
            title: (name as string) || 'Service Details',
            headerTitleStyle: { fontWeight: '600', fontSize: 18 },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
        });
        fetchServiceDetails();
    }, [id]);

    // Success animation trigger
    useEffect(() => {
        if (successModalVisible) {
            // Reset animations
            scaleAnim.setValue(0);
            checkAnim.setValue(0);
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            
            // Sequence animations
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
        } finally {
            setLoading(false);
        }
    };

    // Address Lookup using OS Nominatim Engine
    const searchAddress = async (query: string) => {
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearchingAddress(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'ServiceApp/1.0',
                    }
                }
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
        Keyboard.dismiss();
    };

    const detectCurrentLocation = async () => {
        setIsDetectingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location permissions to use auto-detection.');
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
                const formattedAddress = `${locName || street || ''}, ${city || ''}, ${country || ''}`.replace(/^,\s*|,\s*$/, '');
                setLocationAddress(formattedAddress);
                setManualAddress(formattedAddress);
            }
            
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    ...coords,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }, 1000);
            }
        } catch (error) {
            console.error('Error detecting location:', error);
            Alert.alert('Error', 'Failed to detect your location. Please try manual entry.');
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
        } else {
            Alert.alert('Location Empty', 'Please select or discover a location before saving.');
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
                    'Authorization': `Bearer ${authToken}`,
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

    const handleBookNow = () => {
        if (!contextCoordinates) {
            Alert.alert(
                'Location Required',
                'Please set your service location before booking.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Set Location', onPress: () => setShowLocationModal(true) }
                ]
            );
            return;
        }
        if (!token) {
            Alert.alert('Error', 'Please login to continue');
            router.replace('/(auth)/login');
            return;
        }
        setBookingModalVisible(true);
    };

const handleConfirmBooking = async () => {
    setSubmitting(true);
    try {
        // ✅ Get the service type from multiple sources
        let serviceType = '';

        // Try to get from categoryName first
        if (categoryName) {
            serviceType = categoryName as string;
        } 
        // Then try from service.categoryName
        else if (service?.categoryName) {
            serviceType = service.categoryName;
        }
        // Then try from service.name
        else if (service?.name) {
            serviceType = service.name;
        }
        // Fallback to the id param
        else {
            serviceType = id as string;
        }

        // ✅ Clean up the service type - remove "Service" suffix if present
        serviceType = serviceType.replace(/\s*Service\s*/gi, '').trim();

        // ✅ Map to valid service type
        const serviceTypeMap: Record<string, string> = {
            'plumber': 'plumber',
            'Plumber': 'plumber',
            'electrician': 'electrician',
            'Electrician': 'electrician',
            'painter': 'painter',
            'Painter': 'painter',
            'carpenter': 'carpenter',
            'Carpenter': 'carpenter',
            'cleaning': 'cleaning',
            'Cleaning': 'cleaning',
            'plumbing': 'plumber',
            'Plumbing': 'plumber',
            'electrical': 'electrician',
            'Electrical': 'electrician',
        };

        // ✅ Get the mapped service type
        const finalServiceType = serviceTypeMap[serviceType] || serviceType.toLowerCase() || 'plumber';
        
        console.log('📝 Booking Details:');
        console.log('  Original serviceType:', serviceType);
        console.log('  Final serviceType:', finalServiceType);
        console.log('  Service name:', service?.name);
        console.log('  Category name:', categoryName);
        console.log('  Service ID:', id);

        const requestBody = {
            type: finalServiceType,
            platformServiceIds: [id],
            coords: {
                lat: contextCoordinates?.latitude || 27.7172,
                lng: contextCoordinates?.longitude || 85.324,
            },
            address: contextAddress,
            source: 'gps',
        };

        console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

        const response = await makeAuthenticatedRequest(
            `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/service-requests`,
            {
                method: 'POST',
                body: JSON.stringify(requestBody),
            }
        );

        const data = await response.json();

        if (response.ok && data.success) {
            setBookingModalVisible(false);
            setBookingData({
                requestId: data.requestId || 'SR' + Date.now().toString().slice(-6),
                serviceName: service?.name || 'Service',
            });
            setSuccessModalVisible(true);
        } else {
            console.error('❌ Booking error:', data);
            Alert.alert('Error', data.message || 'Failed to submit booking');
        }
    } catch (error: any) {
        console.error('❌ Error submitting booking:', error);
        if (error.message !== 'Session expired') {
            Alert.alert('Error', 'Network error. Please try again.');
        }
    } finally {
        setSubmitting(false);
    }
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
    // RENDER FUNCTIONS
    // ============================================

    const renderServiceDetails = () => {
        const data = service || {
            id: id as string,
            name: name as string,
            description: description as string,
            price: price as string,
            imageUrl: imageUrl as string,
        };

        return (
            <>
                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    {data.imageUrl ? (
                        <Image source={{ uri: data.imageUrl }} style={styles.heroImage} resizeMode="cover" />
                    ) : (
                        <LinearGradient colors={gradientColors} style={styles.heroImagePlaceholder}>
                            <Text style={styles.heroInitials}>{getInitials(data.name)}</Text>
                        </LinearGradient>
                    )}
                    <View style={[styles.priceBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.priceBadgeText}>
                            रु {parseFloat(data.price || '0').toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Service Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.serviceName}>{data.name}</Text>
                    
                    <View style={styles.ratingContainer}>
                        <View style={styles.stars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <MaterialIcons key={star} name="star" size={18} color="#fbbf24" />
                            ))}
                        </View>
                        <Text style={styles.ratingText}>4.8 (1,234 reviews)</Text>
                    </View>

                    {data.description && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Description</Text>
                            <Text style={styles.descriptionText}>{data.description}</Text>
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>What's Included</Text>
                        <View style={styles.featuresList}>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="verified" size={20} color={primaryColor} />
                                <Text style={styles.featureText}>Professional & insured</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="timer" size={20} color={primaryColor} />
                                <Text style={styles.featureText}>On-time arrival guaranteed</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="security" size={20} color={primaryColor} />
                                <Text style={styles.featureText}>Quality workmanship</Text>
                            </View>
                            <View style={styles.featureItem}>
                                <MaterialIcons name="support-agent" size={20} color={primaryColor} />
                                <Text style={styles.featureText}>24/7 customer support</Text>
                            </View>
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Service Location</Text>
                        <TouchableOpacity 
                            style={[styles.locationCard, { borderColor: primaryLight }]} 
                            onPress={() => setShowLocationModal(true)} 
                            activeOpacity={0.7}
                        >
                            <View style={[styles.locationIconContainer, { backgroundColor: primaryLight }]}>
                                <Ionicons name="location-sharp" size={24} color={primaryColor} />
                            </View>
                            <View style={styles.locationInfo}>
                                <Text style={styles.locationLabel}>Your Address</Text>
                                <Text style={styles.locationAddress} numberOfLines={2}>
                                    {contextAddress || 'Tap to set your location'}
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </View>
            </>
        );
    };

    const renderFooter = () => {
        const data = service || {
            id: id as string,
            name: name as string,
            description: description as string,
            price: price as string,
            imageUrl: imageUrl as string,
        };

        return (
            <View style={styles.footer}>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Price</Text>
                    <Text style={[styles.priceAmount, { color: primaryColor }]}>
                        रु {parseFloat(data.price || '0').toLocaleString()}
                    </Text>
                </View>
                <TouchableOpacity 
                    style={[styles.bookButton, { backgroundColor: primaryColor }]} 
                    onPress={handleBookNow} 
                    disabled={isTokenRefreshing}
                >
                    {isTokenRefreshing ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Text style={styles.bookButtonText}>Book Now</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderBookingModal = () => {
        const data = service || {
            id: id as string,
            name: name as string,
            description: description as string,
            price: price as string,
            imageUrl: imageUrl as string,
        };

        return (
            <Modal visible={bookingModalVisible} animationType="slide" transparent={true} onRequestClose={() => setBookingModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Confirm Booking</Text>
                            <TouchableOpacity onPress={() => setBookingModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={styles.serviceSummary}>
                                <Text style={styles.summaryServiceName}>{data.name}</Text>
                                <Text style={[styles.summaryPrice, { color: primaryColor }]}>
                                    रु {parseFloat(data.price || '0').toLocaleString()}
                                </Text>
                            </View>

                            <View style={[styles.locationSummary, { borderColor: primaryLight }]}>
                                <MaterialIcons name="location-on" size={20} color={primaryColor} />
                                <Text style={styles.locationSummaryText}>{contextAddress || 'Location not set'}</Text>
                            </View>

                            <View style={styles.priceBreakdown}>
                                <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>Service Charge</Text>
                                    <Text style={styles.breakdownValue}>रु {parseFloat(data.price || '0').toLocaleString()}</Text>
                                </View>
                                <View style={styles.breakdownDivider} />
                                <View style={styles.breakdownTotal}>
                                    <Text style={styles.totalLabel}>Total Amount</Text>
                                    <Text style={[styles.totalAmount, { color: primaryColor }]}>
                                        रु {parseFloat(data.price || '0').toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={styles.paymentNote}>Payment will be made directly to the professional after service completion</Text>
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setBookingModalVisible(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.confirmButton, { backgroundColor: primaryColor }]} 
                                onPress={handleConfirmBooking} 
                                disabled={submitting}
                            >
                                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmButtonText}>Confirm Booking</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderLocationModal = () => {
        return (
            <Modal visible={showLocationModal} animationType="slide" transparent={false} onRequestClose={() => setShowLocationModal(false)}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowLocationModal(false)} style={styles.modalCloseButton}>
                                <Ionicons name="close" size={24} color="#0f172a" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Select Location</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <View style={styles.methodSelector}>
                            <TouchableOpacity 
                                style={[
                                    styles.methodButton, 
                                    locationMethod === 'auto' && [styles.methodButtonActive, { borderColor: primaryColor }]
                                ]} 
                                onPress={() => setLocationMethod('auto')}
                            >
                                <Ionicons name="location" size={20} color={locationMethod === 'auto' ? primaryColor : '#64748b'} />
                                <Text style={[
                                    styles.methodText, 
                                    locationMethod === 'auto' && [styles.methodTextActive, { color: primaryColor }]
                                ]}>Auto Detect</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    styles.methodButton, 
                                    locationMethod === 'manual' && [styles.methodButtonActive, { borderColor: primaryColor }]
                                ]} 
                                onPress={() => setLocationMethod('manual')}
                            >
                                <Ionicons name="create-outline" size={20} color={locationMethod === 'manual' ? primaryColor : '#64748b'} />
                                <Text style={[
                                    styles.methodText, 
                                    locationMethod === 'manual' && [styles.methodTextActive, { color: primaryColor }]
                                ]}>Enter Manually</Text>
                            </TouchableOpacity>
                        </View>

                        {locationMethod === 'auto' ? (
                            <View style={styles.autoLocationContainer}>
                                {!tempMarkerLocation ? (
                                    <View style={styles.detectContainer}>
                                        <MaterialIcons name="gps-fixed" size={48} color={primaryColor} />
                                        <Text style={styles.detectTitle}>Detect Your Location</Text>
                                        <Text style={styles.detectSubtitle}>We'll use your GPS to find your current location</Text>
                                        <TouchableOpacity 
                                            style={[styles.detectButton, { backgroundColor: primaryColor }]} 
                                            onPress={detectCurrentLocation} 
                                            disabled={isDetectingLocation}
                                        >
                                            {isDetectingLocation ? <ActivityIndicator color="#fff" /> : <>
                                                <Ionicons name="location-sharp" size={20} color="#fff" />
                                                <Text style={styles.detectButtonText}>Detect Location</Text>
                                            </>}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.mapContainer}>
                                        <MapView
                                            ref={mapRef}
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
                                                    Location.reverseGeocodeAsync(coords).then(result => {
                                                        if (result.length > 0) {
                                                            const { name: locName, street, city, country } = result[0];
                                                            const addr = `${locName || street || ''}, ${city || ''}, ${country || ''}`.replace(/^,\s*|,\s*$/, '');
                                                            setLocationAddress(addr);
                                                            setManualAddress(addr);
                                                        }
                                                    });
                                                }}
                                            />
                                        </MapView>
                                        <View style={styles.mapAddressContainer}>
                                            <Ionicons name="location-sharp" size={18} color={primaryColor} />
                                            <Text style={styles.mapAddressText} numberOfLines={2}>{locationAddress || 'Drag pin to set location'}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.recenterButton, { borderColor: primaryColor }]} 
                                            onPress={detectCurrentLocation}
                                        >
                                            <Ionicons name="locate" size={20} color={primaryColor} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={styles.manualLocationContainer}>
                                <View style={styles.searchInputWrapper}>
                                    <View style={[styles.searchInputContainer, { borderColor: primaryColor }]}>
                                        <Ionicons name="search" size={20} color="#94a3b8" />
                                        <TextInput
                                            style={styles.searchAddressInput}
                                            placeholder="Search for a location..."
                                            placeholderTextColor="#94a3b8"
                                            value={manualAddress}
                                            onChangeText={(text) => {
                                                setManualAddress(text);
                                                searchAddress(text);
                                            }}
                                        />
                                        {manualAddress.length > 0 && (
                                            <TouchableOpacity onPress={() => { setManualAddress(''); setSearchResults([]); }}>
                                                <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    
                                    {isSearchingAddress && (
                                        <View style={styles.searchingContainer}>
                                            <ActivityIndicator size="small" color={primaryColor} />
                                            <Text style={styles.searchingText}>Searching...</Text>
                                        </View>
                                    )}
                                    
                                    {searchResults.length > 0 && (
                                        <View style={styles.searchResultsContainer}>
                                            <ScrollView style={styles.searchResultsScroll} keyboardShouldPersistTaps="handled">
                                                {searchResults.map((result, index) => (
                                                    <TouchableOpacity 
                                                        key={index} 
                                                        style={styles.searchResultItem} 
                                                        onPress={() => handleSelectSearchResult(result)}
                                                    >
                                                        <Ionicons name="location-outline" size={20} color={primaryColor} />
                                                        <View style={styles.searchResultTextContainer}>
                                                            <Text style={styles.searchResultTitle} numberOfLines={1}>{result.display_name.split(',')[0]}</Text>
                                                            <Text style={styles.searchResultSubtitle} numberOfLines={2}>{result.display_name}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>

                                {tempMarkerLocation && (
                                    <View style={[styles.previewMapContainer, { borderColor: primaryColor }]}>
                                        <View style={styles.previewMapHeader}>
                                            <Text style={styles.previewMapTitle}>Selected Location</Text>
                                            <TouchableOpacity onPress={() => { setTempMarkerLocation(null); setSelectedLocation(null); }}>
                                                <Ionicons name="refresh" size={20} color={primaryColor} />
                                            </TouchableOpacity>
                                        </View>
                                        <MapView
                                            style={styles.previewMap}
                                            region={{
                                                latitude: tempMarkerLocation.latitude,
                                                longitude: tempMarkerLocation.longitude,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            }}
                                            scrollEnabled={false}
                                            zoomEnabled={false}
                                        >
                                            <Marker coordinate={tempMarkerLocation} />
                                        </MapView>
                                        <View style={styles.previewAddressContainer}>
                                            <Ionicons name="location-sharp" size={16} color={primaryColor} />
                                            <Text style={styles.previewAddressText} numberOfLines={2}>{locationAddress}</Text>
                                        </View>
                                    </View>
                                )}

                                {!tempMarkerLocation && (
                                    <>
                                        <View style={styles.orDivider}>
                                            <View style={styles.dividerLine} />
                                            <Text style={styles.dividerText}>OR</Text>
                                            <View style={styles.dividerLine} />
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.submitAddressButton, { backgroundColor: primaryColor }]} 
                                            onPress={handleManualAddressSubmit} 
                                            disabled={isDetectingLocation || !manualAddress.trim()}
                                        >
                                            {isDetectingLocation ? <ActivityIndicator color="#fff" /> : <>
                                                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                                <Text style={styles.submitAddressText}>Geocode Address Entry</Text>
                                            </>}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowLocationModal(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    styles.confirmButton, 
                                    { backgroundColor: primaryColor },
                                    !tempMarkerLocation && styles.confirmButtonDisabled
                                ]} 
                                onPress={confirmLocation} 
                                disabled={!tempMarkerLocation}
                            >
                                <Text style={styles.confirmButtonText}>Confirm Location</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        );
    };

    const renderSuccessModal = () => {
        return (
            <Modal
                visible={successModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSuccessModalVisible(false)}
            >
                <View style={styles.successOverlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <Animated.View style={[
                            styles.successContainer,
                            {
                                transform: [{ scale: scaleAnim }],
                                opacity: scaleAnim,
                            }
                        ]}>
                            {/* Success Icon */}
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
                                                    })
                                                }
                                            ]
                                        }}
                                    >
                                        <Ionicons name="checkmark" size={60} color="#fff" />
                                    </Animated.View>
                                </LinearGradient>
                            </View>

                            {/* Success Text */}
                            <Animated.View style={{ opacity: fadeAnim }}>
                                <Text style={styles.successTitle}>Booking Confirmed! 🎉</Text>
                                <Text style={styles.successSubtitle}>
                                    Your service request has been submitted successfully
                                </Text>
                            </Animated.View>

                            {/* Booking Details */}
                            <Animated.View style={[
                                styles.successDetails,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: slideAnim }]
                                }
                            ]}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Service</Text>
                                    <Text style={styles.detailValue}>{bookingData?.serviceName}</Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Request ID</Text>
                                    <Text style={[styles.detailValue, styles.detailCode]}>
                                        #{bookingData?.requestId}
                                    </Text>
                                </View>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: primaryLight }]}>
                                        <View style={[styles.statusDot, { backgroundColor: primaryColor }]} />
                                        <Text style={[styles.statusText, { color: primaryColor }]}>Pending Approval</Text>
                                    </View>
                                </View>
                            </Animated.View>

                            {/* Action Buttons */}
                            <Animated.View style={[
                                styles.successActions,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: slideAnim }]
                                }
                            ]}>
                                <TouchableOpacity
                                    style={[styles.successButton, styles.successButtonPrimary, { backgroundColor: primaryColor }]}
                                    onPress={() => handleSuccessAction('status')}
                                >
                                    <Text style={styles.successButtonText}>Track Status</Text>
                                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity
                                    style={[styles.successButton, styles.successButtonSecondary]}
                                    onPress={() => handleSuccessAction('home')}
                                >
                                    <Text style={[styles.successButtonText, { color: primaryColor }]}>Back to Home</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </Modal>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={styles.loadingText}>Loading service details...</Text>
            </View>
        );
    }

    return (
        <>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {renderServiceDetails()}
                <View style={styles.footerSpacer} />
            </ScrollView>
            
            {renderFooter()}
            {renderBookingModal()}
            {renderLocationModal()}
            {renderSuccessModal()}
        </>
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
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
    },
    footerSpacer: {
        height: 100,
    },
    imageContainer: {
        position: 'relative',
        height: 280,
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
        fontSize: 64,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
    },
    priceBadge: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    priceBadgeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    infoContainer: {
        padding: 20,
    },
    serviceName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    stars: {
        flexDirection: 'row',
    },
    ratingText: {
        fontSize: 13,
        color: '#64748b',
    },
    section: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 14,
        color: '#64748b',
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
        color: '#334155',
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#f0f2f5',
    },
    locationIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 2,
    },
    locationAddress: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f0f2f5',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
    },
    priceContainer: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 12,
        color: '#94a3b8',
    },
    priceAmount: {
        fontSize: 24,
        fontWeight: '700',
    },
    bookButton: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    bookButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0f172a',
    },
    modalBody: {
        padding: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f2f5',
    },
    serviceSummary: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: 'center',
    },
    summaryServiceName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 4,
    },
    summaryPrice: {
        fontSize: 20,
        fontWeight: '700',
    },
    locationSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: '#f0f2f5',
    },
    locationSummaryText: {
        flex: 1,
        fontSize: 14,
        color: '#64748b',
    },
    priceBreakdown: {
        marginTop: 8,
        paddingTop: 8,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    breakdownLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    breakdownValue: {
        fontSize: 14,
        color: '#0f172a',
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: '#f0f2f5',
        marginVertical: 12,
    },
    breakdownTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    totalAmount: {
        fontSize: 20,
        fontWeight: '700',
    },
    paymentNote: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748b',
    },
    confirmButton: {
        flex: 2,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    confirmButtonDisabled: {
        backgroundColor: '#cbd5e1',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    methodSelector: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 10,
        gap: 12,
    },
    methodButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    methodButtonActive: {
        backgroundColor: '#fef3e8',
        borderColor: '#e67e22',
    },
    methodText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    methodTextActive: {
        color: '#e67e22',
    },
    autoLocationContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    detectContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    detectTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 16,
        marginBottom: 8,
    },
    detectSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
    },
    detectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 30,
    },
    detectButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    mapContainer: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 10,
    },
    map: {
        flex: 1,
    },
    mapAddressContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    mapAddressText: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    recenterButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: '#fff',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
    },
    manualLocationContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    searchInputWrapper: {
        marginBottom: 10,
        zIndex: 10,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 10,
    },
    searchAddressInput: {
        flex: 1,
        fontSize: 16,
        color: '#0f172a',
        paddingVertical: 0,
    },
    searchResultsContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginTop: 8,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchResultsScroll: {
        maxHeight: 200,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
        gap: 12,
    },
    searchResultTextContainer: {
        flex: 1,
    },
    searchResultTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    searchResultSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    searchingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 8,
    },
    searchingText: {
        fontSize: 14,
        color: '#64748b',
    },
    previewMapContainer: {
        marginTop: 10,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    previewMapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    previewMapTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    previewMap: {
        height: 150,
        width: '100%',
    },
    previewAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#ffffff',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f2f5',
    },
    previewAddressText: {
        flex: 1,
        fontSize: 12,
        color: '#64748b',
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#94a3b8',
        fontSize: 12,
    },
    submitAddressButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    submitAddressText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    successContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 32,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 30,
        elevation: 10,
    },
    successIconContainer: {
        marginBottom: 20,
    },
    successCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    successDetails: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    detailLabel: {
        fontSize: 13,
        color: '#64748b',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    detailCode: {
        color: '#0177b8',
        fontFamily: 'monospace',
        fontSize: 14,
    },
    detailDivider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 6,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    successActions: {
        width: '100%',
        gap: 10,
    },
    successButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    successButtonPrimary: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    successButtonSecondary: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    successButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
});