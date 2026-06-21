import React, { useState, useEffect } from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../../../../context/AuthContext';
import { API_BASE_URL as API_URL } from '../../../../lib/config';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';
import { useServices } from '../../../../context/ServicesContext';
import { ROUTES } from '../../../../lib/routes';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACCENT = '#179d2e';

const EXPERIENCE_OPTIONS = [
    { value: 'less_than_1', label: '< 1 year' },
    { value: '1_to_3', label: '1–3 years' },
    { value: '3_plus', label: '3+ years' },
];

const GOVT_ID_TYPES = [
    { value: 'citizenship', label: 'Citizenship' },
    { value: 'passport', label: 'Passport' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'driving_license', label: 'Driving License' },
];

export default function MistriOnboardingProfile() {
    const router = useRouter();
    const { user, token, getMe, logout } = useAuth();
    const { services, loading: servicesLoading } = useServices();

    const [fullName, setFullName] = useState(user?.fullName || '');
    const [fullNameError, setFullNameError] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    
    // Multiple services selection
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
    
    const [bio, setBio] = useState('');
    const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [location, setLocation] = useState('');
    const [showMapSelector, setShowMapSelector] = useState(false);

    // Govt ID state
    const [govtIdType, setGovtIdType] = useState<string | null>(null);
    const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
    const [idFrontBase64, setIdFrontBase64] = useState<string | null>(null);
    const [idBackUri, setIdBackUri] = useState<string | null>(null);
    const [idBackBase64, setIdBackBase64] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Map services from backend with icons
    const SERVICE_OPTIONS = services.map(service => {
        let icon: IoniconName = 'construct-outline';
        const serviceNameLower = service.serviceName.toLowerCase();
        
        if (serviceNameLower.includes('plumb')) icon = 'hammer-outline';
        else if (serviceNameLower === 'electrician') icon = 'flash-outline';
        else if (serviceNameLower === 'painter') icon = 'brush-outline';
        else if (serviceNameLower === 'cleaning') icon = 'sparkles-outline';
        else if (serviceNameLower === 'carpenter') icon = 'construct-outline';
        else if (serviceNameLower === 'ac_repair') icon = 'snow-outline';
        else if (serviceNameLower === 'mechanic') icon = 'car-outline';
        
        const displayName = service.serviceName.charAt(0).toUpperCase() + service.serviceName.slice(1);
        
        return {
            id: service.id,
            name: service.serviceName.toLowerCase(),
            displayName: displayName,
            icon,
            color: service.iconColor || '#6b7280',
            isActive: service.isActive,
        };
    }).filter(service => service.isActive !== false);

    // Get primary service color
    const currentServiceColor = () => {
        if (selectedServiceIds.length > 0) {
            const primaryService = SERVICE_OPTIONS.find(s => s.id === selectedServiceIds[0]);
            return primaryService?.color || ACCENT;
        }
        return ACCENT;
    };

    const toggleServiceSelection = (serviceId: number) => {
        setSelectedServiceIds(prev => 
            prev.includes(serviceId) 
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        );
    };

    const selectAllServices = () => {
        setSelectedServiceIds(SERVICE_OPTIONS.map(service => service.id));
    };

    const clearAllServices = () => {
        setSelectedServiceIds([]);
    };

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(
                        'Camera Permission Required',
                        'Camera access is needed to take your profile picture and capture ID documents in real-time for verification.'
                    );
                }
            }
        })();
    }, []);

    const takePhoto = async (setter: (uri: string) => void, base64Setter: (b64: string) => void) => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.7,
                base64: false,
            });

            if (!result.canceled && result.assets.length > 0) {
                const asset = result.assets[0];
                const manipulated = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                setter(manipulated.uri);
                base64Setter(manipulated.base64 || '');
            }
        } catch (error) {
            if (__DEV__) console.error(error);
            Alert.alert('Error', 'Failed to capture photo. Please try again.');
        }
    };

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

    const isFormValid =
        fullName.trim() &&
        imageUri && imageBase64 &&
        selectedServiceIds.length > 0 &&
        bio.trim() &&
        experienceLevel &&
        markerPosition && location &&
        govtIdType &&
        idFrontUri && idFrontBase64 &&
        idBackUri && idBackBase64;

    const handleContinue = async () => {
        if (!isFormValid) {
            Alert.alert('Missing info', 'Please fill all required fields.');
            return;
        }
        setUploading(true);

        try {
            let locationString = location;
            if (markerPosition) {
                locationString = `${markerPosition.latitude},${markerPosition.longitude}`;
            }

            const requestBody = {
                serviceId: selectedServiceIds[0],
                serviceIds: selectedServiceIds,
                profilePhotoBase64: imageBase64,
                currentLocation: locationString,
                fullName: fullName.trim(),
                bio: bio.trim(),
                experienceLevel: experienceLevel,
                govtIdType: govtIdType,
                govtIdFrontBase64: idFrontBase64,
                govtIdBackBase64: idBackBase64,
            };

            console.log('Sending request to:', `${API_URL}/api/mistri/profile`);
            console.log('Selected services:', selectedServiceIds);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(`${API_URL}/api/mistri/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const textResponse = await response.text();
                console.error('Server error response:', textResponse);

                try {
                    const errorData = JSON.parse(textResponse);
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                } catch (parseError) {
                    throw new Error(`Server error (${response.status}). Please check your connection and try again.`);
                }
            }

            const data = await response.json();
            console.log('Success response:', data);

            await getMe();
            router.replace(ROUTES.PENDING_APPROVAL as any);
        } catch (error: any) {
            if (__DEV__) {
                console.error('Onboarding error details:', {
                    message: error.message,
                    stack: error.stack,
                });
            }

            Alert.alert(
                'Error',
                error.message || 'Failed to complete onboarding. Please try again.'
            );
        } finally {
            setUploading(false);
        }
    };

    const renderIdPicker = (
        label: string,
        uri: string | null,
        onTakePhoto: () => void
    ) => (
        <TouchableOpacity style={styles.idPickerButton} onPress={onTakePhoto} activeOpacity={0.8}>
            {uri ? (
                <>
                    <Image source={{ uri }} style={styles.idThumbnail} />
                    <View style={styles.idPickerOverlay}>
                        <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                    </View>
                    <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={onTakePhoto}
                    >
                        <Ionicons name="camera-reverse" size={16} color="white" />
                        <Text style={styles.retakeText}>Retake</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.idPickerPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color="#6b7280" />
                    <Text style={styles.idPickerLabel}>{label}</Text>
                    <Text style={styles.idPickerSubLabel}>Take Photo</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (servicesLoading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={styles.loadingText}>Loading services...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.headerSection}>
                    <Image source={require('../../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.title}>Finish Your Profile</Text>
                    <Text style={styles.subtitle}>Complete your service profile to start accepting jobs</Text>
                </View>

                {/* Profile Photo */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Profile Photo <Text style={styles.required}>*</Text></Text>
                    <Text style={styles.helperText}>Take a live photo for your profile</Text>
                    <TouchableOpacity
                        style={styles.avatarPlaceholder}
                        onPress={() => takePhoto(setImageUri, (b) => setImageBase64(b))}
                        activeOpacity={0.8}
                    >
                        {imageUri ? (
                            <>
                                <Image source={{ uri: imageUri }} style={styles.avatar} />
                                <View style={styles.cameraOverlay}>
                                    <Ionicons name="camera-reverse" size={20} color="white" />
                                    <Text style={styles.retakeText}>Retake</Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.avatarEmpty}>
                                <Ionicons name="camera" size={32} color="#9ca3af" />
                                <Text style={styles.avatarEmptyText}>Take Photo</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Full Name */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Full Name <Text style={styles.required}>*</Text></Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            placeholder="Enter your full name"
                            value={fullName}
                            onChangeText={text => { setFullName(text); if (text.trim()) setFullNameError(''); }}
                            onBlur={() => { if (!fullName.trim()) setFullNameError('Full name is required'); }}
                            returnKeyType="next"
                            style={styles.textInput}
                        />
                    </View>
                    {fullNameError ? <Text style={styles.errorText}>{fullNameError}</Text> : null}
                </View>

                {/* Services - Premium Card Selection */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.inputLabel}>Select Services <Text style={styles.required}>*</Text></Text>
                        <View style={styles.bulkActions}>
                            <TouchableOpacity onPress={selectAllServices} style={styles.bulkAction}>
                                <Text style={styles.bulkActionText}>Select All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={clearAllServices} style={styles.bulkAction}>
                                <Text style={styles.bulkActionText}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.helperText}>Tap on services you offer (multiple selection allowed)</Text>
                    
                    <View style={styles.servicesGrid}>
                        {SERVICE_OPTIONS.map(opt => {
                            const isSelected = selectedServiceIds.includes(opt.id);
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        styles.serviceCard,
                                        isSelected && { 
                                            borderColor: opt.color, 
                                            backgroundColor: `${opt.color}08`,
                                            shadowColor: opt.color,
                                            shadowOpacity: 0.15,
                                            shadowRadius: 8,
                                            elevation: 4,
                                        },
                                    ]}
                                    onPress={() => toggleServiceSelection(opt.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.serviceIcon, { backgroundColor: `${opt.color}15` }]}>
                                        <Ionicons name={opt.icon} size={28} color={isSelected ? opt.color : '#6b7280'} />
                                    </View>
                                    <Text style={[styles.serviceName, isSelected && { color: opt.color, fontWeight: '700' }]}>
                                        {opt.displayName}
                                    </Text>
                                    {isSelected && (
                                        <View style={[styles.checkBadge, { backgroundColor: opt.color }]}>
                                            <Ionicons name="checkmark" size={16} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    
                    {/* Selected Services Chips */}
                    {selectedServiceIds.length > 0 && (
                        <View style={styles.selectedServicesSection}>
                            <Text style={styles.selectedServicesLabel}>Selected Services:</Text>
                            <View style={styles.selectedChipsContainer}>
                                {SERVICE_OPTIONS
                                    .filter(service => selectedServiceIds.includes(service.id))
                                    .map(service => (
                                        <View
                                            key={service.id}
                                            style={[
                                                styles.selectedChip,
                                                { backgroundColor: `${service.color}15` }
                                            ]}
                                        >
                                            <Ionicons name="checkmark-circle" size={14} color={service.color} />
                                            <Text style={[styles.selectedChipText, { color: service.color }]}>
                                                {service.displayName}
                                            </Text>
                                        </View>
                                    ))}
                            </View>
                            <Text style={styles.selectedCount}>
                                {selectedServiceIds.length} service{selectedServiceIds.length !== 1 ? 's' : ''} selected
                            </Text>
                        </View>
                    )}
                </View>

                {/* Bio */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Bio <Text style={styles.required}>*</Text></Text>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            placeholder="Tell us about your skills and experience..."
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            numberOfLines={4}
                            style={[styles.textInput, styles.textArea]}
                        />
                    </View>
                </View>

                {/* Experience Level */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Years of Experience <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pillRow}>
                        {EXPERIENCE_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.expPill,
                                    experienceLevel === opt.value && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT },
                                ]}
                                onPress={() => setExperienceLevel(opt.value)}
                            >
                                <Text style={[styles.pillText, experienceLevel === opt.value && { color: ACCENT, fontWeight: '700' }]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Service Location */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Service Location <Text style={styles.required}>*</Text></Text>
                    <Text style={styles.helperText}>Customers find you based on this location</Text>
                    {markerPosition ? (
                        <View style={[styles.locationCard, { borderColor: currentServiceColor(), backgroundColor: `${currentServiceColor()}10` }]}>
                            <MaterialIcons name="location-on" size={28} color={currentServiceColor()} style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.locationLabel}>Location set</Text>
                                <Text style={styles.locationCoords}>
                                    {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.changeBtn, { backgroundColor: currentServiceColor() }]}
                                onPress={() => setShowMapSelector(true)}
                            >
                                <Text style={styles.changeBtnText}>Change</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.mapPickerButton, { borderColor: currentServiceColor() }]}
                            onPress={() => setShowMapSelector(true)}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="add-location" size={22} color={currentServiceColor()} />
                            <Text style={[styles.mapPickerText, { color: currentServiceColor() }]}>Select Location on Map</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Government ID */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Government ID <Text style={styles.required}>*</Text></Text>
                    <Text style={styles.helperText}>Take clear photos of both sides of your ID</Text>

                    {/* ID Type selector */}
                    <View style={styles.idTypeGrid}>
                        {GOVT_ID_TYPES.map(idType => (
                            <TouchableOpacity
                                key={idType.value}
                                style={[
                                    styles.idTypePill,
                                    govtIdType === idType.value && { backgroundColor: `${ACCENT}15`, borderColor: ACCENT },
                                ]}
                                onPress={() => setGovtIdType(idType.value)}
                            >
                                <Text style={[styles.idTypeText, govtIdType === idType.value && { color: ACCENT, fontWeight: '700' }]}>
                                    {idType.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Front + Back pickers */}
                    <View style={styles.idPickersRow}>
                        {renderIdPicker(
                            'Front Side',
                            idFrontUri,
                            () => takePhoto(setIdFrontUri, (b) => setIdFrontBase64(b))
                        )}
                        {renderIdPicker(
                            'Back Side',
                            idBackUri,
                            () => takePhoto(setIdBackUri, (b) => setIdBackBase64(b))
                        )}
                    </View>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        { backgroundColor: currentServiceColor() },
                        (!isFormValid || uploading) && styles.buttonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={!isFormValid || uploading}
                    activeOpacity={0.8}
                >
                    {uploading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.submitButtonText}>Submit for Approval</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut || uploading} activeOpacity={0.7}>
                    <Ionicons name="log-out-outline" size={16} color="#cc0000" />
                    <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Text>
                </TouchableOpacity>
            </ScrollView>

            <ExpandableMapSelector
                visible={showMapSelector}
                onClose={() => setShowMapSelector(false)}
                onConfirm={(coords) => {
                    setMarkerPosition(coords);
                    setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
                }}
                initialLocation={markerPosition}
                accentColor={currentServiceColor()}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 100 },
    headerSection: { alignItems: 'flex-start', marginBottom: 28 },
    logo: { width: 56, height: 56, marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
    subtitle: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    inputLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
    required: { color: '#ef4444' },
    helperText: { fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 18 },
    bulkActions: { flexDirection: 'row', gap: 12 },
    bulkAction: { paddingHorizontal: 8, paddingVertical: 4 },
    bulkActionText: { fontSize: 12, color: '#179d2e', fontWeight: '600' },
    inputWrapper: { borderWidth: 2, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#f8f9fa' },
    textInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1a1a1a' },
    textArea: { height: 100, textAlignVertical: 'top' },
    errorText: { color: '#ef4444', fontSize: 13, marginTop: 4 },
    
    // Avatar styles
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#e5e5e5',
        position: 'relative',
    },
    avatar: { width: 120, height: 120, borderRadius: 60 },
    avatarEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
    },
    avatarEmptyText: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
    cameraOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 4,
    },
    retakeText: { color: 'white', fontSize: 11, fontWeight: '500' },
    
    // Premium Service Cards
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    serviceCard: {
        width: '47%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#e5e5e5',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    serviceIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textTransform: 'capitalize',
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    
    // Selected Services Chips
    selectedServicesSection: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e5e5',
    },
    selectedServicesLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
    },
    selectedChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    selectedChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    selectedCount: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 4,
    },
    
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    expPill: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 10,
        backgroundColor: '#ffffff',
    },
    pillText: { fontSize: 14, color: '#6b7280', fontWeight: '500', textTransform: 'capitalize' },
    
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 14,
        borderWidth: 2,
    },
    locationLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
    locationCoords: { fontSize: 12, color: '#6b7280', fontFamily: 'monospace' },
    changeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
    changeBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    mapPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderWidth: 2,
        borderRadius: 12,
    },
    mapPickerText: { fontSize: 15, fontWeight: '600' },
    
    // ID styles
    idTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    idTypePill: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    idTypeText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
    idPickersRow: { flexDirection: 'row', gap: 12 },
    idPickerButton: {
        flex: 1,
        height: 130,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e5e5e5',
        overflow: 'hidden',
        position: 'relative',
    },
    idPickerPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        gap: 6,
    },
    idPickerLabel: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
    idPickerSubLabel: { fontSize: 11, color: '#9ca3af' },
    idThumbnail: { width: '100%', height: '100%' },
    idPickerOverlay: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'white',
        borderRadius: 11,
    },
    
    submitButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
    buttonDisabled: { backgroundColor: '#d1d5db' },
    submitButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 6,
    },
    logoutText: { color: '#cc0000', fontSize: 15, fontWeight: '500' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
});