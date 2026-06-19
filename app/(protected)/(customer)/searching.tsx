import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Route } from 'expo-router';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useSearch } from '../../../context/SearchContext';
import { useMistriJobsQuery, useServiceRequestQuery } from '../../../hooks/queries';
import { API_BASE_URL as API_URL } from '../../../lib/config';

interface SearchingParams {
    requestId: string;
    type: string;
}

export default function Searching() {
    const params = useLocalSearchParams<SearchingParams & Route>();
    const rawRequestId = params.requestId;
    const rawType = params.type;
    const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
    const serviceType = Array.isArray(rawType) ? rawType[0] : rawType;
    const router = useRouter();
    const { startSearch, cancelSearch } = useSearch();
    const mistriJobsQuery = useMistriJobsQuery();
    const { data: requestDetail } = useServiceRequestQuery(requestId || null, { refetchInterval: 5000 });
    const [elapsedTime, setElapsedTime] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [searchStatus, setSearchStatus] = useState('Initializing search...');

    // Animation refs
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
    const slideAnimRef = useRef<Animated.CompositeAnimation | null>(null);
    const waveAnim1 = useRef(new Animated.Value(0)).current;
    const waveAnim2 = useRef(new Animated.Value(0)).current;
    const waveAnim3 = useRef(new Animated.Value(0)).current;
    const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
    const rotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    // Search status messages that cycle through
    const searchMessages = [
        'Scanning nearby service providers...',
        'Checking availability...',
        'Finding the best match for you...',
        'Connecting to verified professionals...',
        'Almost there...'
    ];

    useEffect(() => {
        if (requestId && serviceType) {
            startSearch(requestId, serviceType);
            // Start prefetching mistri jobs
            mistriJobsQuery.refetch();
        }

        // Start animations
        startAnimations();

        // Timer for elapsed time
        const timer = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
        }, 1000);

        // Status message cycling
        const statusTimer = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * searchMessages.length);
            setSearchStatus(searchMessages[randomIndex]);
        }, 3000);

        return () => {
            fadeAnimRef.current?.stop();
            slideAnimRef.current?.stop();
            pulseLoopRef.current?.stop();
            rotateLoopRef.current?.stop();
            clearInterval(timer);
            clearInterval(statusTimer);
        };
    }, []);

    // Navigate when assigned
    useEffect(() => {
        if (requestDetail && requestDetail.request?.status === 'assigned') {
            router.replace({ pathname: '/(protected)/(customer)', params: {} });
        }
    }, [requestDetail]);

    const startAnimations = () => {
        // Fade in animation
        fadeAnimRef.current = Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        });
        fadeAnimRef.current.start();

        // Slide up animation
        slideAnimRef.current = Animated.timing(slideAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        slideAnimRef.current.start();

        // Continuous pulse animation
        const createPulseAnimation = () => {
            return Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]);
        };

        // Continuous rotation animation
        const createRotateAnimation = () => {
            return Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 3000,
                easing: Easing.linear,
                useNativeDriver: true,
            });
        };

        // Loop animations
        pulseLoopRef.current = Animated.loop(createPulseAnimation());
        rotateLoopRef.current = Animated.loop(createRotateAnimation());
        pulseLoopRef.current.start();
        rotateLoopRef.current.start();
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleCancel = async () => {
        try {
            const response = await fetch(`${API_URL}/api/service-requests/${requestId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await SecureStore.getItemAsync('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to cancel request');

            cancelSearch();
            router.replace({
                pathname: '/service-request',
                params: { canceled: 'true' }
            });
        } catch (err) {
            if (__DEV__) console.error('Error canceling request:', err);
            setError('Failed to cancel request. Please try again.');
        }
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <SafeAreaContainer>
            <ScrollView contentContainerStyle={styles.container}>
                <Animated.View style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                }}>
                    {/* Header */}
                    <View style={styles.header}>
                        {/* <Text style={styles.title}>Finding Your {serviceType}</Text> */}
                        <Text style={styles.subtitle}>We're connecting you with the best {serviceType.toLowerCase()} nearby</Text>
                    </View>

                    {/* Enhanced Animation Area */}
                    <View style={styles.animationContainer}>
                        <View style={styles.searchVisualization}>
                            {/* Outer pulse ring */}
                            <Animated.View style={[
                                styles.pulseRing,
                                { transform: [{ scale: pulseAnim }], position: 'absolute', top: 0, left: 0 }
                            ]} />

                            {/* Rotating orbiting dots centered */}
                            <Animated.View style={[
                                styles.rotatingContainer,
                                { position: 'absolute', top: (120 - 80) / 2, left: (120 - 80) / 2, transform: [{ rotate: spin }] }
                            ]}>
                                <View style={[styles.orbitDot, styles.dot1]} />
                                <View style={[styles.orbitDot, styles.dot2]} />
                                <View style={[styles.orbitDot, styles.dot3]} />
                            </Animated.View>

                            {/* Center lens */}
                            <View style={[
                                styles.searchIcon,
                                { position: 'absolute', top: (120 - 60) / 2, left: (120 - 60) / 2, zIndex: 1 }
                            ]}>
                                <Ionicons name="search" size={32} color="#16a34a" />
                            </View>
                        </View>

                        <Text style={styles.searchingText}>{searchStatus}</Text>
                        <View style={styles.timeContainer}>
                            <MaterialIcons name="access-time" size={16} color="#6b7280" />
                            <Text style={styles.timeElapsed}>{formatTime(elapsedTime)}</Text>
                        </View>
                    </View>

                    {/* Progress Indicators */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressStep}>
                            <View style={[styles.progressDot, styles.completedStep]}>
                                <MaterialIcons name="check" size={16} color="#ffffff" />
                            </View>
                            <Text style={styles.progressLabel}>Request Submitted</Text>
                        </View>

                        <View style={styles.progressLine} />

                        <View style={styles.progressStep}>
                            <View style={[styles.progressDot, styles.activeStep]}>
                                <View style={styles.activePulse} />
                            </View>
                            <Text style={styles.progressLabel}>Finding Provider</Text>
                        </View>

                        <View style={styles.progressLine} />

                        <View style={styles.progressStep}>
                            <View style={styles.progressDot}>
                                <MaterialIcons name="person" size={16} color="#9ca3af" />
                            </View>
                            <Text style={styles.progressLabelInactive}>Connect & Confirm</Text>
                        </View>
                    </View>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoCardHeader}>
                            <MaterialIcons name="lightbulb-outline" size={24} color="#f59e0b" />
                            <Text style={styles.infoCardTitle}>What's happening?</Text>
                        </View>
                        <Text style={styles.infoCardText}>
                            We are scanning verified {serviceType.toLowerCase()} professionals in your area.
                            You'll receive a notification as soon as we find an available match.
                        </Text>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <MaterialIcons name="people-outline" size={20} color="#16a34a" />
                            <Text style={styles.statNumber}>50+</Text>
                            <Text style={styles.statLabel}>Providers</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <MaterialIcons name="star-outline" size={20} color="#f59e0b" />
                            <Text style={styles.statNumber}>4.8</Text>
                            <Text style={styles.statLabel}>Avg Rating</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <MaterialIcons name="schedule" size={20} color="#3b82f6" />
                            <Text style={styles.statNumber}>~2min</Text>
                            <Text style={styles.statLabel}>Avg Wait</Text>
                        </View>
                    </View>

                    {/* Error message */}
                    {error && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={20} color="#dc2626" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Cancel Button */}
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                        <MaterialIcons name="close" size={20} color="#ffffff" style={styles.cancelIcon} />
                        <Text style={styles.cancelButtonText}>Cancel Search</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
    },
    animationContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    searchVisualization: {
        position: 'relative',
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    pulseRing: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#dcfce7',
        opacity: 0.6,
    },
    rotatingContainer: {
        width: 80,
        height: 80,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orbitDot: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#16a34a',
    },
    dot1: {
        top: 5,
        left: '50%',
        marginLeft: -4,
    },
    dot2: {
        top: '50%',
        right: 5,
        marginTop: -4,
    },
    dot3: {
        bottom: 5,
        left: '50%',
        marginLeft: -4,
    },
    searchingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
        marginBottom: 12,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeElapsed: {
        fontSize: 14,
        color: '#6b7280',
        marginLeft: 4,
        fontFamily: 'monospace',
    },
    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    progressStep: {
        alignItems: 'center',
    },
    progressDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    completedStep: {
        backgroundColor: '#16a34a',
    },
    activeStep: {
        backgroundColor: '#3b82f6',
        position: 'relative',
    },
    activePulse: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    progressLine: {
        width: 30,
        height: 2,
        backgroundColor: '#e5e7eb',
        marginHorizontal: 4,
    },
    progressLabel: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    progressLabelInactive: {
        fontSize: 12,
        color: '#9ca3af',
    },
    infoCard: {
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    infoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#92400e',
        marginLeft: 8,
    },
    infoCardText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#78350f',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#e5e7eb',
        marginHorizontal: 16,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        marginBottom: 20,
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    cancelButton: {
        backgroundColor: '#ef4444',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 'auto',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    cancelIcon: {
        marginRight: 8,
    },
    cancelButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});