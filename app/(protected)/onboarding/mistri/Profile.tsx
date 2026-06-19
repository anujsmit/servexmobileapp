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
    const { services } = useServices();

    const [fullName, setFullName] = useState(user?.fullName || '');
    const [fullNameError, setFullNameError] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [serviceId, setServiceId] = useState<number | null>(null);
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

    const SERVICE_OPTIONS: { id: number; name: string; icon: IoniconName; color: string }[] = services.map(service => {
        const icon: IoniconName = service.serviceName.toLowerCase().includes('plumb') ? 'hammer-outline' :
            service.serviceName.toLowerCase() === 'electrician' ? 'flash-outline' :
                'construct-outline';
        return {
            id: service.id,
            name: service.serviceName.toLowerCase(),
            icon,
            color: service.color || '#6b7280',
        };
    });

    const currentServiceColor = () =>
        SERVICE_OPTIONS.find(s => s.id === serviceId)?.color || ACCENT;

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission required', 'Permission to access photos is needed!');
                }
            }
        })();
    }, []);

    const pickImage = async (setter: (uri: string) => void, base64Setter: (b64: string) => void) => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        serviceId &&
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
            const response = await fetch(`${API_URL}/api/auth/mistri/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    serviceId,
                    profilePhotoBase64: imageBase64,
                    currentLocation: location,
                    fullName,
                    bio,
                    experienceLevel,
                    govtIdType,
                    govtIdFrontBase64: idFrontBase64,
                    govtIdBackBase64: idBackBase64,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create profile');
            }
            await getMe();
            router.replace(ROUTES.PENDING_APPROVAL as any);
        } catch (error) {
            if (__DEV__) console.error('Onboarding error', error);
            Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const renderIdPicker = (
        label: string,
        uri: string | null,
        onPick: () => void
    ) => (
        <TouchableOpacity style={styles.idPickerButton} onPress={onPick} activeOpacity={0.8}>
            {uri ? (
                <Image source={{ uri }} style={styles.idThumbnail} />
            ) : (
                <View style={styles.idPickerPlaceholder}>
                    <Ionicons name="camera-outline" size={24} color="#6b7280" />
                    <Text style={styles.idPickerLabel}>{label}</Text>
                </View>
            )}
            {uri && (
                <View style={styles.idPickerOverlay}>
                    <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                </View>
            )}
        </TouchableOpacity>
    );

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
                    <TouchableOpacity style={styles.avatarPlaceholder} onPress={() => pickImage(setImageUri, (b) => setImageBase64(b))} activeOpacity={0.8}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarEmpty}>
                                <Ionicons name="camera" size={28} color="#9ca3af" />
                                <Text style={styles.avatarEmptyText}>Add Photo</Text>
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

                {/* Service */}
                <View style={styles.section}>
                    <Text style={styles.inputLabel}>Select Service <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pillRow}>
                        {SERVICE_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.id}
                                style={[
                                    styles.servicePill,
                                    serviceId === opt.id && { backgroundColor: `${opt.color}15`, borderColor: opt.color },
                                ]}
                                onPress={() => setServiceId(opt.id)}
                            >
                                <Ionicons name={opt.icon} size={18} color={serviceId === opt.id ? opt.color : '#6b7280'} style={{ marginRight: 6 }} />
                                <Text style={[styles.pillText, serviceId === opt.id && { color: opt.color }]}>
                                    {opt.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
                    <Text style={styles.helperText}>Upload a clear photo of both sides of your ID</Text>

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
                            () => pickImage(setIdFrontUri, (b) => setIdFrontBase64(b))
                        )}
                        {renderIdPicker(
                            'Back Side',
                            idBackUri,
                            () => pickImage(setIdBackUri, (b) => setIdBackBase64(b))
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
    inputLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
    required: { color: '#ef4444' },
    helperText: { fontSize: 13, color: '#6b7280', marginBottom: 10, lineHeight: 18 },
    inputWrapper: { borderWidth: 2, borderColor: '#e5e5e5', borderRadius: 12, backgroundColor: '#f8f9fa' },
    textInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1a1a1a' },
    textArea: { height: 100, textAlignVertical: 'top' },
    errorText: { color: '#ef4444', fontSize: 13, marginTop: 4 },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', borderWidth: 2, borderColor: '#e5e5e5' },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    avatarEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
    avatarEmptyText: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    servicePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 10,
        backgroundColor: '#ffffff',
    },
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
        height: 110,
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
    idPickerLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500', textAlign: 'center' },
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
});
