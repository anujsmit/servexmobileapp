// app/(protected)/(customer)/order-success.tsx

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function OrderSuccessScreen() {
    const router = useRouter();
    
    // Animation values
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        // Sequence animations
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 600,
                easing: Easing.bounce,
                useNativeDriver: true,
            }),
            Animated.timing(checkAnim, {
                toValue: 1,
                duration: 400,
                easing: Easing.ease,
                useNativeDriver: true,
            }),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    const orderId = 'SR' + Date.now().toString().slice(-6);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Success Icon */}
                <Animated.View 
                    style={[
                        styles.iconContainer,
                        { transform: [{ scale: scaleAnim }] }
                    ]}
                >
                    <LinearGradient
                        colors={['#10b981', '#059669']}
                        style={styles.successCircle}
                    >
                        <Animated.View
                            style={{
                                transform: [
                                    {
                                        scale: checkAnim.interpolate({
                                            inputRange: [0, 0.5, 1],
                                            outputRange: [0, 1.3, 1],
                                        })
                                    }
                                ]
                            }}
                        >
                            <Ionicons name="checkmark" size={64} color="#fff" />
                        </Animated.View>
                    </LinearGradient>
                </Animated.View>

                {/* Success Text */}
                <Animated.View style={{ opacity: fadeAnim }}>
                    <Text style={styles.title}>Order Placed Successfully! 🎉</Text>
                    <Text style={styles.subtitle}>
                        Your service request has been submitted. You will receive a confirmation shortly.
                    </Text>
                </Animated.View>

                {/* Order Details Card */}
                <Animated.View 
                    style={[
                        styles.detailsCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={styles.detailsHeader}>
                        <Text style={styles.detailsTitle}>Order Details</Text>
                        <View style={styles.orderIdBadge}>
                            <Text style={styles.orderIdText}>#{orderId}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="check-circle" size={20} color="#10b981" />
                            <Text style={styles.detailLabel}>Status</Text>
                        </View>
                        <Text style={[styles.detailValue, styles.statusText]}>Confirmed</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="schedule" size={20} color="#3b82f6" />
                            <Text style={styles.detailLabel}>Estimated</Text>
                        </View>
                        <Text style={styles.detailValue}>Within 24 hours</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <MaterialIcons name="notifications" size={20} color="#f59e0b" />
                            <Text style={styles.detailLabel}>Next Step</Text>
                        </View>
                        <Text style={styles.detailValue}>Admin approval pending</Text>
                    </View>
                </Animated.View>

                {/* What Happens Next */}
                <Animated.View 
                    style={[
                        styles.nextStepsCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <Text style={styles.nextStepsTitle}>What happens next?</Text>
                    
                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>1</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Admin Reviews Request</Text>
                            <Text style={styles.stepDescription}>
                                Our team will review your request and assign the best professional
                            </Text>
                        </View>
                    </View>

                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>2</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Professional Assigned</Text>
                            <Text style={styles.stepDescription}>
                                You'll receive a notification with the assigned professional's details
                            </Text>
                        </View>
                    </View>

                    <View style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>3</Text>
                        </View>
                        <View style={styles.stepContent}>
                            <Text style={styles.stepTitle}>Service Completed</Text>
                            <Text style={styles.stepDescription}>
                                The professional will complete the service and you can pay directly
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Action Buttons */}
                <Animated.View 
                    style={[
                        styles.buttonContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={() => router.push('/(protected)/(customer)/requests')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryButtonText}>View My Orders</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.secondaryButton]}
                        onPress={() => router.push('/(protected)/(customer)/dashboard')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    successCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    detailsCard: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    detailsTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
    },
    orderIdBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    orderIdText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        fontFamily: 'monospace',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
    },
    statusText: {
        color: '#10b981',
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
    },
    nextStepsCard: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    nextStepsTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 16,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 14,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#2563eb',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    stepNumberText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    stepContent: {
        flex: 1,
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    stepDescription: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    primaryButton: {
        backgroundColor: '#2563eb',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    secondaryButtonText: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '600',
    },
});