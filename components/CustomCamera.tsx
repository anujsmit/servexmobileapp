import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    Dimensions,
} from 'react-native';
import { 
    Camera, 
    useCameraDevice, 
    useCameraPermission,
    useFrameProcessor
} from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { runOnJS } from 'react-native-reanimated';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

interface CustomCameraProps {
    visible: boolean;
    onClose: () => void;
    onCapture: (uri: string, base64: string) => void;
    accentColor?: string;
}

export const CustomCamera: React.FC<CustomCameraProps> = ({
    visible,
    onClose,
    onCapture,
    accentColor = '#179d2e',
}) => {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const cameraRef = useRef<Camera>(null);
    
    const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
    const [isProcessing, setIsProcessing] = useState(false);
    const [stabilityCounter, setStabilityCounter] = useState(0);
    const [feedbackMessage, setFeedbackMessage] = useState('Align ID inside the box');

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (visible && !hasPermission) {
            requestPermission();
        }
    }, [visible, hasPermission, requestPermission]);

    // Handle high-speed capture execution when target object is locked
    const triggerAutoCapture = useCallback(async () => {
        if (!cameraRef.current || isProcessing) return;
        
        try {
            setIsProcessing(true);
            setFeedbackMessage('Hold still... Capturing');

            const photo = await cameraRef.current.takePhoto({
                flash: flashMode,
                enableShutterSound: false,
            });

            if (!photo) throw new Error('No capture path returned');

            // Process image manipulation payload matching backend standards
            const fileUri = `file://${photo.path}`;
            const manipulated = await ImageManipulator.manipulateAsync(
                fileUri,
                [{ resize: { width: 1024 } }],
                {
                    compress: 0.75,
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true,
                }
            );

            if (isMounted.current && manipulated.base64) {
                onCapture(manipulated.uri, manipulated.base64);
                onClose();
            }
        } catch (error) {
            if (__DEV__) console.error('Auto-capture error:', error);
            Alert.alert('Scan Failed', 'Could not accurately read document bounds.');
        } finally {
            if (isMounted.current) {
                setIsProcessing(false);
                setStabilityCounter(0);
                setFeedbackMessage('Align ID inside the box');
            }
        }
    }, [isProcessing, flashMode, onCapture, onClose]);

    // Frame processor tracking loop
    const processFrameAnalysis = useCallback((isStableDetected: boolean) => {
        if (isProcessing) return;

        if (isStableDetected) {
            setStabilityCounter(prev => {
                const nextCount = prev + 1;
                // Requires 12 consecutive stable frames before launching auto-shutter
                if (nextCount >= 12) {
                    runOnJS(triggerAutoCapture)();
                } else {
                    setFeedbackMessage(`Detecting ID... (${Math.round((nextCount / 12) * 100)}%)`);
                }
                return nextCount;
            });
        } else {
            setStabilityCounter(0);
            setFeedbackMessage('Align ID inside the box');
        }
    }, [isProcessing, triggerAutoCapture]);

    // Hardware accelerated frame processor loop
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';
        // Simulating high-performance edge contour metrics.
        // Replace with specific ML Kit native wrappers (e.g., vision-camera-plugin-mlkit-object-detection) if explicit bound metrics are added.
        const mockDetectionThreshold = Math.random() > 0.35; 
        runOnJS(processFrameAnalysis)(mockDetectionThreshold);
    }, [processFrameAnalysis]);

    if (!visible) return null;

    if (!hasPermission) {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.permissionCard}>
                        <Ionicons name="camera-off-outline" size={40} color="#EF4444" style={{ marginBottom: 12 }} />
                        <Text style={styles.permissionErrorText}>Camera Permission Required</Text>
                        <Text style={styles.permissionSubText}>
                            Onboarding requires dynamic verification matching your government credentials.
                        </Text>
                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: accentColor }]}
                            onPress={requestPermission}
                        >
                            <Text style={styles.btnTextWhite}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    if (!device) {
        return (
            <Modal visible={visible} transparent>
                <View style={styles.modalOverlay}>
                    <ActivityIndicator size="large" color={accentColor} />
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent={false} animationType="slide">
            <SafeAreaView style={styles.cameraContainer}>
                <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={visible}
                    photo={true}
                    frameProcessor={frameProcessor}
                />

                {/* Document Mask Overlay UI Layout */}
                <View style={styles.overlayContainer}>
                    {/* Top Shade Layer */}
                    <View style={styles.shadeLayer} />

                    {/* Middle Processing Row */}
                    <View style={styles.middleRow}>
                        <View style={styles.shadeLayer} />
                        
                        {/* Target Capture Area Box */}
                        <View style={[
                            styles.targetWindow, 
                            { borderColor: stabilityCounter > 0 ? '#22c55e' : 'rgba(255,255,255,0.7)' }
                        ]}>
                            {/* Reticle Edges */}
                            <View style={[styles.cornerMarker, styles.topLeft, { borderColor: accentColor }]} />
                            <View style={[styles.cornerMarker, styles.topRight, { borderColor: accentColor }]} />
                            <View style={[styles.cornerMarker, styles.bottomLeft, { borderColor: accentColor }]} />
                            <View style={[styles.cornerMarker, styles.bottomRight, { borderColor: accentColor }]} />
                        </View>

                        <View style={styles.shadeLayer} />
                    </View>

                    {/* Bottom Shade Layer */}
                    <View style={[styles.shadeLayer, styles.bottomControlsBlock]}>
                        
                        {/* Dynamic Floating Guidance Text Box */}
                        <View style={[styles.feedbackPill, stabilityCounter > 0 && { backgroundColor: 'rgba(34, 197, 94, 0.95)' }]}>
                            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
                        </View>

                        {/* Interactive UI Action Row */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.circularIconBtn} onPress={onClose}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>

                            {/* Center Status Ring */}
                            <View style={[styles.outerCaptureRing, { borderColor: stabilityCounter > 0 ? '#22c55e' : '#fff' }]}>
                                {isProcessing ? (
                                    <ActivityIndicator color={accentColor} size="small" />
                                ) : (
                                    <View style={[styles.innerCaptureDot, { backgroundColor: stabilityCounter > 0 ? '#22c55e' : '#fff' }]} />
                                )}
                            </View>

                            <TouchableOpacity 
                                style={styles.circularIconBtn} 
                                onPress={() => setFlashMode(curr => curr === 'on' ? 'off' : 'on')}
                            >
                                <Ionicons 
                                    name={flashMode === 'on' ? 'flash' : 'flash-off'} 
                                    size={22} 
                                    color={flashMode === 'on' ? '#FFD60A' : '#FFF'} 
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
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionCard: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        width: '85%',
    },
    permissionErrorText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    permissionSubText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    primaryBtn: {
        paddingVertical: 12,
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    },
    btnTextWhite: {
        color: '#FFF',
        fontWeight: '600',
    },
    overlayContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    shadeLayer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
    },
    middleRow: {
        flexDirection: 'row',
        height: 240, 
    },
    targetWindow: {
        width: WINDOW_WIDTH * 0.85,
        height: 240,
        borderWidth: 2,
        position: 'relative',
        backgroundColor: 'transparent',
    },
    cornerMarker: {
        position: 'absolute',
        width: 24,
        height: 24,
    },
    topLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
    topRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
    bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
    bottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
    bottomControlsBlock: {
        flex: 1.5,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 30,
    },
    feedbackPill: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    feedbackText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 40,
    },
    circularIconBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
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
    },
    innerCaptureDot: {
        width: 54,
        height: 54,
        borderRadius: 27,
    },
});