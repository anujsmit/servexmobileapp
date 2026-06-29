// app/(protected)/(customer)/book/consultation.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    KeyboardAvoidingView,
    Keyboard,
    TouchableWithoutFeedback,
    Modal,
    Dimensions,
    FlatList,
    Image,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../../../context/AuthContext';

const { width, height } = Dimensions.get('window');

// Types matching the API response
interface Category {
    id: number;
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconColor: string;
    displayOrder: number;
    totalItems: number;
}

interface ApiResponse {
    success: boolean;
    hierarchy: Category[];
    totalCategories: number;
    totalItems: number;
}

interface FormData {
    categoryId: number | null;
    categoryName: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    details: string;
    preferredDate: string;
    preferredTime: string;
    urgency: 'normal' | 'urgent' | 'emergency';
}

// Blue color scheme
const COLORS = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: 'rgba(37, 99, 235, 0.08)',
    primaryBgLight: 'rgba(37, 99, 235, 0.12)',
    primaryBgGradient: ['#2563eb', '#1d4ed8'] as const,
    text: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    white: '#ffffff',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
};

export default function ConsultationScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { user, token, refreshAccessToken, logout } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [showCategorySelector, setShowCategorySelector] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    
    const [mapRegion, setMapRegion] = useState({
        latitude: 27.7172,
        longitude: 85.3240,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [selectedLocation, setSelectedLocation] = useState<{
        latitude: number;
        longitude: number;
        address: string;
    } | null>(null);
    const [addressError, setAddressError] = useState<string>('');

    const mapRef = useRef<MapView>(null);

    const [formData, setFormData] = useState<FormData>({
        categoryId: null,
        categoryName: '',
        location: '',
        latitude: null,
        longitude: null,
        details: '',
        preferredDate: '',
        preferredTime: '',
        urgency: 'normal',
    });

    const [errors, setErrors] = useState<Partial<FormData>>({});

    // Fetch categories from API
    useEffect(() => {
        fetchCategories();
        requestLocationPermission();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/public/service-hierarchy`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }

            const data: ApiResponse = await response.json();
            
            if (data.success && data.hierarchy) {
                setCategories(data.hierarchy);
                
                // Auto-select first category
                if (data.hierarchy.length > 0) {
                    const firstCategory = data.hierarchy[0];
                    handleSelectCategory(firstCategory);
                }
            } else {
                Alert.alert('Error', 'Failed to load categories. Please try again.');
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            // Use fallback categories
            setCategories(getFallbackCategories());
            if (getFallbackCategories().length > 0) {
                handleSelectCategory(getFallbackCategories()[0]);
            }
        } finally {
            setLoading(false);
        }
    };

    const getFallbackCategories = (): Category[] => {
        return [
            { id: 1, name: 'Plumber', description: 'Professional plumbing services', iconUrl: null, iconColor: '#2563eb', displayOrder: 1, totalItems: 5 },
            { id: 2, name: 'Electrician', description: 'Professional electrical services', iconUrl: null, iconColor: '#2563eb', displayOrder: 2, totalItems: 4 },
            { id: 3, name: 'Painter', description: 'Professional painting services', iconUrl: null, iconColor: '#2563eb', displayOrder: 3, totalItems: 3 },
            { id: 4, name: 'Carpenter', description: 'Professional carpentry services', iconUrl: null, iconColor: '#2563eb', displayOrder: 4, totalItems: 3 },
            { id: 5, name: 'Cleaner', description: 'Professional cleaning services', iconUrl: null, iconColor: '#2563eb', displayOrder: 5, totalItems: 4 },
        ];
    };

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                setMapRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                });
            }
        } catch (error) {
            console.error('Error getting location:', error);
        }
    };

    const handleMapPress = async (event: any) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        
        setSelectedLocation({
            latitude,
            longitude,
            address: 'Loading address...',
        });

        try {
            const address = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (address && address.length > 0) {
                const addr = address[0];
                const formattedAddress = [
                    addr.name,
                    addr.street,
                    addr.city,
                    addr.region,
                    addr.country,
                ].filter(Boolean).join(', ');
                
                setSelectedLocation({
                    latitude,
                    longitude,
                    address: formattedAddress,
                });

                setFormData(prev => ({
                    ...prev,
                    location: formattedAddress,
                    latitude,
                    longitude,
                }));
                setAddressError('');
            }
        } catch (error) {
            console.error('Error getting address:', error);
            setSelectedLocation({
                latitude,
                longitude,
                address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            });
        }
    };

    const handleUseCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            const address = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (address && address.length > 0) {
                const addr = address[0];
                const formattedAddress = [
                    addr.name,
                    addr.street,
                    addr.city,
                    addr.region,
                    addr.country,
                ].filter(Boolean).join(', ');

                setFormData(prev => ({
                    ...prev,
                    location: formattedAddress,
                    latitude,
                    longitude,
                }));

                setSelectedLocation({
                    latitude,
                    longitude,
                    address: formattedAddress,
                });

                setMapRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                });

                setShowMap(false);
                setAddressError('');
            }
        } catch (error) {
            console.error('Error getting current location:', error);
            Alert.alert('Error', 'Failed to get current location. Please try again.');
        }
    };

    const validateForm = () => {
        const newErrors: Partial<FormData> = {};
        
        if (!formData.categoryId) {
            newErrors.categoryName = 'Please select a service category';
        }
        if (!formData.location.trim()) {
            newErrors.location = 'Please select a location';
        }
        if (!formData.details.trim()) {
            newErrors.details = 'Please describe your requirements';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Make authenticated request with token refresh
    const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
        let currentToken = token;
        if (!currentToken) {
            throw new Error('No token available');
        }

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
                Alert.alert(
                    'Session Expired',
                    'Your session has expired. Please login again.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                logout();
                                router.replace('/(auth)/login');
                            },
                        },
                    ]
                );
                throw new Error('Session expired');
            }
        }
        return response;
    };

    // Use the correct endpoint for consultations
    const handleSubmit = async () => {
        if (!validateForm()) {
            Alert.alert('Error', 'Please fill all required fields.');
            return;
        }

        if (!token) {
            Alert.alert('Error', 'You must be logged in to submit a consultation request.');
            return;
        }

        setSubmitting(true);
        try {
            const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/consultations`;
            console.log('📤 Submitting consultation to:', url);

            const response = await makeAuthenticatedRequest(url, {
                method: 'POST',
                body: JSON.stringify({
                    categoryId: formData.categoryId,
                    categoryName: formData.categoryName,
                    location: formData.location,
                    latitude: formData.latitude,
                    longitude: formData.longitude,
                    details: formData.details,
                    preferredDate: formData.preferredDate,
                    preferredTime: formData.preferredTime,
                    urgency: formData.urgency,
                }),
            });

            const data = await response.json();
            console.log('📥 Consultation response:', data);

            if (response.ok && data.success) {
                Alert.alert(
                    'Success',
                    'Your consultation request has been submitted. Our expert will contact you shortly.',
                    [
                        {
                            text: 'OK',
                            onPress: () => router.back(),
                        },
                    ]
                );
            } else {
                Alert.alert('Error', data.message || 'Failed to submit consultation request.');
            }
        } catch (error: any) {
            console.error('❌ Error submitting consultation:', error);
            if (error.message !== 'Session expired') {
                Alert.alert('Error', error.message || 'Network error. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectCategory = (category: Category) => {
        setSelectedCategory(category);
        setFormData(prev => ({
            ...prev,
            categoryId: category.id,
            categoryName: category.name,
        }));
        setShowCategorySelector(false);
        
        if (errors.categoryName) {
            setErrors({ ...errors, categoryName: undefined });
        }
    };

    const getCategoryIcon = (categoryName: string) => {
        const icons: Record<string, string> = {
            'Plumber': '🔧',
            'Electrician': '⚡',
            'Painter': '🎨',
            'Carpenter': '🪚',
            'Cleaner': '🧹',
            'AC Repair': '❄️',
            'General': '🛠️',
        };
        return icons[categoryName] || '🛠️';
    };

    const getCategoryColor = (categoryName: string) => {
        // All categories use blue theme
        return COLORS.primary;
    };

    const renderCategoryCard = (category: Category) => {
        const isSelected = selectedCategory?.id === category.id;
        const color = COLORS.primary;
        
        return (
            <TouchableOpacity
                key={category.id}
                style={[
                    styles.categoryCard,
                    isSelected && { borderColor: color, backgroundColor: COLORS.primaryBg }
                ]}
                onPress={() => handleSelectCategory(category)}
            >
                <View style={[styles.categoryIconContainer, { backgroundColor: COLORS.primaryBg }]}>
                    {category.iconUrl ? (
                        <Image source={{ uri: category.iconUrl }} style={styles.categoryIcon} />
                    ) : (
                        <Text style={styles.categoryIconEmoji}>{getCategoryIcon(category.name)}</Text>
                    )}
                </View>
                <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryDescription} numberOfLines={1}>
                        {category.description || `${category.totalItems || 0} services available`}
                    </Text>
                </View>
                {isSelected && (
                    <View style={[styles.selectedCheck, { backgroundColor: color }]}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderCategorySelector = () => (
        <Modal
            visible={showCategorySelector}
            animationType="slide"
            presentationStyle="fullScreen"
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity
                        onPress={() => setShowCategorySelector(false)}
                        style={styles.modalCloseButton}
                    >
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Service Category</Text>
                    <View style={{ width: 40 }} />
                </View>

                <FlatList
                    data={categories}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => renderCategoryCard(item)}
                    contentContainerStyle={styles.modalContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading available services...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header with Blue Gradient */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={COLORS.primaryBgGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.headerGradient}
                        >
                            <View style={styles.headerContent}>
                                <View style={styles.headerIconWrapper}>
                                    <Ionicons name="chatbubbles" size={32} color="#fff" />
                                </View>
                                <Text style={styles.headerTitle}>Book a Consultation</Text>
                                <Text style={styles.headerSubtitle}>
                                    Get expert advice from certified professionals
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* User Info */}
                        <View style={styles.userInfoCard}>
                            <View style={styles.userInfoRow}>
                                <Ionicons name="person-circle" size={24} color={COLORS.primary} />
                                <View>
                                    <Text style={styles.userInfoLabel}>Requesting for</Text>
                                    <Text style={styles.userInfoValue}>{user?.fullName || 'User'}</Text>
                                </View>
                            </View>
                            <View style={styles.userInfoRow}>
                                <Ionicons name="call" size={20} color={COLORS.primary} />
                                <Text style={styles.userInfoValue}>{user?.phoneNumber || 'N/A'}</Text>
                            </View>
                            {user?.defaultLocation && (
                                <View style={styles.userInfoRow}>
                                    <Ionicons name="location" size={20} color={COLORS.primary} />
                                    <Text style={styles.userInfoValue} numberOfLines={1}>
                                        {user.defaultLocation}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Category Selection */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Service Category *</Text>
                            <TouchableOpacity
                                style={[styles.categorySelectorButton, errors.categoryName && styles.inputError]}
                                onPress={() => setShowCategorySelector(true)}
                            >
                                <View style={styles.categorySelectorContent}>
                                    <MaterialIcons name="category" size={24} color={COLORS.primary} />
                                    <View style={styles.categorySelectorTextContainer}>
                                        <Text style={styles.categorySelectorLabel}>
                                            {selectedCategory ? 'Selected Category' : 'Tap to select a category'}
                                        </Text>
                                        <Text style={styles.categorySelectorValue}>
                                            {selectedCategory?.name || 'Choose from available services'}
                                        </Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                            {errors.categoryName && (
                                <Text style={styles.errorText}>{errors.categoryName}</Text>
                            )}
                            {selectedCategory && (
                                <View style={styles.selectedCategoryDetails}>
                                    <View style={styles.selectedCategoryRow}>
                                        <Text style={styles.selectedCategoryLabel}>Category:</Text>
                                        <Text style={styles.selectedCategoryValue}>{selectedCategory.name}</Text>
                                    </View>
                                    <View style={styles.selectedCategoryRow}>
                                        <Text style={styles.selectedCategoryLabel}>Services:</Text>
                                        <Text style={styles.selectedCategoryValue}>
                                            {selectedCategory.totalItems || 0} available
                                        </Text>
                                    </View>
                                    {selectedCategory.description && (
                                        <View style={styles.selectedCategoryRow}>
                                            <Text style={styles.selectedCategoryLabel}>Description:</Text>
                                            <Text style={styles.selectedCategoryValue} numberOfLines={2}>
                                                {selectedCategory.description}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Location */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Location *</Text>
                            <TouchableOpacity
                                style={[styles.locationButton, errors.location && styles.inputError]}
                                onPress={() => setShowMap(true)}
                            >
                                <MaterialIcons name="location-on" size={24} color={COLORS.primary} />
                                <Text style={styles.locationButtonText} numberOfLines={1}>
                                    {formData.location || 'Tap to select location on map'}
                                </Text>
                                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                            {errors.location && (
                                <Text style={styles.errorText}>{errors.location}</Text>
                            )}
                            {user?.defaultLocation && !formData.location && (
                                <TouchableOpacity 
                                    style={styles.useDefaultLocation}
                                    onPress={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            location: user.defaultLocation || '',
                                        }));
                                    }}
                                >
                                    <Text style={styles.useDefaultLocationText}>
                                        Use saved location: {user.defaultLocation}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Details */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Project Details *</Text>
                            <View style={[styles.detailsWrapper, errors.details && styles.inputError]}>
                                <TextInput
                                    style={styles.detailsInput}
                                    placeholder="Describe your project or requirements..."
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={formData.details}
                                    onChangeText={(text) => {
                                        setFormData({ ...formData, details: text });
                                        if (errors.details) {
                                            setErrors({ ...errors, details: undefined });
                                        }
                                    }}
                                    multiline
                                    numberOfLines={5}
                                    textAlignVertical="top"
                                />
                            </View>
                            {errors.details && (
                                <Text style={styles.errorText}>{errors.details}</Text>
                            )}
                        </View>

                        {/* Preferred Date & Time */}
                        <View style={styles.row}>
                            <View style={[styles.inputGroup, styles.halfWidth]}>
                                <Text style={styles.inputLabel}>Preferred Date</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => {
                                        // Show date picker
                                    }}
                                >
                                    <MaterialIcons name="event" size={20} color={COLORS.textSecondary} />
                                    <Text style={styles.dateButtonText}>
                                        {formData.preferredDate || 'Select date'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputGroup, styles.halfWidth]}>
                                <Text style={styles.inputLabel}>Preferred Time</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => {
                                        // Show time picker
                                    }}
                                >
                                    <MaterialIcons name="access-time" size={20} color={COLORS.textSecondary} />
                                    <Text style={styles.dateButtonText}>
                                        {formData.preferredTime || 'Select time'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Urgency */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Urgency Level</Text>
                            <View style={styles.urgencyContainer}>
                                {[
                                    { value: 'normal', label: 'Normal', icon: 'checkmark-circle-outline' },
                                    { value: 'urgent', label: 'Urgent', icon: 'alert-circle-outline' },
                                    { value: 'emergency', label: 'Emergency', icon: 'warning-outline' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.urgencyOption,
                                            formData.urgency === option.value && styles.urgencyOptionSelected,
                                        ]}
                                        onPress={() => setFormData({ ...formData, urgency: option.value as any })}
                                    >
                                        <Ionicons
                                            name={option.icon as any}
                                            size={20}
                                            color={formData.urgency === option.value ? COLORS.primary : COLORS.textSecondary}
                                        />
                                        <Text style={[
                                            styles.urgencyOptionText,
                                            formData.urgency === option.value && styles.urgencyOptionTextSelected,
                                        ]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Submit Button - Blue */}
                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={COLORS.primaryBgGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitGradient}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.submitText}>Request Consultation</Text>
                                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Contact Info */}
                        <View style={styles.contactContainer}>
                            <Text style={styles.contactText}>
                                Prefer to call? We're here to help
                            </Text>
                            <TouchableOpacity style={styles.phoneButton}>
                                <Ionicons name="call" size={16} color={COLORS.primary} />
                                <Text style={styles.phoneText}>+977 9815065520</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>

            {/* Map Modal */}
            <Modal
                visible={showMap}
                animationType="slide"
                presentationStyle="fullScreen"
            >
                <View style={styles.mapModalContainer}>
                    <View style={styles.mapHeader}>
                        <TouchableOpacity
                            onPress={() => setShowMap(false)}
                            style={styles.mapCloseButton}
                        >
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.mapTitle}>Select Location</Text>
                        <TouchableOpacity
                            onPress={handleUseCurrentLocation}
                            style={styles.mapCurrentLocationButton}
                        >
                            <Ionicons name="locate" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>

                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        region={mapRegion}
                        onPress={handleMapPress}
                        showsUserLocation
                        showsMyLocationButton
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
                                    handleMapPress({ nativeEvent: { coordinate: { latitude, longitude } } });
                                }}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={styles.marker}>
                                        <MaterialIcons name="location-pin" size={40} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.markerPulse} />
                                </View>
                            </Marker>
                        )}
                    </MapView>

                    {selectedLocation && (
                        <View style={styles.mapFooter}>
                            <View style={styles.mapAddressContainer}>
                                <MaterialIcons name="location-on" size={20} color={COLORS.primary} />
                                <Text style={styles.mapAddress} numberOfLines={2}>
                                    {selectedLocation.address}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.mapConfirmButton}
                                onPress={() => {
                                    setFormData(prev => ({
                                        ...prev,
                                        location: selectedLocation.address,
                                        latitude: selectedLocation.latitude,
                                        longitude: selectedLocation.longitude,
                                    }));
                                    setShowMap(false);
                                    setAddressError('');
                                }}
                            >
                                <LinearGradient
                                    colors={COLORS.primaryBgGradient}
                                    style={styles.mapConfirmGradient}
                                >
                                    <Text style={styles.mapConfirmText}>Confirm Location</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

            {/* Category Selector Modal */}
            {renderCategorySelector()}
        </KeyboardAvoidingView>
    );
}

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
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },

    // Header
    header: {
        marginBottom: 24,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    headerGradient: {
        paddingTop: 40,
        paddingBottom: 32,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        paddingHorizontal: 24,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerIconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        maxWidth: 280,
        lineHeight: 20,
    },

    // Form
    form: {
        paddingHorizontal: 20,
    },

    // User Info
    userInfoCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
    },
    userInfoLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    userInfoValue: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '600',
    },

    // Input Group
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    inputError: {
        borderColor: COLORS.error,
    },
    errorText: {
        fontSize: 12,
        color: COLORS.error,
        marginTop: 4,
        marginLeft: 4,
    },

    // Category Selector
    categorySelectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 14,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    categorySelectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    categorySelectorTextContainer: {
        flex: 1,
    },
    categorySelectorLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    categorySelectorValue: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '500',
    },

    // Selected Category Details
    selectedCategoryDetails: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    selectedCategoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    selectedCategoryLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    selectedCategoryValue: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
    },

    // Location
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    locationButtonText: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
    },
    useDefaultLocation: {
        marginTop: 8,
        paddingVertical: 4,
    },
    useDefaultLocationText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '500',
    },

    // Details
    detailsWrapper: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        paddingVertical: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    detailsInput: {
        fontSize: 15,
        color: COLORS.text,
        minHeight: 120,
        paddingTop: 8,
    },

    // Date & Time
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        paddingVertical: 14,
        gap: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    dateButtonText: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
    },

    // Urgency
    urgencyContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    urgencyOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: COLORS.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 12,
        paddingHorizontal: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    urgencyOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryBg,
    },
    urgencyOptionText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    urgencyOptionTextSelected: {
        color: COLORS.primary,
    },

    // Submit
    submitButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
        marginTop: 8,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    submitGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    submitText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },

    // Contact
    contactContainer: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    contactText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    phoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: COLORS.primaryBg,
    },
    phoneText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
    },

    // Map Modal
    mapModalContainer: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    mapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    mapCloseButton: {
        padding: 8,
    },
    mapTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.text,
    },
    mapCurrentLocationButton: {
        padding: 8,
    },
    map: {
        flex: 1,
    },
    mapFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    mapAddressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    mapAddress: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
        lineHeight: 20,
    },
    mapConfirmButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    mapConfirmGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    mapConfirmText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    marker: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        opacity: 0.15,
    },

    // Category Selector Modal
    modalContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalCloseButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.text,
    },
    modalContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 12,
    },
    categoryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    categoryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    categoryIcon: {
        width: 32,
        height: 32,
        resizeMode: 'contain',
    },
    categoryIconEmoji: {
        fontSize: 24,
    },
    categoryInfo: {
        flex: 1,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    categoryDescription: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    selectedCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});