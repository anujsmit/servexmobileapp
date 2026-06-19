import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { SearchingAnimation } from '../../../../components/SearchingAnimation';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';
import { useLocation } from '../../../../context/LocationContext';
import { useServices } from '../../../../context/ServicesContext';

// Type definitions
interface Coordinates {
    latitude: number;
    longitude: number;
}

const ServiceRequestSelection: React.FC = () => {
    // Get location from context (shared across app)
    const { location: contextLocation, address: contextAddress, coordinates: contextCoordinates, updateLocation, updateAddress, setCustomLocation } = useLocation();

    // Get services from context
    const { activeServices, getServiceColor, getServiceIcon } = useServices();

    // Service selection state (store service name as string, not hardcoded type)
    const [selectedService, setSelectedService] = useState<string | null>(null);

    // Location state (auto-detected only, no manual modification)
    const [markerLocation, setMarkerLocation] = useState<Coordinates | null>(
        contextCoordinates ? { latitude: contextCoordinates.latitude, longitude: contextCoordinates.longitude } : null
    );
    const [address, setAddress] = useState<string>(contextAddress);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [showLocationSelector, setShowLocationSelector] = useState(false);

    const router = useRouter();
    const mapRef = useRef<MapView>(null);

    // Function to reverse geocode and set address
    const updateAddressFromCoords = async (coords: Coordinates): Promise<void> => {
        try {
            const addressResult = await Location.reverseGeocodeAsync(coords);
            if (addressResult.length > 0) {
                const { name, street, city, region, country } = addressResult[0];
                const formattedAddress = `${name || street || ''}, ${city}, ${country}`.replace(/^,\s*/, '');
                setAddress(formattedAddress);
            }
        } catch (error) {
            if (__DEV__) console.error("Failed to reverse geocode", error);
            setAddress("Could not fetch address");
        }
    };

    // Request location permission and get current location
    const requestLocationPermission = async (): Promise<void> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                setLocationPermissionDenied(true);
                return;
            }

            setLocationPermissionDenied(false);
            // Location will be updated by context
        } catch (error) {
            if (__DEV__) console.error('Error requesting location permission:', error);
            Alert.alert('Error', 'Failed to request location permission. Please try again.');
        }
    };

    // Handle service selection (toggle on/off)
    const handleServiceSelection = (service: string): void => {
        setSelectedService(prev => prev === service ? null : service);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    // Handle "Find Mistri" button click
    const handleFindMistri = (): void => {
        if (!markerLocation) {
            Alert.alert('Location Required', 'Please set your location first.');
            return;
        }

        // Show searching animation (blocking view)
        setIsSearching(true);
    };

    // Called when searching animation completes
    const handleSearchComplete = (): void => {
        setIsSearching(false);
        // Navigate to available mistris page
        router.push({
            pathname: '/service-request/available',
            params: {
                selectedService: selectedService || '',
                latitude: markerLocation!.latitude.toString(),
                longitude: markerLocation!.longitude.toString(),
                address: address,
            },
        });
    };

    // Sync with location context
    useEffect(() => {
        if (contextCoordinates) {
            setMarkerLocation({
                latitude: contextCoordinates.latitude,
                longitude: contextCoordinates.longitude,
            });
        }
        if (contextAddress) {
            setAddress(contextAddress);
        }
    }, [contextCoordinates, contextAddress]);

    // Service card component - now driven by database services
    const ServiceCard: React.FC<{
        serviceName: string;
        icon: keyof typeof Ionicons.glyphMap;
        iconSelected: keyof typeof Ionicons.glyphMap;
        color: string;
        displayName: string;
    }> = ({ serviceName, icon, iconSelected, color, displayName }) => {
        const isSelected = selectedService === serviceName.toLowerCase();

        return (
            <TouchableOpacity
                style={[
                    styles.serviceCard,
                    isSelected && { backgroundColor: color, borderColor: color }
                ]}
                onPress={() => handleServiceSelection(serviceName.toLowerCase())}
                activeOpacity={0.7}
            >
                <Ionicons
                    name={isSelected ? iconSelected : icon}
                    size={32}
                    color={isSelected ? '#fff' : color}
                />
                <Text style={[
                    styles.serviceText,
                    isSelected && styles.selectedText
                ]}>
                    {displayName}
                </Text>
            </TouchableOpacity>
        );
    };

    // Show searching animation as blocking view
    if (isSearching) {
        return (
            <SafeAreaContainer>
                <SearchingAnimation
                    duration={2500}
                    onComplete={handleSearchComplete}
                />
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer>
            <PageTitle
                title="Request a Service"
                subtitle="Select a service type and we'll find nearby mistris for you"
            />
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Text style={styles.label}>Who are you looking for?</Text>
                <View style={styles.serviceSelection}>
                    {activeServices.map((service) => (
                        <ServiceCard
                            key={service.id}
                            serviceName={service.serviceName}
                            icon={service.icon}
                            iconSelected={service.iconSelected}
                            color={service.color}
                            displayName={service.displayName}
                        />
                    ))}
                </View>

                <Text style={styles.label}>Where are you located?</Text>

                {/* Map or Permission Denied UI */}
                {locationPermissionDenied ? (
                    <View style={styles.permissionDeniedContainer}>
                        <MaterialIcons name="location-off" size={64} color="#dc2626" />
                        <Text style={styles.permissionDeniedTitle}>Location Permission Denied</Text>
                        <Text style={styles.permissionDeniedText}>
                            We need access to your location to find nearby service providers. Please enable location permissions in your device settings.
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={requestLocationPermission}
                            activeOpacity={0.7}
                        >
                            <MaterialIcons name="refresh" size={20} color="#fff" />
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : contextCoordinates && markerLocation ? (
                    <View style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            initialRegion={{
                                latitude: contextCoordinates.latitude,
                                longitude: contextCoordinates.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            mapType="satellite"
                            showsUserLocation={true}
                            showsMyLocationButton={false}
                            toolbarEnabled={false}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                        >
                            <Marker
                                coordinate={markerLocation}
                                title="Your Location"
                                description={address}
                            />
                        </MapView>

                        {/* Address Display */}
                        <View style={styles.addressContainer}>
                            <Ionicons name="location-sharp" size={24} color="#16a34a" />
                            <Text style={styles.addressText} numberOfLines={2}>
                                {address}
                            </Text>
                        </View>

                        {/* Change Location button */}
                        <TouchableOpacity
                            style={styles.changeLocationButton}
                            onPress={() => setShowLocationSelector(true)}
                            activeOpacity={0.85}
                        >
                            <MaterialIcons name="edit-location-alt" size={16} color="#fff" />
                            <Text style={styles.changeLocationText}>Change</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.locationContainer}>
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text style={styles.locationLoadingText}>{address}</Text>
                    </View>
                )}

                {/* Map explanation text */}
                {contextCoordinates && markerLocation && (
                    <Text style={styles.mapExplanationText}>
                        Tap "Change" on the map to pick a different location, or we'll use your detected GPS position to find nearby service providers.
                    </Text>
                )}

                <TouchableOpacity
                    style={[
                        styles.button,
                        !markerLocation && styles.buttonDisabled
                    ]}
                    disabled={!markerLocation}
                    onPress={handleFindMistri}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="search" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Find Mistri</Text>
                </TouchableOpacity>
            </ScrollView>
            <ExpandableMapSelector
                visible={showLocationSelector}
                onClose={() => setShowLocationSelector(false)}
                onConfirm={async (loc) => {
                    await setCustomLocation(loc);
                }}
                initialLocation={contextCoordinates}
                accentColor="#2563eb"
            />
        </SafeAreaContainer>
    );
};

const styles = StyleSheet.create({
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 24,
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
    },
    serviceSelection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    serviceCard: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    serviceText: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    selectedText: {
        color: '#ffffff',
    },
    permissionDeniedContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 32,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 24,
        alignItems: 'center',
    },
    permissionDeniedTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#dc2626',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    permissionDeniedText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    mapContainer: {
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    addressContainer: {
        position: 'absolute',
        bottom: 30,
        left: 12,
        right: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    changeLocationButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(37, 99, 235, 0.92)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    changeLocationText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    locationContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        marginBottom: 24,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationLoadingText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 12,
    },
    button: {
        backgroundColor: '#16a34a',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 'auto',
        marginBottom: 20,
    },
    buttonDisabled: {
        backgroundColor: '#9ca3af',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    mapExplanationText: {
        fontSize: 12,
        color: '#6b7280',
        lineHeight: 18,
        marginTop: -8,
        marginBottom: 16,
        textAlign: 'justify',
    },
});

export default ServiceRequestSelection;

