// components/CustomCamera.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Dimensions,
    Platform,
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

interface CustomCameraProps {
    visible: boolean;
    onClose: () => void;
    onCapture: (uri: string, base64: string) => void;
    accentColor?: string;
    aspect?: [number, number];
    captureQuality?: number;
    initialFacing?: 'front' | 'back';
}

export const CustomCamera: React.FC<CustomCameraProps> = ({
    visible,
    onClose,
    onCapture,
    accentColor = '#0177b8',
    aspect = [1, 1],
    captureQuality = 0.8,
    initialFacing = 'back',
}) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
    const [isProcessing, setIsProcessing] = useState(false);
    const [facing, setFacing] = useState<'front' | 'back'>(initialFacing);
    const cameraRef = useRef<CameraView>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Request permission when modal becomes visible
    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
    }, [visible, permission]);

    // Reset facing when modal is opened
    useEffect(() => {
        if (visible) {
            setFacing(initialFacing);
        }
    }, [visible]);

    const toggleFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
        if (facing === 'front') {
            setFlashMode('off');
        }
    };

    const takePicture = async () => {
        if (!cameraRef.current || isProcessing) return;
        if (!permission?.granted) {
            Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
            return;
        }

        try {
            setIsProcessing(true);

            const photo = await cameraRef.current.takePictureAsync({
                quality: captureQuality,
                base64: true,
                skipProcessing: false,
            });

            if (!photo || !photo.uri) {
                throw new Error('No capture returned');
            }

            const manipulated = await ImageManipulator.manipulateAsync(
                photo.uri,
                [
                    { resize: { width: aspect[0] > aspect[1] ? 1024 : 768 } },
                ],
                {
                    compress: captureQuality,
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true,
                }
            );

            if (isMounted.current && manipulated.base64) {
                onCapture(manipulated.uri, manipulated.base64);
                onClose();
            }
        } catch (error) {
            console.error('Capture error:', error);
            Alert.alert(
                'Capture Failed',
                'Could not take picture. Please try again.',
                [{ text: 'OK' }]
            );
        } finally {
            if (isMounted.current) {
                setIsProcessing(false);
            }
        }
    };

    if (!visible) return null;

    // Show loading while checking permission
    if (!permission) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={styles.permissionSubText}>Initializing camera...</Text>
                </View>
            </Modal>
        );
    }

    // Show permission request screen if not granted
    if (!permission.granted) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.permissionCard}>
                        <Ionicons name="camera-off-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                        <Text style={styles.permissionErrorText}>Camera Permission Required</Text>
                        <Text style={styles.permissionSubText}>
                            We need camera access to capture your photo.
                        </Text>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                            onPress={requestPermission}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.btnTextWhite}>Grant Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.secondaryBtn, { marginTop: 10 }]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.btnText, { color: '#6B7280' }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    // Main Camera View - Full screen clean camera
    return (
        <Modal visible={visible} transparent={false} animationType="slide">
            <SafeAreaView style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    flash={flashMode}
                    enableTorch={flashMode === 'on'}
                    mode="picture"
                />

                {/* Overlay UI */}
                <View style={styles.overlayContainer}>
                    {/* Top Bar with Close Button and Facing Indicator */}
                    <View style={styles.topBar}>
                        <TouchableOpacity 
                            style={styles.closeButton} 
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                        
                        <View style={styles.facingIndicator}>
                            <Ionicons 
                                name={facing === 'front' ? 'person' : 'camera'} 
                                size={16} 
                                color="rgba(255,255,255,0.8)" 
                            />
                            <Text style={styles.facingIndicatorText}>
                                {facing === 'front' ? 'Selfie' : 'Back'}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={styles.bottomControls}>
                        {/* Action Buttons */}
                        <View style={styles.actionRow}>
                            {/* Flash Toggle */}
                            <TouchableOpacity 
                                style={styles.iconBtn} 
                                onPress={() => setFlashMode(curr => curr === 'on' ? 'off' : 'on')}
                                activeOpacity={0.7}
                                disabled={facing === 'front'}
                            >
                                <Ionicons 
                                    name={flashMode === 'on' ? 'flash' : 'flash-off'} 
                                    size={24} 
                                    color={flashMode === 'on' ? '#FFD60A' : '#FFF'} 
                                />
                            </TouchableOpacity>

                            {/* Capture Button */}
                            <TouchableOpacity 
                                style={[styles.outerCaptureRing, { borderColor: '#fff' }]}
                                onPress={takePicture}
                                disabled={isProcessing}
                                activeOpacity={0.8}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator color={accentColor} size="small" />
                                ) : (
                                    <View style={styles.innerCaptureDot} />
                                )}
                            </TouchableOpacity>

                            {/* Flip Camera */}
                            <TouchableOpacity 
                                style={styles.iconBtn} 
                                onPress={toggleFacing}
                                activeOpacity={0.7}
                            >
                                <Ionicons 
                                    name="camera-reverse-outline" 
                                    size={26} 
                                    color="#FFF" 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    permissionCard: {
        backgroundColor: '#FFF',
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    permissionErrorText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
    },
    permissionSubText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
        lineHeight: 20,
    },
    primaryBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    secondaryBtn: {
        paddingVertical: 12,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    btnTextWhite: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16,
    },
    btnText: {
        fontWeight: '500',
        fontSize: 15,
    },
    overlayContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    facingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    facingIndicatorText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '500',
    },
    bottomControls: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 10 : 20,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    iconBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerCaptureRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    innerCaptureDot: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF',
    },
});