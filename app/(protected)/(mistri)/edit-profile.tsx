import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
    Animated,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FaceDetector from 'expo-face-detector';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useMistriProfileQuery, useUpdateMistriProfile } from '../../../hooks/queries';
import { useAuth } from '../../../context/AuthContext';
import { ExpandableMapSelector } from '../../../components/ExpandableMapSelector';
import { useServices } from '../../../context/ServicesContext';
import { useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import type { ComponentProps } from 'react';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const AVAILABILITY_OPTIONS: {
    key: 'available' | 'on_work_available';
    label: string;
    shortLabel: string;
    icon: IoniconName;
    color: string;
    dimColor: string;
}[] = [
    { key: 'available', label: 'Available Now', shortLabel: 'Available', icon: 'checkmark-circle', color: '#10b981', dimColor: '#d1fae5' },
    { key: 'on_work_available', label: 'Currently on Work', shortLabel: 'On Work', icon: 'time', color: '#f59e0b', dimColor: '#fef3c7' },
];

export default function EditProfileScreen() {
    const router = useRouter();
    const { getMe } = useAuth();
    const { data: profile, isLoading: isLoadingProfile } = useMistriProfileQuery();
    const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateMistriProfile();
    const { activeServices } = useServices();

    // Form state
    const [fullName, setFullName] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [serviceId, setServiceId] = useState<number | null>(null);
    const [location, setLocation] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [fullNameError, setFullNameError] = useState<string>('');
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMapSelector, setShowMapSelector] = useState(false);
    const [optimisticAvailability, setOptimisticAvailability] = useState<'available' | 'on_work_available' | null>(null);

    // Image upload states
    const [isDetectingFace, setIsDetectingFace] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageUploadSuccess, setImageUploadSuccess] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 85, friction: 18, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        if (imageUploadSuccess) {
            Animated.sequence([
                Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.delay(2000),
                Animated.timing(successOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => setImageUploadSuccess(false));
        }
    }, [imageUploadSuccess]);

    const getAccentColor = () => {
        const s = activeServices.find(svc => svc.id === serviceId);
        return s?.color || '#6366f1';
    };

    useEffect(() => {
        if (profile) {
            setFullName(profile.fullName || '');
            setServiceId(profile.serviceId || null);
            setBio(profile.bio || '');
            setLocation(profile.currentLocation || '');
            if (profile.profilePhotoUrl) setImageUri(profile.profilePhotoUrl);
            if (profile.currentLocation) {
                try {
                    const coords = profile.currentLocation.split(',');
                    if (coords.length === 2) {
                        const lat = parseFloat(coords[0]);
                        const lng = parseFloat(coords[1]);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            setMarkerPosition({ latitude: lat, longitude: lng });
                        }
                    }
                } catch { /* noop */ }
            }
        }
    }, [profile]);

    // ── Camera with Face Detection + Auto-Update ──
const takeProfilePhoto = async () => {
    if (isDetectingFace || isUploadingImage) return;

    try {
        if (process.env.EXPO_OS !== 'web') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is needed to take your profile photo.');
                return;
            }
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
            base64: false,
            cameraType: ImagePicker.CameraType.front,
        });

        if (result.canceled || result.assets.length === 0) return;
        const asset = result.assets[0];

        // Face detection wrapper
        setIsDetectingFace(true);
        let faceDetected = false;
        
        try {
            // Dynamically require the module to avoid crashing on start if it's missing
            const FaceDetector = require('expo-face-detector');
            
            const faces = await FaceDetector.detectFacesAsync(asset.uri, {
                mode: 'fast',
                detectLandmarks: 'none',
                runClassifications: 'none',
            });
            faceDetected = faces.length > 0;
        } catch (nativeError) {
            // Fallback: If the native module doesn't exist (Expo Go), auto-approve the photo
            if (__DEV__) console.warn('ExpoFaceDetector native module missing. Bypassing face check.');
            faceDetected = true; 
        }
        setIsDetectingFace(false);

        if (!faceDetected) {
            Alert.alert('No Face Detected', 'Please take a clear photo with your face visible.', [
                { text: 'Retake', onPress: takeProfilePhoto },
                { text: 'Cancel', style: 'cancel' },
            ]);
            return;
        }

        // Compress & auto-upload logic continues normally...
        const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        setImageUri(manipulated.uri);
        setIsUploadingImage(true);

        await updateProfile({ profilePhotoBase64: manipulated.base64 });
        getMe().catch(() => {});

        setIsUploadingImage(false);
        setImageUploadSuccess(true);

    } catch (error: any) {
        setIsDetectingFace(false);
        setIsUploadingImage(false);
        if (__DEV__) console.error('Photo error:', error);
        Alert.alert('Error', error.message || 'Failed to process photo.');
    }
};
    const handleMapLocationConfirm = (coords: { latitude: number; longitude: number }) => {
        setMarkerPosition(coords);
        setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
    };

    // ── Save profile details (image saved separately) ──
    const handleSave = async () => {
        // Validation
        const errors: string[] = [];
        if (!fullName.trim()) {
            setFullNameError('Full name is required');
            errors.push('full name');
        }
        if (!serviceId) errors.push('service type');
        if (!markerPosition || !location) errors.push('service location');

        if (errors.length > 0) {
            Alert.alert('Missing Information', `Please provide your ${errors.join(', ')}.`);
            return;
        }

        try {
            await updateProfile({
                fullName: fullName.trim(),
                serviceId,
                currentLocation: location,
                bio: bio.trim(),
            });
            getMe().catch(() => {});
            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error: any) {
            if (__DEV__) console.error('Profile update error', error);
            Alert.alert('Error', error.message || 'Failed to update profile.');
        }
    };

    const updateAvailability = async (status: 'available' | 'on_work_available') => {
        setOptimisticAvailability(status);
        try {
            await updateProfile({ availabilityStatus: status });
            setOptimisticAvailability(null);
        } catch (error: any) {
            setOptimisticAvailability(null);
            Alert.alert('Error', error.message || 'Failed to update status');
        }
    };

    const currentAvailability = optimisticAvailability || profile?.availabilityStatus || 'available';
    const accentColor = getAccentColor();
    const currentStatusOption = AVAILABILITY_OPTIONS.find(o => o.key === currentAvailability) || AVAILABILITY_OPTIONS[0];

    if (isLoadingProfile) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Edit Profile" variant="mistri" />
                <View style={S.loadingWrap}>
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={S.loadingText}>Loading profile…</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    const serviceName = activeServices.find(s => s.id === serviceId)?.displayName
        || profile?.serviceName?.charAt(0).toUpperCase() + (profile?.serviceName?.slice(1) || '')
        || 'Service Provider';

    // Avatar overlay state
    const avatarState = isDetectingFace ? 'scanning'
        : isUploadingImage ? 'uploading'
            : imageUploadSuccess ? 'success'
                : null;

    return (
        <SafeAreaContainer>

            <KeyboardAvoidingView
                style={S.keyboardWrap}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={S.scroll}
                    contentContainerStyle={S.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ═══ AVATAR SECTION ═══ */}
                    <Animated.View style={[S.avatarSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <TouchableOpacity
                            onPress={takeProfilePhoto}
                            activeOpacity={0.9}
                            disabled={isDetectingFace || isUploadingImage}
                            style={S.avatarTouchable}
                        >
                            {imageUri ? (
                                <Image
                                    source={{ uri: imageUri }}
                                    style={S.avatar}
                                    contentFit="cover"
                                    transition={250}
                                />
                            ) : (
                                <View style={[S.avatar, S.avatarPlaceholder]}>
                                    <MaterialIcons name="person" size={56} color={DC.muted} />
                                </View>
                            )}

                            {/* Camera badge */}
                            {!avatarState && (
                                <View style={S.cameraBadge}>
                                    <MaterialIcons name="camera-alt" size={18} color="#ffffff" />
                                </View>
                            )}

                            {/* Scanning overlay */}
                            {avatarState === 'scanning' && (
                                <View style={S.avatarOverlay}>
                                    <ActivityIndicator size="small" color="#ffffff" />
                                    <Text style={S.overlayText}>Scanning…</Text>
                                </View>
                            )}

                            {/* Uploading overlay */}
                            {avatarState === 'uploading' && (
                                <View style={S.avatarOverlay}>
                                    <ActivityIndicator size="small" color="#ffffff" />
                                    <Text style={S.overlayText}>Saving…</Text>
                                </View>
                            )}

                            {/* Success overlay */}
                            {avatarState === 'success' && (
                                <Animated.View style={[S.avatarOverlay, S.successOverlay, { opacity: successOpacity }]}>
                                    <View style={S.successCircle}>
                                        <Ionicons name="checkmark" size={36} color="#ffffff" />
                                    </View>
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                        <Text style={S.avatarHint}>Tap to take a new photo</Text>
                    </Animated.View>

                    {/* ═══ AVAILABILITY CARD ═══ */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <View style={S.cardTitleRow}>
                                    <View style={[S.titleAccent, { backgroundColor: accentColor }]} />
                                    <Text style={S.cardTitle}>AVAILABILITY STATUS</Text>
                                </View>
                            </View>

                            <View style={[S.statusBanner, { backgroundColor: currentStatusOption.dimColor }]}>
                                <View style={[S.statusIconCircle, { backgroundColor: currentStatusOption.color }]}>
                                    <Ionicons name={currentStatusOption.icon} size={22} color="#ffffff" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[S.statusTitle, { color: currentStatusOption.color }]}>
                                        {currentStatusOption.label}
                                    </Text>
                                    <Text style={S.statusSub}>Tap to change your status</Text>
                                </View>
                            </View>

                            <View style={S.statusPills}>
                                {AVAILABILITY_OPTIONS.map(opt => {
                                    const active = currentAvailability === opt.key;
                                    return (
                                        <TouchableOpacity
                                            key={opt.key}
                                            onPress={() => updateAvailability(opt.key)}
                                            activeOpacity={0.7}
                                            style={[
                                                S.pill,
                                                active && { backgroundColor: `${opt.color}12`, borderColor: opt.color, borderWidth: 2 },
                                            ]}
                                        >
                                            <Ionicons name={opt.icon} size={22} color={active ? opt.color : '#94a3b8'} />
                                            <Text style={[S.pillText, { color: active ? opt.color : '#94a3b8' }]}>
                                                {opt.shortLabel}
                                            </Text>
                                            {active && <View style={[S.pillDot, { backgroundColor: opt.color }]} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </Animated.View>

                    {/* ═══ PERSONAL INFO CARD ═══ */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <View style={S.cardTitleRow}>
                                    <View style={[S.titleAccent, { backgroundColor: accentColor }]} />
                                    <Text style={S.cardTitle}>PERSONAL INFORMATION</Text>
                                </View>
                            </View>

                            <View style={S.cardBody}>
                                {/* Full Name */}
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>FULL NAME *</Text>
                                    <TextInput
                                        placeholder="Enter your full name"
                                        value={fullName}
                                        onChangeText={text => {
                                            setFullName(text);
                                            if (text.trim()) setFullNameError('');
                                        }}
                                        style={[S.fieldInput, fullNameError && S.fieldInputErr]}
                                        placeholderTextColor={DC.muted}
                                        autoCapitalize="words"
                                    />
                                    {fullNameError ? <Text style={S.errText}>{fullNameError}</Text> : null}
                                </View>

                                {/* Bio */}
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>ABOUT ME</Text>
                                    <TextInput
                                        placeholder="Describe your skills, experience and expertise…"
                                        value={bio}
                                        onChangeText={setBio}
                                        multiline
                                        numberOfLines={4}
                                        style={S.textArea}
                                        placeholderTextColor={DC.muted}
                                    />
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* ═══ SERVICE CARD ═══ */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <View style={S.cardTitleRow}>
                                    <View style={[S.titleAccent, { backgroundColor: accentColor }]} />
                                    <Text style={S.cardTitle}>SERVICE DETAILS</Text>
                                </View>
                            </View>

                            <View style={S.cardBody}>
                                {/* Service Type */}
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>SERVICE TYPE *</Text>
                                    <View style={S.chipRow}>
                                        {activeServices.map(svc => {
                                            const sel = serviceId === svc.id;
                                            return (
                                                <TouchableOpacity
                                                    key={svc.id}
                                                    onPress={() => setServiceId(svc.id)}
                                                    style={[
                                                        S.chip,
                                                        sel && { backgroundColor: `${svc.color}12`, borderColor: svc.color, borderWidth: 2 },
                                                    ]}
                                                >
                                                    <Ionicons name={svc.icon} size={18} color={sel ? svc.color : '#94a3b8'} />
                                                    <Text style={[S.chipText, { color: sel ? svc.color : DC.muted }]}>
                                                        {svc.displayName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Location */}
                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>SERVICE LOCATION *</Text>
                                    {markerPosition ? (
                                        <View style={S.locBox}>
                                            <MaterialIcons name="location-on" size={22} color={accentColor} />
                                            <Text style={S.locCoords} selectable>
                                                {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => setShowMapSelector(true)}
                                                style={[S.locChangeBtn, { backgroundColor: accentColor }]}
                                            >
                                                <Text style={S.locChangeBtnText}>Change</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity onPress={() => setShowMapSelector(true)} style={S.locSetBtn}>
                                            <MaterialIcons name="add-location" size={22} color={accentColor} />
                                            <Text style={S.locSetBtnText}>Set Service Location on Map</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* ═══ SAVE BUTTON ═══ */}
                    <Animated.View style={[S.saveWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isUpdating}
                            style={[S.saveBtn, { backgroundColor: accentColor }, isUpdating && S.saveBtnDisabled]}
                            activeOpacity={0.8}
                        >
                            {isUpdating ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <MaterialIcons name="save" size={20} color="#ffffff" />
                                    <Text style={S.saveBtnText}>Save Profile</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={{ height: 32 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <ExpandableMapSelector
                visible={showMapSelector}
                onClose={() => setShowMapSelector(false)}
                onConfirm={handleMapLocationConfirm}
                initialLocation={markerPosition}
                accentColor={accentColor}
            />
        </SafeAreaContainer>
    );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const S = StyleSheet.create({
    // ── Loading ──
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: DC.canvas,
    },
    loadingText: {
        fontSize: 14,
        color: DC.muted,
        fontWeight: '500',
    },

    // ── Root ──
    keyboardWrap: { flex: 1, backgroundColor: DC.canvas },
    scroll: { flex: 1, backgroundColor: DC.canvas },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },

    // ── Avatar Section ──
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 20,
        marginBottom: 8,
    },
    avatarTouchable: { position: 'relative' },
    avatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 4,
        borderColor: '#ffffff',
        boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
    },
    avatarPlaceholder: {
        backgroundColor: DC.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 3,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 55,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    successOverlay: { backgroundColor: 'rgba(16,185,129,0.7)' },
    successCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlayText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    avatarHint: {
        marginTop: 12,
        fontSize: 13,
        color: DC.muted,
        fontWeight: '500',
    },

    // ── Card ──
    cardWrap: { marginBottom: 14 },
    card: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        overflow: 'hidden',
        boxShadow: MISTRI_ELEV.card,
    },
    cardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    titleAccent: {
        width: 3,
        height: 14,
        borderRadius: 2,
    },
    cardTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: DC.muted,
        letterSpacing: 0.8,
    },
    cardBody: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },

    // ── Status ──
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 12,
        marginBottom: 14,
    },
    statusIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 1,
    },
    statusSub: {
        fontSize: 12,
        color: DC.muted,
    },
    statusPills: {
        flexDirection: 'row',
        gap: 10,
    },
    pill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: DC.surfaceMuted,
        borderWidth: 1.5,
        borderColor: 'transparent',
        gap: 6,
        position: 'relative',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    pillDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 7,
        height: 7,
        borderRadius: 4,
    },

    // ── Fields ──
    field: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: DC.muted,
        letterSpacing: 0.7,
        marginBottom: 8,
    },
    fieldInput: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        color: DC.text,
        backgroundColor: DC.surfaceMuted,
    },
    fieldInputErr: {
        borderColor: '#ef4444',
    },
    errText: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 5,
        fontWeight: '500',
    },
    textArea: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        borderCurve: 'continuous',
        padding: 14,
        fontSize: 15,
        color: DC.text,
        backgroundColor: DC.surfaceMuted,
        minHeight: 100,
        textAlignVertical: 'top',
    },

    // ── Chips ──
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderRadius: 10,
        borderCurve: 'continuous',
        borderColor: '#e2e8f0',
        backgroundColor: DC.surfaceMuted,
        gap: 7,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // ── Location ──
    locBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: DC.surfaceMuted,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
    },
    locCoords: {
        flex: 1,
        fontSize: 13,
        color: DC.text,
        fontFamily: 'monospace',
    },
    locChangeBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        borderCurve: 'continuous',
    },
    locChangeBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    locSetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#6366f1',
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: '#f5f3ff',
        gap: 10,
    },
    locSetBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366f1',
    },

    // ── Save Button ──
    saveWrap: {
        marginTop: 8,
        marginBottom: 8,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        borderCurve: 'continuous',
        gap: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});