import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';

const ACCENT = '#0177b8';

export default function OnboardingLocation() {
    const router = useRouter();
    const { user, updateProfile, logout } = useAuth();
    const insets = useSafeAreaInsets();

    // Location state
    const [location, setLocation] = useState<string>('');
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMapSelector, setShowMapSelector] = useState(false);
    const [loadingGps, setLoadingGps] = useState(false);
    
    // Permission states
    const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [showLocationBenefits, setShowLocationBenefits] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        checkLocationAndRedirect();
    }, []);

    const checkLocationAndRedirect = async () => {
        try {
            setIsChecking(true);
            
            // FIRST: Check if user already has location saved in profile
            if (user?.location && user.location.trim() !== '') {
                console.log('User already has location saved:', user.location);
                redirectToDashboard();
                return;
            }
            
            // SECOND: Check location permission status
            const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
            console.log('Location permission status:', locationStatus);
            setLocationPermission(locationStatus);
            
            // THIRD: If permission is already granted, try to get location immediately
            if (locationStatus === 'granted') {
                try {
                    const loc = await Location.getCurrentPositionAsync({ 
                        accuracy: Location.Accuracy.Balanced 
                    });
                    const coords = { 
                        latitude: loc.coords.latitude, 
                        longitude: loc.coords.longitude 
                    };
                    const locationString = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
                    
                    // Save location automatically if granted
                    await updateProfile(user?.fullName || '', locationString);
                    console.log('Auto-saved location:', locationString);
                    redirectToDashboard();
                    return;
                } catch (error) {
                    console.log('Could not get current location:', error);
                    // If can't get location, show the map picker
                    setShowLocationBenefits(false);
                }
            } 
            // FOURTH: If permission is denied or undetermined, show benefits page
            else {
                setShowLocationBenefits(true);
            }
            
            // Check notification permission
            try {
                const { status: notificationStatus } = await Notifications.getPermissionsAsync();
                setNotificationPermission(notificationStatus);
            } catch (error) {
                console.log('Notification permission check failed:', error);
                setNotificationPermission('undetermined');
            }
            
        } catch (error) {
            console.log('Error checking location:', error);
            setShowLocationBenefits(true);
        } finally {
            setIsChecking(false);
        }
    };

    const redirectToDashboard = () => {
        const userRole = user?.role || 'customer';
        console.log('Redirecting to dashboard:', userRole);
        
        if (userRole === 'mistri') {
            router.replace('/(protected)/mistri');
        } else {
            router.replace('/(protected)/customer');
        }
    };

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await logout();
            router.replace('/login');
        } catch (error) {
            Alert.alert('Error', 'Failed to log out. Please try again.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log('Location permission requested:', status);
            setLocationPermission(status);
            
            if (status === 'granted') {
                // Hide benefits and show location selection
                setShowLocationBenefits(false);
                await handleUseCurrentLocation();
            } else if (status === 'denied') {
                // Still show benefits but with different messaging
                Alert.alert(
                    'Location Access Denied',
                    'You can still set your location manually on the map. Would you like to do that?',
                    [
                        { text: 'Set Manually', onPress: () => setShowLocationBenefits(false) },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to request location permission');
        }
    };

    const requestNotificationPermission = async () => {
        try {
            const { status } = await Notifications.requestPermissionsAsync();
            console.log('Notification permission requested:', status);
            setNotificationPermission(status);
            
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Notifications help you get real-time updates about your service requests.',
                    [
                        { text: 'Not Now', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() }
                    ]
                );
            }
        } catch (error) {
            console.log('Notification permission error:', error);
            Alert.alert('Error', 'Failed to request notification permission');
        }
    };

    const handleUseCurrentLocation = async () => {
        try {
            setLoadingGps(true);
            const loc = await Location.getCurrentPositionAsync({ 
                accuracy: Location.Accuracy.Balanced 
            });
            const coords = { 
                latitude: loc.coords.latitude, 
                longitude: loc.coords.longitude 
            };
            setMarkerPosition(coords);
            setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
            console.log('Current location:', coords);
        } catch (error) {
            Alert.alert('Error', 'Could not get your location. Please try again or set it on the map.');
        } finally {
            setLoadingGps(false);
        }
    };

    const handleMapConfirm = (coords: { latitude: number; longitude: number }) => {
        setMarkerPosition(coords);
        setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
        console.log('Map location selected:', coords);
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            await updateProfile(user?.fullName || '', location || undefined);
            redirectToDashboard();
        } catch (error) {
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show loading while checking
    if (isChecking) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={styles.loadingText}>Setting up your experience...</Text>
            </View>
        );
    }

    const LocationBenefitsSection = () => (
        <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Location Access Needed</Text>
            <Text style={styles.benefitsSubtitle}>
                We need your location to provide the best service experience
            </Text>
            
            <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: `${ACCENT}15` }]}>
                    <Ionicons name="map-outline" size={24} color={ACCENT} />
                </View>
                <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>Find Nearby Professionals</Text>
                    <Text style={styles.benefitDesc}>
                        Get matched with service providers closest to you
                    </Text>
                </View>
            </View>

            <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: `${ACCENT}15` }]}>
                    <Ionicons name="time-outline" size={24} color={ACCENT} />
                </View>
                <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>Faster Response Times</Text>
                    <Text style={styles.benefitDesc}>
                        Receive accurate arrival time estimates
                    </Text>
                </View>
            </View>

            <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: `${ACCENT}15` }]}>
                    <Ionicons name="cash-outline" size={24} color={ACCENT} />
                </View>
                <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>Local Pricing</Text>
                    <Text style={styles.benefitDesc}>
                        Get service rates based on your location
                    </Text>
                </View>
            </View>

            <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: `${ACCENT}15` }]}>
                    <Ionicons name="shield-checkmark-outline" size={24} color={ACCENT} />
                </View>
                <View style={styles.benefitContent}>
                    <Text style={styles.benefitTitle}>Privacy Protected</Text>
                    <Text style={styles.benefitDesc}>
                        You have full control over your location sharing
                    </Text>
                </View>
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => {
                        setShowLocationBenefits(false);
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={styles.skipButtonText}>Set Manually</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.acceptButton, { backgroundColor: ACCENT }]}
                    onPress={requestLocationPermission}
                    activeOpacity={0.8}
                >
                    <Text style={styles.acceptButtonText}>Enable Location</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    const LocationSelectionSection = () => (
        <View style={styles.formSection}>
            <View style={styles.locationHeader}>
                <Ionicons name="location" size={28} color={ACCENT} />
                <Text style={styles.locationHeaderText}>Set Your Location</Text>
            </View>
            
            <Text style={styles.locationDescription}>
                {locationPermission === 'denied' 
                    ? "You've denied location permission. You can set your location manually on the map below."
                    : "Share your location to find nearby service providers or set it manually on the map"}
            </Text>

            {locationPermission === 'granted' && (
                <TouchableOpacity
                    style={[styles.gpsButton, loadingGps && styles.buttonDisabled]}
                    onPress={handleUseCurrentLocation}
                    disabled={loadingGps}
                    activeOpacity={0.8}
                >
                    {loadingGps ? (
                        <ActivityIndicator size="small" color={ACCENT} />
                    ) : (
                        <Ionicons name="locate" size={22} color={ACCENT} />
                    )}
                    <Text style={[styles.gpsButtonText, { color: ACCENT }]}>
                        {loadingGps ? 'Getting location...' : 'Use my current location'}
                    </Text>
                </TouchableOpacity>
            )}

            {locationPermission === 'denied' && (
                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.8}
                >
                    <Ionicons name="settings-outline" size={22} color={ACCENT} />
                    <Text style={[styles.settingsButtonText, { color: ACCENT }]}>
                        Open Settings to Enable Location
                    </Text>
                </TouchableOpacity>
            )}

            {(locationPermission === 'granted' || locationPermission === 'denied') && (
                <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.divider} />
                </View>
            )}

            {markerPosition ? (
                <View style={[styles.locationCard, { borderColor: ACCENT, backgroundColor: `${ACCENT}10` }]}>
                    <Ionicons name="location" size={24} color={ACCENT} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.locationCardLabel}>Selected Location</Text>
                        <Text style={styles.locationCardCoords}>
                            {markerPosition.latitude.toFixed(4)}°, {markerPosition.longitude.toFixed(4)}°
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowMapSelector(true)} style={[styles.changeBtn, { backgroundColor: ACCENT }]}>
                        <Text style={styles.changeBtnText}>Change</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={[styles.mapPickerButton, { borderColor: ACCENT }]}
                    onPress={() => setShowMapSelector(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="map-outline" size={24} color={ACCENT} />
                    <Text style={[styles.mapPickerText, { color: ACCENT }]}>Select location on map</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[
                    styles.primaryButton,
                    { backgroundColor: ACCENT },
                    (!location && !markerPosition) && styles.buttonDisabled,
                    isSubmitting && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={(!location && !markerPosition) || isSubmitting}
                activeOpacity={0.8}
            >
                {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <Text style={styles.primaryButtonText}>
                            Continue
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    const NotificationPermissionSection = () => (
        notificationPermission !== 'granted' && (
            <View style={styles.notificationContainer}>
                <View style={styles.notificationIconContainer}>
                    <Ionicons name="notifications-outline" size={32} color="#FF6B35" />
                </View>
                <Text style={styles.notificationTitle}>Stay Updated</Text>
                <Text style={styles.notificationDesc}>
                    Get real-time notifications about service requests, messages, and updates
                </Text>
                
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => setNotificationPermission('denied')}
                    >
                        <Text style={styles.skipButtonText}>Not now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.acceptButton, { backgroundColor: '#FF6B35' }]}
                        onPress={requestNotificationPermission}
                    >
                        <Text style={styles.acceptButtonText}>Enable</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        )
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerSection}>
                        <Image
                            source={require('../../../../assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!</Text>
                        <Text style={styles.subtitle}>
                            Let's set up your location to connect you with the best service providers nearby
                        </Text>
                    </View>

                    {showLocationBenefits && (
                        <LocationBenefitsSection />
                    )}

                    {!showLocationBenefits && (
                        <>
                            <LocationSelectionSection />
                            <NotificationPermissionSection />
                        </>
                    )}

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                        <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <ExpandableMapSelector
                visible={showMapSelector}
                onClose={() => setShowMapSelector(false)}
                onConfirm={handleMapConfirm}
                initialLocation={markerPosition}
                accentColor={ACCENT}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    flex: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: { width: 80, height: 80, marginBottom: 20 },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    },
    benefitsContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
    },
    benefitsTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
    },
    benefitsSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    benefitItem: {
        flexDirection: 'row',
        marginBottom: 20,
        alignItems: 'flex-start',
    },
    benefitIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    benefitContent: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    benefitDesc: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    acceptButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    acceptButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    skipButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    skipButtonText: {
        color: '#6b7280',
        fontSize: 16,
        fontWeight: '500',
    },
    formSection: {
        marginBottom: 24,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    locationHeaderText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    locationDescription: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 24,
        lineHeight: 20,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: ACCENT,
        backgroundColor: `${ACCENT}10`,
        marginBottom: 20,
    },
    gpsButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    settingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: ACCENT,
        backgroundColor: `${ACCENT}10`,
        marginBottom: 20,
    },
    settingsButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: { opacity: 0.6 },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    orText: {
        marginHorizontal: 16,
        fontSize: 13,
        color: '#9ca3af',
    },
    mapPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 2,
        marginBottom: 24,
    },
    mapPickerText: {
        fontSize: 16,
        fontWeight: '600',
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
    },
    locationCardLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 2,
    },
    locationCardCoords: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    changeBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    changeBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    primaryButton: {
        flexDirection: 'row',
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 8,
        gap: 8,
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '500',
    },
    notificationContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    notificationIconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#FFF4E8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    notificationTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    notificationDesc: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
});