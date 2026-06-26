import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    Dimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../../../../context/AuthContext';
import { API_BASE_URL as API_URL } from '../../../../lib/config';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ExpandableMapSelector } from '../../../../components/ExpandableMapSelector';
import { useServices } from '../../../../context/ServicesContext';
import { ROUTES } from '../../../../lib/routes';
import { CustomCamera } from '../../../../components/CustomCamera';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ACCENT = '#179d2e';
const WINDOW_WIDTH = Dimensions.get('window').width;

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

const MistriOnboardingProfile = React.memo(() => {
    const router = useRouter();
    const { user, token, getMe, logout } = useAuth();
    const { services, loading: servicesLoading } = useServices();

    const [fullName, setFullName] = useState(user?.fullName || '');
    const [fullNameError, setFullNameError] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
    const [bio, setBio] = useState('');
    const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
    const [markerPosition, setMarkerPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [location, setLocation] = useState('');
    const [showMapSelector, setShowMapSelector] = useState(false);

    const [govtIdType, setGovtIdType] = useState<string | null>(null);
    const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
    const [idFrontBase64, setIdFrontBase64] = useState<string | null>(null);
    const [idBackUri, setIdBackUri] = useState<string | null>(null);
    const [idBackBase64, setIdBackBase64] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

    // Camera states
    const [cameraMode, setCameraMode] = useState<'profile' | 'idFront' | 'idBack' | null>(null);
    const [cameraVisible, setCameraVisible] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Calculate completion progress
    const completionProgress = useMemo(() => {
        const fields = [
            { completed: fullName.trim().length > 0, weight: 10 },
            { completed: !!imageUri && !!imageBase64, weight: 15 },
            { completed: selectedServiceIds.length > 0, weight: 20 },
            { completed: bio.trim().length > 0, weight: 15 },
            { completed: !!experienceLevel, weight: 10 },
            { completed: !!markerPosition && location.length > 0, weight: 15 },
            { completed: !!govtIdType && !!idFrontUri && !!idFrontBase64 && !!idBackUri && !!idBackBase64, weight: 15 },
        ];
        
        const totalWeight = fields.reduce((sum, field) => sum + field.weight, 0);
        const completedWeight = fields.reduce((sum, field) => sum + (field.completed ? field.weight : 0), 0);
        
        return Math.round((completedWeight / totalWeight) * 100);
    }, [fullName, imageUri, imageBase64, selectedServiceIds, bio, experienceLevel, markerPosition, location, govtIdType, idFrontUri, idFrontBase64, idBackUri, idBackBase64]);

    const SERVICE_OPTIONS = useMemo(() => {
        return services.map(service => {
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
    }, [services]);

    const currentServiceColor = useCallback(() => {
        if (selectedServiceIds.length > 0) {
            const primaryService = SERVICE_OPTIONS.find(s => s.id === selectedServiceIds[0]);
            return primaryService?.color || ACCENT;
        }
        return ACCENT;
    }, [selectedServiceIds, SERVICE_OPTIONS]);

    // Camera handlers
    const handleCameraOpen = (mode: 'profile' | 'idFront' | 'idBack') => {
        setCameraMode(mode);
        setCameraVisible(true);
    };

    const handleCameraCapture = (uri: string, base64: string) => {
        if (cameraMode === 'profile') {
            setImageUri(uri);
            setImageBase64(base64);
        } else if (cameraMode === 'idFront') {
            setIdFrontUri(uri);
            setIdFrontBase64(base64);
        } else if (cameraMode === 'idBack') {
            setIdBackUri(uri);
            setIdBackBase64(base64);
        }
    };

    const handleCameraClose = () => {
        setCameraVisible(false);
        setCameraMode(null);
    };

    const handleLogout = useCallback(async () => {
        try {
            setIsLoggingOut(true);
            await logout();
            router.replace('/login');
        } catch {
            Alert.alert('Error', 'Failed to log out. Please try again.');
        } finally {
            setIsLoggingOut(false);
        }
    }, [logout, router]);

    const isFormValid = useCallback(() => {
        return !!(fullName.trim() &&
            imageUri && imageBase64 &&
            selectedServiceIds.length > 0 &&
            bio.trim() &&
            experienceLevel &&
            markerPosition && location &&
            govtIdType &&
            idFrontUri && idFrontBase64 &&
            idBackUri && idBackBase64);
    }, [fullName, imageUri, imageBase64, selectedServiceIds, bio, experienceLevel, 
        markerPosition, location, govtIdType, idFrontUri, idFrontBase64, idBackUri, idBackBase64]);

    const handleContinue = useCallback(async () => {
        if (!isFormValid()) {
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
                try {
                    const errorData = JSON.parse(textResponse);
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                } catch (parseError) {
                    throw new Error(`Server error (${response.status}). Please check your connection and try again.`);
                }
            }

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
    }, [isFormValid, markerPosition, location, selectedServiceIds, imageBase64, fullName, bio, 
        experienceLevel, govtIdType, idFrontBase64, idBackBase64, token, getMe, router]);

    const renderIdPicker = useCallback((
        label: string,
        uri: string | null,
        onTakePhoto: () => void
    ) => (
        <TouchableOpacity 
            style={[
                styles.idPickerButton,
                uri && styles.idPickerButtonCompleted
            ]} 
            onPress={onTakePhoto} 
            activeOpacity={0.8}
            disabled={isProcessingPhoto}
        >
            {uri ? (
                <>
                    <Image source={{ uri }} style={styles.idThumbnail} />
                    <View style={styles.idPickerOverlay}>
                        <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    </View>
                    <TouchableOpacity
                        style={styles.retakeButton}
                        onPress={onTakePhoto}
                        disabled={isProcessingPhoto}
                    >
                        <Ionicons name="camera-reverse" size={16} color="white" />
                        <Text style={styles.retakeText}>Retake</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.idPickerPlaceholder}>
                    {isProcessingPhoto ? (
                        <ActivityIndicator size="small" color={ACCENT} />
                    ) : (
                        <>
                            <Ionicons name="camera-outline" size={36} color="#9ca3af" />
                            <Text style={styles.idPickerLabel}>{label}</Text>
                            <Text style={styles.idPickerSubLabel}>Tap to take photo</Text>
                        </>
                    )}
                </View>
            )}
        </TouchableOpacity>
    ), [isProcessingPhoto]);

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
            {/* Progress Header */}
            <View style={styles.progressHeader}>
                <View style={styles.progressInfo}>
                    <Text style={styles.progressLabel}>Profile Completion</Text>
                    <Text style={styles.progressPercentage}>{completionProgress}%</Text>
                </View>
                <View style={styles.progressBarBackground}>
                    <View 
                        style={[
                            styles.progressBarFill, 
                            { 
                                width: `${completionProgress}%`,
                                backgroundColor: currentServiceColor()
                            }
                        ]} 
                    />
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={true}
            >
                <View style={styles.headerSection}>
                    <Image source={require('../../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.title}>Finish Your Profile</Text>
                    <Text style={styles.subtitle}>Complete your service profile to start accepting jobs</Text>
                </View>

                {/* Profile Photo Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.inputLabel}>Profile Photo</Text>
                            <Text style={styles.required}>*</Text>
                            {imageUri && (
                                <View style={styles.completedBadge}>
                                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={styles.helperText}>Take a clear, professional photo of yourself</Text>
                    <TouchableOpacity
                        style={[
                            styles.avatarPlaceholder,
                            imageUri && styles.avatarPlaceholderCompleted
                        ]}
                        onPress={() => handleCameraOpen('profile')}
                        activeOpacity={0.8}
                        disabled={isProcessingPhoto}
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
                                {isProcessingPhoto ? (
                                    <ActivityIndicator size="large" color={ACCENT} />
                                ) : (
                                    <>
                                        <Ionicons name="camera" size={36} color="#9ca3af" />
                                        <Text style={styles.avatarEmptyText}>Take Photo</Text>
                                    </>
                                )}
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Full Name Section */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <Text style={styles.required}>*</Text>
                        {fullName.trim() && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            </View>
                        )}
                    </View>
                    <View style={[
                        styles.inputWrapper,
                        fullNameError ? styles.inputWrapperError : null,
                        fullName.trim() ? styles.inputWrapperCompleted : null
                    ]}>
                        <TextInput
                            placeholder="Enter your full name"
                            value={fullName}
                            onChangeText={text => { 
                                setFullName(text); 
                                if (text.trim()) setFullNameError(''); 
                            }}
                            onBlur={() => { 
                                if (!fullName.trim()) setFullNameError('Full name is required'); 
                            }}
                            returnKeyType="next"
                            style={styles.textInput}
                        />
                    </View>
                    {fullNameError ? <Text style={styles.errorText}>{fullNameError}</Text> : null}
                </View>

                <View style={styles.divider} />

                {/* Services Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.inputLabel}>Select Services</Text>
                            <Text style={styles.required}>*</Text>
                            {selectedServiceIds.length > 0 && (
                                <View style={styles.completedBadge}>
                                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                                </View>
                            )}
                        </View>
                        <View style={styles.bulkActions}>
                            <TouchableOpacity 
                                onPress={() => setSelectedServiceIds(SERVICE_OPTIONS.map(s => s.id))} 
                                style={styles.bulkAction}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.bulkActionText}>Select All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setSelectedServiceIds([])} 
                                style={styles.bulkAction}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.bulkActionText}>Clear</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.helperText}>Choose all services you offer</Text>
                    
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
                                            backgroundColor: `${opt.color}10`,
                                        },
                                    ]}
                                    onPress={() => {
                                        setSelectedServiceIds(prev => 
                                            prev.includes(opt.id) 
                                                ? prev.filter(id => id !== opt.id)
                                                : [...prev, opt.id]
                                        );
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.serviceIcon, { backgroundColor: `${opt.color}20` }]}>
                                        <Ionicons name={opt.icon} size={30} color={isSelected ? opt.color : '#9ca3af'} />
                                    </View>
                                    <Text style={[styles.serviceName, isSelected && { color: opt.color, fontWeight: '700' }]}>
                                        {opt.displayName}
                                    </Text>
                                    {isSelected && (
                                        <View style={[styles.checkBadge, { backgroundColor: opt.color }]}>
                                            <Ionicons name="checkmark" size={18} color="#fff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Bio Section */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.inputLabel}>Bio</Text>
                        <Text style={styles.required}>*</Text>
                        {bio.trim() && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.helperText}>Describe your skills and experience in detail</Text>
                    <View style={[
                        styles.inputWrapper,
                        bio.trim() ? styles.inputWrapperCompleted : null
                    ]}>
                        <TextInput
                            placeholder="Tell customers about your expertise, specializations, and what makes you unique..."
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            numberOfLines={4}
                            style={[styles.textInput, styles.textArea]}
                            placeholderTextColor="#9ca3af"
                        />
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Experience Level Section */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.inputLabel}>Years of Experience</Text>
                        <Text style={styles.required}>*</Text>
                        {experienceLevel && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            </View>
                        )}
                    </View>
                    <View style={styles.pillRow}>
                        {EXPERIENCE_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.expPill,
                                    experienceLevel === opt.value && { 
                                        backgroundColor: `${ACCENT}15`, 
                                        borderColor: ACCENT,
                                        borderWidth: 2
                                    },
                                ]}
                                onPress={() => setExperienceLevel(opt.value)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.pillText, experienceLevel === opt.value && { color: ACCENT, fontWeight: '700' }]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.divider} />

                {/* Service Location Section */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.inputLabel}>Service Location</Text>
                        <Text style={styles.required}>*</Text>
                        {markerPosition && location && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.helperText}>Customers will find you based on this location</Text>
                    {markerPosition ? (
                        <View style={[styles.locationCard, { borderColor: currentServiceColor(), backgroundColor: `${currentServiceColor()}08` }]}>
                            <MaterialIcons name="location-on" size={32} color={currentServiceColor()} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.locationLabel}>Location Selected</Text>
                                <Text style={styles.locationCoords}>
                                    {markerPosition.latitude.toFixed(4)}, {markerPosition.longitude.toFixed(4)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.changeBtn, { backgroundColor: currentServiceColor() }]}
                                onPress={() => setShowMapSelector(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.changeBtnText}>Change</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.mapPickerButton, { borderColor: currentServiceColor(), borderStyle: 'dashed' }]}
                            onPress={() => setShowMapSelector(true)}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="add-location" size={28} color={currentServiceColor()} />
                            <Text style={[styles.mapPickerText, { color: currentServiceColor() }]}>
                                Select Location on Map
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.divider} />

                {/* Government ID Section */}
                <View style={styles.section}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.inputLabel}>Government ID Verification</Text>
                        <Text style={styles.required}>*</Text>
                        {govtIdType && idFrontUri && idBackUri && (
                            <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                            </View>
                        )}
                    </View>
                    <Text style={styles.helperText}>Take clear photos of both sides of your ID for verification</Text>

                    <View style={styles.idTypeGrid}>
                        {GOVT_ID_TYPES.map(idType => (
                            <TouchableOpacity
                                key={idType.value}
                                style={[
                                    styles.idTypePill,
                                    govtIdType === idType.value && { 
                                        backgroundColor: `${ACCENT}15`, 
                                        borderColor: ACCENT,
                                        borderWidth: 2
                                    },
                                ]}
                                onPress={() => setGovtIdType(idType.value)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.idTypeText, govtIdType === idType.value && { color: ACCENT, fontWeight: '700' }]}>
                                    {idType.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.idPickersRow}>
                        {renderIdPicker(
                            'Front Side',
                            idFrontUri,
                            () => handleCameraOpen('idFront')
                        )}
                        {renderIdPicker(
                            'Back Side',
                            idBackUri,
                            () => handleCameraOpen('idBack')
                        )}
                    </View>
                </View>

                {/* Submit Section */}
                <View style={styles.submitSection}>
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            { backgroundColor: currentServiceColor() },
                            (!isFormValid() || uploading) && styles.buttonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={!isFormValid() || uploading}
                        activeOpacity={0.8}
                    >
                        {uploading
                            ? <ActivityIndicator color="#fff" size="large" />
                            : (
                                <View style={styles.submitButtonContent}>
                                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                                    <Text style={styles.submitButtonText}>Submit for Approval</Text>
                                </View>
                            )
                        }
                    </TouchableOpacity>

                    <Text style={styles.submitHelperText}>
                        Your profile will be reviewed within 24-48 hours
                    </Text>

                    <TouchableOpacity 
                        style={styles.logoutButton} 
                        onPress={handleLogout} 
                        disabled={isLoggingOut || uploading} 
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={18} color="#cc0000" />
                        <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Text>
                    </TouchableOpacity>
                </View>
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

            {/* Custom Camera */}
            <CustomCamera
                visible={cameraVisible}
                onClose={handleCameraClose}
                onCapture={handleCameraCapture}
                accentColor={currentServiceColor()}
            />
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    safeArea: { 
        flex: 1, 
        backgroundColor: '#f8fafc' 
    },
    
    // Progress Header
    progressHeader: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    progressPercentage: {
        fontSize: 16,
        fontWeight: '700',
        color: '#179d2e',
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: '#e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
        transition: 'width 0.3s ease',
    },
    
    scrollContent: { 
        flexGrow: 1, 
        paddingHorizontal: 20, 
        paddingTop: 24, 
        paddingBottom: 40 
    },
    
    headerSection: { 
        alignItems: 'flex-start', 
        marginBottom: 24,
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    logo: { 
        width: 60, 
        height: 60, 
        marginBottom: 16 
    },
    title: { 
        fontSize: 28, 
        fontWeight: '800', 
        color: '#111827', 
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: { 
        fontSize: 15, 
        color: '#6b7280', 
        lineHeight: 22 
    },
    
    // Sections
    section: { 
        marginBottom: 20,
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 8 
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    inputLabel: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: '#111827' 
    },
    required: { 
        color: '#ef4444', 
        fontSize: 18,
        fontWeight: '700',
    },
    completedBadge: {
        marginLeft: 4,
    },
    helperText: { 
        fontSize: 13, 
        color: '#6b7280', 
        marginBottom: 14, 
        lineHeight: 18 
    },
    bulkActions: { 
        flexDirection: 'row', 
        gap: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        padding: 2,
    },
    bulkAction: { 
        paddingHorizontal: 12, 
        paddingVertical: 6,
        borderRadius: 6,
    },
    bulkActionText: { 
        fontSize: 12, 
        color: '#179d2e', 
        fontWeight: '600' 
    },
    
    // Divider
    divider: {
        height: 12,
    },
    
    // Inputs
    inputWrapper: { 
        borderWidth: 2, 
        borderColor: '#e5e7eb', 
        borderRadius: 12, 
        backgroundColor: '#f9fafb',
        marginBottom: 4,
    },
    inputWrapperError: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2',
    },
    inputWrapperCompleted: {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
    },
    textInput: { 
        paddingHorizontal: 16, 
        paddingVertical: 14, 
        fontSize: 16, 
        color: '#111827' 
    },
    textArea: { 
        height: 120, 
        textAlignVertical: 'top' 
    },
    errorText: { 
        color: '#ef4444', 
        fontSize: 13, 
        marginTop: 6,
        fontWeight: '500',
    },
    
    // Avatar
    avatarPlaceholder: {
        width: 130,
        height: 130,
        borderRadius: 65,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: '#e5e7eb',
        position: 'relative',
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarPlaceholderCompleted: {
        borderColor: '#22c55e',
    },
    avatar: { 
        width: 130, 
        height: 130, 
        borderRadius: 65 
    },
    avatarEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        gap: 8,
    },
    avatarEmptyText: { 
        fontSize: 13, 
        color: '#9ca3af', 
        fontWeight: '500' 
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 6,
    },
    retakeText: { 
        color: 'white', 
        fontSize: 12, 
        fontWeight: '600' 
    },
    
    // Services Grid
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    serviceCard: {
        width: (WINDOW_WIDTH - 80) / 2,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e5e7eb',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    serviceIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    serviceName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        textTransform: 'capitalize',
        textAlign: 'center',
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
    
    // Experience Pills
    pillRow: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: 10,
        marginTop: 4 
    },
    expPill: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    pillText: { 
        fontSize: 14, 
        color: '#6b7280', 
        fontWeight: '500' 
    },
    
    // Location
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    locationLabel: { 
        fontSize: 15, 
        fontWeight: '600', 
        color: '#111827', 
        marginBottom: 4 
    },
    locationCoords: { 
        fontSize: 13, 
        color: '#6b7280', 
        fontFamily: 'monospace' 
    },
    changeBtn: { 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    changeBtnText: { 
        color: '#ffffff', 
        fontSize: 14, 
        fontWeight: '600' 
    },
    mapPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 20,
        borderWidth: 2,
        borderRadius: 12,
        backgroundColor: '#f9fafb',
    },
    mapPickerText: { 
        fontSize: 16, 
        fontWeight: '600' 
    },
    
    // Government ID
    idTypeGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: 8, 
        marginBottom: 20 
    },
    idTypePill: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    idTypeText: { 
        fontSize: 14, 
        color: '#6b7280', 
        fontWeight: '500' 
    },
    idPickersRow: { 
        flexDirection: 'row', 
        gap: 12 
    },
    idPickerButton: {
        flex: 1,
        height: 160,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    idPickerButtonCompleted: {
        borderColor: '#22c55e',
    },
    idPickerPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        gap: 8,
    },
    idPickerLabel: { 
        fontSize: 14, 
        color: '#6b7280', 
        fontWeight: '600' 
    },
    idPickerSubLabel: { 
        fontSize: 12, 
        color: '#9ca3af' 
    },
    idThumbnail: { 
        width: '100%', 
        height: '100%' 
    },
    idPickerOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    retakeButton: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 6,
    },
    
    // Submit Section
    submitSection: {
        marginTop: 8,
        marginBottom: 20,
    },
    submitButton: { 
        paddingVertical: 18, 
        borderRadius: 14, 
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: { 
        backgroundColor: '#d1d5db',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    submitButtonText: { 
        color: '#fff', 
        fontSize: 18, 
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    submitHelperText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#9ca3af',
        marginTop: 12,
        marginBottom: 20,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    logoutText: { 
        color: '#cc0000', 
        fontSize: 15, 
        fontWeight: '500' 
    },
    
    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        color: '#6b7280',
        fontWeight: '500',
    },
});

export default MistriOnboardingProfile;