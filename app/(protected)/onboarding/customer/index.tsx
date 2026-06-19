import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    StyleSheet,
    Alert,
    Platform,
    SafeAreaView,
    KeyboardAvoidingView,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';

const ACCENT = '#0177b8';
const TOTAL_STEPS = 2;

export default function CustomerOnboardingProfile() {
    const router = useRouter();
    const { user, updateProfile, logout } = useAuth();
    const [step, setStep] = useState(1);

    // Step 1 state
    const [fullName, setFullName] = useState<string>(user?.fullName || '');

    // Step 2 state
    const [location, setLocation] = useState<string>('');
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMapSelector, setShowMapSelector] = useState(false);
    const [loadingGps, setLoadingGps] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        try {
            setIsLoggingOut(true);
            await logout();
            router.replace('/login');
        } catch {
            Alert.alert('Error', 'Failed to log out. Please try again.');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const handleUseCurrentLocation = async () => {
        try {
            setLoadingGps(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is needed to use your current location.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setMarkerPosition(coords);
            setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
        } catch {
            Alert.alert('Error', 'Could not get your location. Please try again or set it on the map.');
        } finally {
            setLoadingGps(false);
        }
    };

    const handleMapConfirm = (coords: { latitude: number; longitude: number }) => {
        setMarkerPosition(coords);
        setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
    };

    const handleNext = () => {
        if (step === 1) {
            if (!fullName.trim()) {
                Alert.alert('Required', 'Please enter your full name.');
                return;
            }
            setStep(2);
        }
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            await updateProfile(fullName.trim(), location || undefined);
            router.replace('/(protected)/(customer)' as any);
        } catch {
            Alert.alert('Error', 'Failed to save profile. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderProgressBar = () => (
        <View style={styles.progressContainer}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <View
                    key={i}
                    style={[
                        styles.progressDot,
                        i + 1 <= step && { backgroundColor: ACCENT },
                    ]}
                />
            ))}
            <Text style={styles.progressLabel}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderProgressBar()}

                    <View style={styles.headerSection}>
                        <Image
                            source={require('../../../../assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>
                            {step === 1 ? 'What should we call you?' : 'Where are you located?'}
                        </Text>
                        <Text style={styles.subtitle}>
                            {step === 1
                                ? 'Your name helps service providers address you'
                                : 'This helps us find nearby professionals faster'}
                        </Text>
                    </View>

                    {step === 1 && (
                        <View style={styles.formSection}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <View style={[styles.inputWrapper, fullName.trim() && { borderColor: ACCENT }]}>
                                <TextInput
                                    placeholder="Enter your full name"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    style={styles.textInput}
                                    returnKeyType="done"
                                    onSubmitEditing={handleNext}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: ACCENT }, !fullName.trim() && styles.buttonDisabled]}
                                onPress={handleNext}
                                disabled={!fullName.trim()}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.primaryButtonText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 2 && (
                        <View style={styles.formSection}>
                            {/* GPS button */}
                            <TouchableOpacity
                                style={[styles.gpsButton, loadingGps && styles.buttonDisabled]}
                                onPress={handleUseCurrentLocation}
                                disabled={loadingGps}
                                activeOpacity={0.8}
                            >
                                {loadingGps ? (
                                    <ActivityIndicator size="small" color={ACCENT} />
                                ) : (
                                    <Ionicons name="locate" size={20} color={ACCENT} />
                                )}
                                <Text style={[styles.gpsButtonText, { color: ACCENT }]}>
                                    {loadingGps ? 'Getting location...' : 'Use My Current Location'}
                                </Text>
                            </TouchableOpacity>

                            <Text style={styles.orText}>— or set on map —</Text>

                            {/* Map selector trigger */}
                            {markerPosition ? (
                                <View style={[styles.locationCard, { borderColor: ACCENT, backgroundColor: `${ACCENT}10` }]}>
                                    <Ionicons name="location" size={24} color={ACCENT} style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.locationCardLabel}>Location set</Text>
                                        <Text style={styles.locationCardCoords}>
                                            {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
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
                                    <Ionicons name="map-outline" size={22} color={ACCENT} />
                                    <Text style={[styles.mapPickerText, { color: ACCENT }]}>Select on Map</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.stepButtons}>
                                <TouchableOpacity
                                    style={styles.backStepButton}
                                    onPress={() => setStep(1)}
                                >
                                    <Text style={styles.backStepText}>← Back</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.primaryButton,
                                        { backgroundColor: ACCENT, flex: 1 },
                                        isSubmitting && styles.buttonDisabled,
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={isSubmitting}
                                    activeOpacity={0.8}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {location ? 'Finish Setup' : 'Skip & Finish'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={16} color="#cc0000" />
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    flex: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 24,
        paddingBottom: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 28,
    },
    progressDot: {
        width: 32,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#e5e7eb',
    },
    progressLabel: {
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: '500',
        marginLeft: 6,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: { width: 64, height: 64, marginBottom: 16 },
    title: {
        fontSize: 24,
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
    },
    formSection: { flex: 1 },
    inputLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    inputWrapper: {
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 12,
        backgroundColor: '#f8f9fa',
        marginBottom: 24,
    },
    textInput: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        color: '#1a1a1a',
    },
    primaryButton: {
        flexDirection: 'row',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    buttonDisabled: { backgroundColor: '#e5e5e5' },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#0177b8',
        backgroundColor: '#e6f3ff',
        marginBottom: 16,
    },
    gpsButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    orText: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 16,
    },
    mapPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
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
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
    },
    locationCardLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 2,
    },
    locationCardCoords: {
        fontSize: 12,
        color: '#6b7280',
        fontFamily: 'monospace',
    },
    changeBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
    },
    changeBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    stepButtons: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    backStepButton: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    backStepText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        marginTop: 16,
        gap: 6,
    },
    logoutText: {
        color: '#cc0000',
        fontSize: 15,
        fontWeight: '500',
    },
});
