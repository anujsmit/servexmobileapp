import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useMistriProfileQuery, useUpdateMistriProfile } from '../../../hooks/queries';
import { useAuth } from '../../../context/AuthContext';
import { ExpandableMapSelector } from '../../../components/ExpandableMapSelector';
import { useServices } from '../../../context/ServicesContext';
import { useRouter, useNavigation } from 'expo-router';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { PageTitle } from '../../../components/PageTitle';
import { CustomCamera } from '../../../components/CustomCamera';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const AVAILABILITY_OPTIONS: {
    key: 'available' | 'on_work_available';
    label: string;
    shortLabel: string;
    icon: IoniconName;
    color: string;
    dimColor: string;
}[] = [
    { key: 'available', label: 'Available Now', shortLabel: 'Available', icon: 'checkmark-circle', color: '#22c55e', dimColor: '#dcfce7' },
    { key: 'on_work_available', label: 'Currently on Work', shortLabel: 'On Work', icon: 'time', color: '#f59e0b', dimColor: '#fef3c7' },
];

const COLORS = {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryBg: '#eff6ff',
    white: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    border: '#e2e8f0',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    error: '#ef4444',
    success: '#22c55e',
};

export default function EditProfileScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const { getMe } = useAuth();
    const { data: profile, isLoading: isLoadingProfile } = useMistriProfileQuery();
    const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateMistriProfile();
    const { activeServices } = useServices();

    // Form state
    const [fullName, setFullName] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [serviceId, setServiceId] = useState<number | null>(null);
    const [location, setLocation] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [fullNameError, setFullNameError] = useState<string>('');
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMapSelector, setShowMapSelector] = useState(false);
    const [optimisticAvailability, setOptimisticAvailability] = useState<'available' | 'on_work_available' | null>(null);

    // Camera states
    const [cameraVisible, setCameraVisible] = useState(false);

    // Image upload states
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageUploadSuccess, setImageUploadSuccess] = useState(false);

    // Original values for change detection
    const originalValues = useRef<{
        fullName: string;
        serviceId: number | null;
        location: string;
        bio: string;
        imageUri: string | null;
        markerPosition: { latitude: number; longitude: number } | null;
        availabilityStatus: string;
    } | null>(null);

    // Block navigation ref
    const isNavigatingBack = useRef(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;
    const saveButtonScale = useRef(new Animated.Value(1)).current;
    const bottomBarSlide = useRef(new Animated.Value(100)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 85, friction: 18, useNativeDriver: true }),
            Animated.spring(bottomBarSlide, { toValue: 0, tension: 80, friction: 12, delay: 200, useNativeDriver: true }),
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

    // Check for unsaved changes
    const hasUnsavedChanges = useCallback(() => {
        if (!originalValues.current) return false;
        const orig = originalValues.current;
        
        const nameChanged = fullName.trim() !== orig.fullName.trim();
        const serviceChanged = serviceId !== orig.serviceId;
        const bioChanged = bio.trim() !== orig.bio.trim();
        const locationChanged = location !== orig.location;
        const imageChanged = imageUri !== orig.imageUri;
        const markerChanged = markerPosition?.latitude !== orig.markerPosition?.latitude || 
                            markerPosition?.longitude !== orig.markerPosition?.longitude;
        
        return nameChanged || serviceChanged || bioChanged || locationChanged || imageChanged || markerChanged;
    }, [fullName, serviceId, bio, location, imageUri, markerPosition]);

    // Store original values when profile loads
    useEffect(() => {
        if (profile) {
            setFullName(profile.fullName || '');
            setServiceId(profile.serviceId || null);
            setBio(profile.bio || '');
            setLocation(profile.currentLocation || '');
            if (profile.profilePhotoUrl) setImageUri(profile.profilePhotoUrl);

            let parsedMarker: { latitude: number; longitude: number } | null = null;
            if (profile.currentLocation) {
                try {
                    const coords = profile.currentLocation.split(',');
                    if (coords.length === 2) {
                        const lat = parseFloat(coords[0]);
                        const lng = parseFloat(coords[1]);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            parsedMarker = { latitude: lat, longitude: lng };
                            setMarkerPosition(parsedMarker);
                        }
                    }
                } catch { /* noop */ }
            }

            setTimeout(() => {
                originalValues.current = {
                    fullName: profile.fullName || '',
                    serviceId: profile.serviceId || null,
                    location: profile.currentLocation || '',
                    bio: profile.bio || '',
                    imageUri: profile.profilePhotoUrl || null,
                    markerPosition: parsedMarker,
                    availabilityStatus: profile.availabilityStatus || 'available',
                };
            }, 100);
        }
    }, [profile]);

    // Handle back navigation with unsaved changes check
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (isNavigatingBack.current) {
                isNavigatingBack.current = false;
                return;
            }

            if (showMapSelector || cameraVisible) return;

            if (hasUnsavedChanges()) {
                e.preventDefault();
                
                Alert.alert(
                    'Unsaved Changes',
                    'You have unsaved changes. Do you want to save before leaving?',
                    [
                        {
                            text: "Don't Save",
                            style: 'destructive',
                            onPress: () => {
                                isNavigatingBack.current = true;
                                navigation.dispatch(e.data.action);
                            },
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        },
                        {
                            text: 'Save',
                            style: 'default',
                            onPress: async () => {
                                const errors: string[] = [];
                                if (!fullName.trim()) errors.push('full name');
                                if (!serviceId) errors.push('service type');
                                if (!markerPosition || !location) errors.push('service location');

                                if (errors.length > 0) {
                                    Alert.alert(
                                        'Missing Information',
                                        `Cannot save. Please provide your ${errors.join(', ')}.`,
                                        [
                                            {
                                                text: "Leave Anyway",
                                                style: 'destructive',
                                                onPress: () => {
                                                    isNavigatingBack.current = true;
                                                    navigation.dispatch(e.data.action);
                                                },
                                            },
                                            { text: 'Stay and Edit', style: 'cancel' },
                                        ]
                                    );
                                    return;
                                }

                                try {
                                    await updateProfile({
                                        fullName: fullName.trim(),
                                        serviceId,
                                        currentLocation: location,
                                        bio: bio.trim(),
                                    });
                                    await getMe();
                                    isNavigatingBack.current = true;
                                    navigation.dispatch(e.data.action);
                                } catch (error: any) {
                                    if (__DEV__) console.error('Profile update error', error);
                                    Alert.alert('Error', error.message || 'Failed to save profile.');
                                }
                            },
                        },
                    ]
                );
            }
        });

        return unsubscribe;
    }, [navigation, hasUnsavedChanges, fullName, serviceId, location, bio, markerPosition, showMapSelector, cameraVisible, updateProfile, getMe]);

    // Camera handlers
    const handleCameraOpen = () => {
        setCameraVisible(true);
    };

    const handleCameraCapture = async (uri: string, base64: string) => {
        try {
            setIsUploadingImage(true);
            
            // Set the image URI and base64
            setImageUri(uri);
            setImageBase64(base64);
            
            // Upload the photo
            await updateProfile({ profilePhotoBase64: base64 });
            await getMe();
            
            setIsUploadingImage(false);
            setImageUploadSuccess(true);
            
        } catch (error: any) {
            setIsUploadingImage(false);
            if (__DEV__) console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload photo.');
        }
    };

    const handleCameraClose = () => {
        setCameraVisible(false);
    };


    const processImage = async (asset: any) => {
        try {
            setIsUploadingImage(true);

            const manipulated = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            setImageUri(manipulated.uri);
            setImageBase64(manipulated.base64 || '');

            await updateProfile({ profilePhotoBase64: manipulated.base64 });
            await getMe();

            setIsUploadingImage(false);
            setImageUploadSuccess(true);

        } catch (error: any) {
            setIsUploadingImage(false);
            if (__DEV__) console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload photo.');
        }
    };

    const handlePhotoOptions = () => {
        Alert.alert(
            'Profile Photo',
            'Choose an option',
            [
                { 
                    text: 'Take Photo', 
                    onPress: handleCameraOpen
                },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    const handleMapLocationConfirm = (coords: { latitude: number; longitude: number }) => {
        setMarkerPosition(coords);
        setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
    };

    const handleSave = async () => {
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
            await getMe();
            isNavigatingBack.current = true;
            router.back();
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

    const handleSaveButtonPressIn = () => {
        Animated.spring(saveButtonScale, {
            toValue: 0.96,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const handleSaveButtonPressOut = () => {
        Animated.spring(saveButtonScale, {
            toValue: 1,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const handleDiscard = () => {
        if (hasUnsavedChanges()) {
            Alert.alert(
                'Discard Changes?',
                'All your unsaved changes will be lost.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                            isNavigatingBack.current = true;
                            router.back();
                        },
                    },
                ]
            );
        } else {
            isNavigatingBack.current = true;
            router.back();
        }
    };

    const currentAvailability = optimisticAvailability || profile?.availabilityStatus || 'available';
    const currentStatusOption = AVAILABILITY_OPTIONS.find(o => o.key === currentAvailability) || AVAILABILITY_OPTIONS[0];
    const hasChanges = hasUnsavedChanges();

    if (isLoadingProfile) {
        return (
            <SafeAreaContainer>
                <PageTitle title="Edit Profile" variant="mistri" />
                <View style={S.loadingWrap}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={S.loadingText}>Loading profile…</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    const avatarState = isUploadingImage ? 'uploading'
        : imageUploadSuccess ? 'success'
        : null;

    return (
        <SafeAreaContainer>
            <StatusBar style="dark" />
            <KeyboardAvoidingView
                style={S.keyboardWrap}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    style={S.scroll}
                    contentContainerStyle={S.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Avatar Section */}
                    <Animated.View style={[S.avatarSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <TouchableOpacity
                            onPress={handlePhotoOptions}
                            activeOpacity={0.9}
                            disabled={isUploadingImage}
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
                                    <MaterialIcons name="person" size={56} color={COLORS.textMuted} />
                                </View>
                            )}

                            {!avatarState && (
                                <View style={[S.cameraBadge, { backgroundColor: COLORS.primary }]}>
                                    <MaterialIcons name="camera-alt" size={18} color={COLORS.white} />
                                </View>
                            )}

                            {avatarState === 'uploading' && (
                                <View style={S.avatarOverlay}>
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                    <Text style={S.overlayText}>Uploading…</Text>
                                </View>
                            )}

                            {avatarState === 'success' && (
                                <Animated.View style={[S.avatarOverlay, S.successOverlay, { opacity: successOpacity }]}>
                                    <View style={S.successCircle}>
                                        <Ionicons name="checkmark" size={36} color={COLORS.white} />
                                    </View>
                                </Animated.View>
                            )}
                        </TouchableOpacity>
                        <Text style={S.avatarHint}>Tap to change photo</Text>
                    </Animated.View>

                    {/* Availability Card */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <Text style={S.cardTitle}>AVAILABILITY STATUS</Text>
                            </View>

                            <View style={S.cardBody}>
                                <View style={[S.statusBanner, { backgroundColor: currentStatusOption.dimColor }]}>
                                    <View style={[S.statusIconCircle, { backgroundColor: currentStatusOption.color }]}>
                                        <Ionicons name={currentStatusOption.icon} size={22} color={COLORS.white} />
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
                                                    active && { 
                                                        backgroundColor: `${opt.color}15`, 
                                                        borderColor: opt.color, 
                                                        borderWidth: 2 
                                                    },
                                                ]}
                                            >
                                                <Ionicons 
                                                    name={opt.icon} 
                                                    size={22} 
                                                    color={active ? opt.color : COLORS.textMuted} 
                                                />
                                                <Text style={[S.pillText, { color: active ? opt.color : COLORS.textMuted }]}>
                                                    {opt.shortLabel}
                                                </Text>
                                                {active && <View style={[S.pillDot, { backgroundColor: opt.color }]} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Personal Info Card */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <Text style={S.cardTitle}>PERSONAL INFORMATION</Text>
                            </View>

                            <View style={S.cardBody}>
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
                                        placeholderTextColor={COLORS.textMuted}
                                        autoCapitalize="words"
                                    />
                                    {fullNameError ? <Text style={S.errText}>{fullNameError}</Text> : null}
                                </View>

                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>ABOUT ME</Text>
                                    <TextInput
                                        placeholder="Describe your skills, experience and expertise…"
                                        value={bio}
                                        onChangeText={setBio}
                                        multiline
                                        numberOfLines={4}
                                        style={S.textArea}
                                        placeholderTextColor={COLORS.textMuted}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Service Card */}
                    <Animated.View style={[S.cardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={S.card}>
                            <View style={S.cardHead}>
                                <Text style={S.cardTitle}>SERVICE DETAILS</Text>
                            </View>

                            <View style={S.cardBody}>
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
                                                        sel && { 
                                                            backgroundColor: `${COLORS.primary}15`, 
                                                            borderColor: COLORS.primary, 
                                                            borderWidth: 2 
                                                        },
                                                    ]}
                                                >
                                                    <Ionicons 
                                                        name={svc.icon} 
                                                        size={18} 
                                                        color={sel ? COLORS.primary : COLORS.textMuted} 
                                                    />
                                                    <Text style={[S.chipText, { color: sel ? COLORS.primary : COLORS.textMuted }]}>
                                                        {svc.displayName}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={S.field}>
                                    <Text style={S.fieldLabel}>SERVICE LOCATION *</Text>
                                    {markerPosition ? (
                                        <View style={S.locBox}>
                                            <MaterialIcons name="location-on" size={22} color={COLORS.primary} />
                                            <Text style={S.locCoords} selectable>
                                                {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => setShowMapSelector(true)}
                                                style={[S.locChangeBtn, { backgroundColor: COLORS.primary }]}
                                            >
                                                <Text style={S.locChangeBtnText}>Change</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity 
                                            onPress={() => setShowMapSelector(true)} 
                                            style={[S.locSetBtn, { borderColor: COLORS.primary }]}
                                        >
                                            <MaterialIcons name="add-location" size={22} color={COLORS.primary} />
                                            <Text style={[S.locSetBtnText, { color: COLORS.primary }]}>Set Service Location on Map</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </Animated.View>

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* Bottom Bar */}
                <Animated.View 
                    style={[
                        S.bottomBar,
                        { transform: [{ translateY: bottomBarSlide }] }
                    ]}
                >
                    <View style={S.bottomBarInner}>
                        {hasChanges && (
                            <View style={S.unsavedIndicator}>
                                <View style={S.unsavedDot} />
                                <Text style={S.unsavedText}>Unsaved changes</Text>
                            </View>
                        )}

                        <View style={S.bottomBarButtons}>
                            <Pressable
                                onPress={handleDiscard}
                                style={S.discardBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="close" size={22} color={COLORS.textSecondary} />
                            </Pressable>

                            <Pressable
                                onPress={handleSave}
                                disabled={isUpdating}
                                onPressIn={handleSaveButtonPressIn}
                                onPressOut={handleSaveButtonPressOut}
                                style={{ flex: 1 }}
                            >
                                <Animated.View style={[
                                    S.saveBtnOuter,
                                    { 
                                        transform: [{ scale: saveButtonScale }],
                                    },
                                    isUpdating && S.saveBtnDisabled
                                ]}>
                                    <View style={[S.saveBtnGradient, { backgroundColor: COLORS.primary }]}>
                                        {isUpdating ? (
                                            <ActivityIndicator size="small" color={COLORS.white} />
                                        ) : (
                                            <View style={S.saveBtnContent}>
                                                <View style={S.saveBtnIconWrap}>
                                                    <MaterialIcons name="check" size={20} color={COLORS.white} />
                                                </View>
                                                <Text style={S.saveBtnText}>Save Changes</Text>
                                                {hasChanges && (
                                                    <View style={S.changesBadge}>
                                                        <Text style={S.changesBadgeText}>!</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </Animated.View>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>

            <ExpandableMapSelector
                visible={showMapSelector}
                onClose={() => setShowMapSelector(false)}
                onConfirm={handleMapLocationConfirm}
                initialLocation={markerPosition}
                accentColor={COLORS.primary}
            />

            {/* Custom Camera */}
            <CustomCamera
                visible={cameraVisible}
                onClose={handleCameraClose}
                onCapture={handleCameraCapture}
                accentColor={COLORS.primary}
            />
        </SafeAreaContainer>
    );
}

const S = StyleSheet.create({
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.background,
    },
    loadingText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    keyboardWrap: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    scroll: { 
        flex: 1, 
        backgroundColor: COLORS.background 
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 12,
    },
    avatarTouchable: { 
        position: 'relative' 
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: COLORS.white,
        backgroundColor: COLORS.surfaceMuted,
    },
    avatarPlaceholder: {
        backgroundColor: COLORS.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 3,
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 60,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    successOverlay: { 
        backgroundColor: 'rgba(34,197,94,0.7)' 
    },
    successCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlayText: { 
        color: COLORS.white, 
        fontSize: 12, 
        fontWeight: '700' 
    },
    avatarHint: {
        marginTop: 14,
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    cardWrap: { 
        marginBottom: 16 
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHead: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
    },
    cardTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 0.8,
    },
    cardBody: {
        paddingHorizontal: 18,
        paddingBottom: 18,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 14,
        marginBottom: 16,
    },
    statusIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    statusSub: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    statusPills: {
        flexDirection: 'row',
        gap: 12,
    },
    pill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceMuted,
        borderWidth: 1.5,
        borderColor: 'transparent',
        gap: 8,
        position: 'relative',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '700',
    },
    pillDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    field: {
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 0.7,
        marginBottom: 8,
    },
    fieldInput: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: COLORS.text,
        backgroundColor: COLORS.surfaceMuted,
    },
    fieldInputErr: {
        borderColor: COLORS.error,
    },
    errText: {
        color: COLORS.error,
        fontSize: 12,
        marginTop: 5,
        fontWeight: '500',
    },
    textArea: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 14,
        padding: 16,
        fontSize: 15,
        color: COLORS.text,
        backgroundColor: COLORS.surfaceMuted,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderRadius: 12,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceMuted,
        gap: 8,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    locBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceMuted,
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    locCoords: {
        flex: 1,
        fontSize: 13,
        color: COLORS.text,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    locChangeBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    locChangeBtnText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: '700',
    },
    locSetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderRadius: 14,
        gap: 10,
        backgroundColor: COLORS.primaryBg,
    },
    locSetBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 8,
    },
    bottomBarInner: {
        gap: 8,
    },
    unsavedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    unsavedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#f59e0b',
    },
    unsavedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#f59e0b',
        letterSpacing: 0.3,
    },
    bottomBarButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    discardBtn: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceMuted,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnOuter: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 6,
    },
    saveBtnDisabled: {
        opacity: 0.8,
        shadowOpacity: 0.2,
    },
    saveBtnGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    saveBtnIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    changesBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    changesBadgeText: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: '800',
    },
});