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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useMistriProfileQuery, useUpdateMistriProfile } from '../../../hooks/queries';
import { useAuth } from '../../../context/AuthContext';
import { ExpandableMapSelector } from '../../../components/ExpandableMapSelector';
import { useServices } from '../../../context/ServicesContext';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const AVAILABILITY_OPTIONS: {
    key: 'available' | 'unavailable' | 'on_work_available';
    label: string;
    shortLabel: string;
    icon: IoniconName;
    color: string;
    dimColor: string;
}[] = [
        { key: 'available', label: 'Available', shortLabel: 'Available', icon: 'checkmark-circle', color: '#10b981', dimColor: '#d1fae5' },
        { key: 'on_work_available', label: 'On Work', shortLabel: 'On Work', icon: 'time', color: '#f59e0b', dimColor: '#fef3c7' },
        { key: 'unavailable', label: 'Unavailable', shortLabel: 'Off', icon: 'moon', color: '#6b7280', dimColor: '#f3f4f6' },
    ];

export default function EditProfileScreen() {
    const router = useRouter();
    const { getMe } = useAuth();
    const { data: profile, isLoading: isLoadingProfile } = useMistriProfileQuery();
    const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateMistriProfile();
    const { activeServices } = useServices();

    const [fullName, setFullName] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [serviceId, setServiceId] = useState<number | null>(null);
    const [location, setLocation] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [fullNameError, setFullNameError] = useState<string>('');
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showMapSelector, setShowMapSelector] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [optimisticAvailability, setOptimisticAvailability] = useState<'available' | 'unavailable' | 'on_work_available' | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 18, useNativeDriver: true }),
        ]).start();
    }, []);

    const getAccentColor = () => {
        const s = activeServices.find(svc => svc.id === serviceId);
        return s?.color || '#10b981';
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
                        if (!isNaN(lat) && !isNaN(lng)) setMarkerPosition({ latitude: lat, longitude: lng });
                    }
                } catch { }
            }
        }
    }, [profile]);

    useEffect(() => {
        (async () => {
            if (process.env.EXPO_OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') Alert.alert('Permission required', 'Permission to access photos is needed!');
            }
        })();
    }, []);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: false,
            });
            if (!result.canceled && result.assets.length > 0) {
                const asset = result.assets[0];
                const manipulatedImage = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [{ resize: { width: 800 } }],
                    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                setImageUri(manipulatedImage.uri);
                setImageBase64(manipulatedImage.base64 || null);
            }
        } catch (error) {
            if (__DEV__) console.error(error);
        }
    };

    const handleMapLocationConfirm = (coords: { latitude: number; longitude: number }) => {
        setMarkerPosition(coords);
        setLocation(`${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`);
    };


    const handleSave = async () => {
        if (!fullName.trim()) {
            setFullNameError('Full name is required');
            Alert.alert('Missing info', 'Please enter your full name.');
            return;
        }
        if (!serviceId) { Alert.alert('Missing info', 'Please select a service.'); return; }
        if (!markerPosition || !location) { Alert.alert('Missing info', 'Please set your service location on the map.'); return; }
        try {
            const updates: any = { fullName: fullName.trim(), serviceId, currentLocation: location, bio: bio.trim() };
            if (imageBase64) updates.profilePhotoBase64 = imageBase64;
            await updateProfile(updates);
            // Fire-and-forget — don't await; the mutation's onSuccess already
            // invalidates the mistriProfile query, so the UI refreshes regardless.
            getMe().catch(() => { });
            Alert.alert('Success', 'Profile updated successfully!');
            setIsEditingBio(false);
            setIsEditingProfile(false);
            setImageBase64(null);
        } catch (error: any) {
            if (__DEV__) console.error('Profile update error', error);
            Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
        }
    };

    const updateAvailability = async (status: 'available' | 'unavailable' | 'on_work_available') => {
        setOptimisticAvailability(status);
        try {
            await updateProfile({ availabilityStatus: status });
            setOptimisticAvailability(null);
        } catch (error: any) {
            setOptimisticAvailability(null);
            Alert.alert('Error', error.message || 'Failed to update status');
        }
    };

    const currentAvailability = optimisticAvailability || profile?.availabilityStatus || 'unavailable';
    const accentColor = getAccentColor();
    const currentStatusOption = AVAILABILITY_OPTIONS.find(o => o.key === currentAvailability) || AVAILABILITY_OPTIONS[2];

    if (isLoadingProfile) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <StatusBar style="dark" />
                <ActivityIndicator size="large" color={accentColor} />
                <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>Loading profile…</Text>
            </View>
        );
    }

    const serviceName = activeServices.find(s => s.id === serviceId)?.displayName
        || profile?.serviceName?.charAt(0).toUpperCase() + (profile?.serviceName?.slice(1) || '')
        || 'Service Provider';

    const avgRating = profile?.averageRating != null && Number(profile.averageRating) > 0
        ? Number(profile.averageRating).toFixed(1)
        : null;

    return (
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <ScrollView
                style={{ backgroundColor: '#fff' }}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 0 }}
            >
                {/* ── HERO ── */}
                <LinearGradient
                    colors={[DC.surface, DC.surfaceMuted]}
                    style={{ paddingTop: 24, paddingBottom: 80, paddingHorizontal: 24, alignItems: 'center' }}
                >
                    {/* Avatar */}
                    <TouchableOpacity
                        onPress={pickImage}
                        activeOpacity={0.85}
                        style={{ marginBottom: 18, position: 'relative' }}
                    >
                        {imageUri ? (
                            <Image
                                source={{ uri: imageUri }}
                                style={{
                                    width: 108, height: 108, borderRadius: 54,
                                    borderWidth: 3, borderColor: accentColor,
                                }}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={{
                                width: 108, height: 108, borderRadius: 54,
                                backgroundColor: '#e2e8f0',
                                borderWidth: 3, borderColor: accentColor,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <MaterialIcons name="person" size={52} color="#94a3b8" />
                            </View>
                        )}
                        <View style={{
                            position: 'absolute', bottom: 2, right: 2,
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: accentColor,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: '#ffffff',
                        }}>
                            <MaterialIcons name="camera-alt" size={16} color="#ffffff" />
                        </View>
                    </TouchableOpacity>

                    {/* Name */}
                    <Text style={{ fontSize: 26, fontWeight: '800', color: DC.text, marginBottom: 6, textAlign: 'center' }}>
                        {profile?.fullName || 'Your Name'}
                    </Text>

                    {/* Service badge */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 14, paddingVertical: 6,
                        borderRadius: 20, borderCurve: 'continuous',
                        backgroundColor: `${accentColor}22`,
                        borderWidth: 1, borderColor: `${accentColor}55`,
                        marginBottom: 16,
                    }}>
                        <MaterialIcons name="verified" size={14} color={accentColor} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: accentColor }}>{serviceName}</Text>
                    </View>

                    {/* Rating + Jobs inline */}
                    <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => router.push('/(protected)/(mistri)/(tabs)/reviews')}
                            activeOpacity={0.75}
                            style={{ alignItems: 'center', gap: 3 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="star" size={16} color="#f59e0b" />
                                <Text style={{ fontSize: 22, fontWeight: '800', color: DC.text, fontVariant: ['tabular-nums'] }}>
                                    {avgRating ?? '–'}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 11, color: DC.muted, fontWeight: '500' }}>Rating</Text>
                        </TouchableOpacity>

                        <View style={{ width: 1, height: 32, backgroundColor: '#cbd5e1' }} />

                        <TouchableOpacity
                            onPress={() => router.push('/(protected)/(mistri)/(tabs)/my-jobs')}
                            activeOpacity={0.75}
                            style={{ alignItems: 'center', gap: 3 }}
                        >
                            <Text style={{ fontSize: 22, fontWeight: '800', color: DC.text, fontVariant: ['tabular-nums'] }}>
                                {profile?.jobsCompleted ?? 0}
                            </Text>
                            <Text style={{ fontSize: 11, color: DC.muted, fontWeight: '500' }}>Jobs Done</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* Body — light background wrapper so gaps between cards are #f1f5f9, not dark */}
                <View style={{ backgroundColor: DC.canvas, paddingBottom: 48 }}>

                    {/* ── STATUS CARD — overlapping hero ── */}
                    <Animated.View style={{
                        marginTop: -44,
                        marginHorizontal: 20,
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    }}>
                        <View style={{
                            backgroundColor: '#ffffff',
                            borderRadius: 20, borderCurve: 'continuous',
                            padding: 20,
                            boxShadow: MISTRI_ELEV.card,
                        }}>
                            {/* Current status banner */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 12,
                                padding: 14, borderRadius: 14, borderCurve: 'continuous',
                                backgroundColor: currentStatusOption.dimColor,
                                marginBottom: 16,
                            }}>
                                <Ionicons name={currentStatusOption.icon} size={26} color={currentStatusOption.color} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: currentStatusOption.color }}>
                                        {currentStatusOption.label}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                                        Tap below to change your status
                                    </Text>
                                </View>
                            </View>

                            {/* Selector pills */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {AVAILABILITY_OPTIONS.map(option => {
                                    const isActive = currentAvailability === option.key;
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            onPress={() => updateAvailability(option.key)}
                                            activeOpacity={0.7}
                                            style={{
                                                flex: 1, alignItems: 'center', paddingVertical: 12,
                                                borderRadius: 12, borderCurve: 'continuous',
                                                borderWidth: 1.5,
                                                borderColor: isActive ? option.color : '#e2e8f0',
                                                backgroundColor: isActive ? `${option.color}12` : '#f8fafc',
                                                gap: 5,
                                            }}
                                        >
                                            <Ionicons
                                                name={option.icon}
                                                size={22}
                                                color={isActive ? option.color : '#94a3b8'}
                                            />
                                            <Text style={{
                                                fontSize: 11, fontWeight: '700',
                                                color: isActive ? option.color : '#94a3b8',
                                            }}>
                                                {option.shortLabel}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </Animated.View>

                    {/* ── ABOUT ── */}
                    <Animated.View style={{
                        marginTop: 16, marginHorizontal: 20,
                        opacity: fadeAnim, transform: [{ translateY: slideAnim }],
                    }}>
                        <View style={{
                            backgroundColor: '#ffffff', borderRadius: 20, borderCurve: 'continuous',
                            overflow: 'hidden', boxShadow: MISTRI_ELEV.card,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accentColor }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 }}>ABOUT ME</Text>
                                </View>
                                {!isEditingBio && (
                                    <TouchableOpacity
                                        onPress={() => { setIsEditingBio(true); setIsEditingProfile(false); }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 4,
                                            paddingHorizontal: 10, paddingVertical: 5,
                                            borderRadius: 8, borderCurve: 'continuous',
                                            backgroundColor: `${accentColor}15`,
                                        }}
                                    >
                                        <MaterialIcons name="edit" size={14} color={accentColor} />
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: accentColor }}>Edit</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                                {isEditingBio ? (
                                    <>
                                        <TextInput
                                            placeholder="Describe your skills, experience and expertise…"
                                            value={bio}
                                            onChangeText={setBio}
                                            multiline
                                            numberOfLines={4}
                                            style={{
                                                borderWidth: 1.5, borderColor: '#e2e8f0',
                                                borderRadius: 12, borderCurve: 'continuous',
                                                padding: 14, fontSize: 14, color: '#0f172a',
                                                backgroundColor: '#f8fafc', minHeight: 110,
                                                textAlignVertical: 'top',
                                            }}
                                            placeholderTextColor="#94a3b8"
                                        />
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                                            <TouchableOpacity
                                                onPress={() => { if (profile) setBio(profile.bio || ''); setIsEditingBio(false); }}
                                                disabled={isUpdating}
                                                style={{
                                                    flex: 1, paddingVertical: 13, borderRadius: 12, borderCurve: 'continuous',
                                                    alignItems: 'center', backgroundColor: '#f1f5f9',
                                                    borderWidth: 1, borderColor: '#e2e8f0',
                                                }}
                                            >
                                                <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={handleSave}
                                                disabled={isUpdating}
                                                style={{
                                                    flex: 1, paddingVertical: 13, borderRadius: 12, borderCurve: 'continuous',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    backgroundColor: accentColor, flexDirection: 'row', gap: 6,
                                                }}
                                            >
                                                {isUpdating
                                                    ? <ActivityIndicator size="small" color="#ffffff" />
                                                    : <>
                                                        <MaterialIcons name="check" size={18} color="#ffffff" />
                                                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>Save</Text>
                                                    </>
                                                }
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                ) : (
                                    <Text style={{ fontSize: 14, color: bio ? '#374151' : '#94a3b8', lineHeight: 22 }}>
                                        {bio || 'No bio added yet. Share your skills and experience with customers.'}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* ── PROFILE DETAILS ── */}
                    <Animated.View style={{
                        marginTop: 16, marginHorizontal: 20,
                        opacity: fadeAnim, transform: [{ translateY: slideAnim }],
                    }}>
                        <View style={{
                            backgroundColor: '#ffffff', borderRadius: 20, borderCurve: 'continuous',
                            overflow: 'hidden', boxShadow: MISTRI_ELEV.card,
                        }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accentColor }} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.8 }}>PROFILE DETAILS</Text>
                                </View>
                                {!isEditingProfile && (
                                    <TouchableOpacity
                                        onPress={() => { setIsEditingProfile(true); setIsEditingBio(false); }}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 4,
                                            paddingHorizontal: 10, paddingVertical: 5,
                                            borderRadius: 8, borderCurve: 'continuous',
                                            backgroundColor: `${accentColor}15`,
                                        }}
                                    >
                                        <MaterialIcons name="edit" size={14} color={accentColor} />
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: accentColor }}>Edit</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 20 }}>
                                {/* Full Name */}
                                <View style={{ gap: 6 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 }}>FULL NAME</Text>
                                    {isEditingProfile ? (
                                        <>
                                            <TextInput
                                                placeholder="Enter your full name"
                                                value={fullName}
                                                onChangeText={text => { setFullName(text); if (text.trim()) setFullNameError(''); }}
                                                style={{
                                                    borderWidth: 1.5, borderColor: fullNameError ? '#ef4444' : '#e2e8f0',
                                                    borderRadius: 12, borderCurve: 'continuous',
                                                    paddingHorizontal: 14, paddingVertical: 12,
                                                    fontSize: 15, color: '#0f172a', backgroundColor: '#f8fafc',
                                                }}
                                                placeholderTextColor="#94a3b8"
                                            />
                                            {fullNameError ? (
                                                <Text style={{ color: '#ef4444', fontSize: 12 }}>{fullNameError}</Text>
                                            ) : null}
                                        </>
                                    ) : (
                                        <Text style={{ fontSize: 15, color: '#0f172a', fontWeight: '600' }} selectable>
                                            {fullName || 'Not set'}
                                        </Text>
                                    )}
                                </View>

                                {/* Service Type */}
                                <View style={{ gap: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 }}>SERVICE TYPE</Text>
                                    {isEditingProfile ? (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {activeServices.map(service => {
                                                const isSelected = serviceId === service.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={service.id}
                                                        onPress={() => setServiceId(service.id)}
                                                        style={{
                                                            flexDirection: 'row', alignItems: 'center',
                                                            paddingVertical: 9, paddingHorizontal: 14,
                                                            borderWidth: 1.5, borderRadius: 10, borderCurve: 'continuous',
                                                            borderColor: isSelected ? service.color : '#e2e8f0',
                                                            backgroundColor: isSelected ? `${service.color}12` : '#f8fafc',
                                                            gap: 6,
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name={service.icon}
                                                            size={18}
                                                            color={isSelected ? service.color : '#94a3b8'}
                                                        />
                                                        <Text style={{
                                                            fontSize: 13, fontWeight: isSelected ? '700' : '500',
                                                            color: isSelected ? service.color : '#64748b',
                                                        }}>
                                                            {service.displayName}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <MaterialIcons name="verified" size={16} color={accentColor} />
                                            <Text style={{ fontSize: 15, color: '#0f172a', fontWeight: '600' }}>
                                                {activeServices.find(s => s.id === serviceId)?.displayName || 'Not set'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Location (edit mode only) */}
                                {isEditingProfile && (
                                    <View style={{ gap: 8 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 }}>SERVICE LOCATION</Text>
                                        {markerPosition ? (
                                            <View style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 10,
                                                padding: 12, borderRadius: 12, borderCurve: 'continuous',
                                                backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
                                            }}>
                                                <MaterialIcons name="location-on" size={20} color={accentColor} />
                                                <Text style={{ flex: 1, fontSize: 12, color: '#475569', fontFamily: 'monospace' }} selectable>
                                                    {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => setShowMapSelector(true)}
                                                    style={{
                                                        paddingHorizontal: 12, paddingVertical: 6,
                                                        borderRadius: 8, borderCurve: 'continuous',
                                                        backgroundColor: accentColor,
                                                    }}
                                                >
                                                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>Change</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => setShowMapSelector(true)}
                                                style={{
                                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                                    padding: 14, borderWidth: 1.5, borderStyle: 'dashed',
                                                    borderColor: accentColor, borderRadius: 12, borderCurve: 'continuous',
                                                    backgroundColor: `${accentColor}08`, gap: 8,
                                                }}
                                            >
                                                <MaterialIcons name="add-location" size={20} color={accentColor} />
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: accentColor }}>Set Service Location</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {/* Save/Cancel for profile details */}
                                {isEditingProfile && (
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (profile) {
                                                    setFullName(profile.fullName || '');
                                                    setServiceId(profile.serviceId || null);
                                                    setBio(profile.bio || '');
                                                    setLocation(profile.currentLocation || '');
                                                    if (profile.currentLocation) {
                                                        try {
                                                            const coords = profile.currentLocation.split(',');
                                                            if (coords.length === 2) {
                                                                setMarkerPosition({
                                                                    latitude: parseFloat(coords[0]),
                                                                    longitude: parseFloat(coords[1])
                                                                });
                                                            }
                                                        } catch { }
                                                    }
                                                }
                                                setIsEditingProfile(false);
                                            }}
                                            disabled={isUpdating}
                                            style={{
                                                flex: 1, paddingVertical: 13, borderRadius: 12, borderCurve: 'continuous',
                                                alignItems: 'center', backgroundColor: '#f1f5f9',
                                                borderWidth: 1, borderColor: '#e2e8f0',
                                            }}
                                        >
                                            <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={handleSave}
                                            disabled={isUpdating}
                                            style={{
                                                flex: 1, paddingVertical: 13, borderRadius: 12, borderCurve: 'continuous',
                                                alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: accentColor, flexDirection: 'row', gap: 6,
                                            }}
                                        >
                                            {isUpdating
                                                ? <ActivityIndicator size="small" color="#ffffff" />
                                                : <>
                                                    <MaterialIcons name="check" size={18} color="#ffffff" />
                                                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>Save Changes</Text>
                                                </>
                                            }
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                </View>{/* end body wrapper */}
            </ScrollView>

            <ExpandableMapSelector
                visible={showMapSelector}
                onClose={() => setShowMapSelector(false)}
                onConfirm={handleMapLocationConfirm}
                initialLocation={markerPosition}
                accentColor={accentColor}
            />
        </View>
    );
}
