// app/(protected)/(mistri)/arrived-confirmation.tsx
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { PageTitle } from '../../../../components/PageTitle';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ArrivedConfirmationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const requestId = params.requestId as string;
    const customerName = params.customerName as string;
    const destinationAddress = params.destinationAddress as string;

    const handleConfirmArrival = () => {
        Alert.alert(
            'Confirm Arrival',
            'Have you arrived at the customer\'s location?',
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Yes, I\'m Here',
                    onPress: () => {
                        // Navigate to start work confirmation
                        router.push({
                            pathname: '/(protected)/(mistri)/jobsteps/start-work-confirmation',
                            params: {
                                requestId,
                                customerName,
                                destinationAddress,
                            }
                        });
                    }
                }
            ]
        );
    };

    const handleCallCustomer = () => {
        // Implement call functionality
        Alert.alert('Call Customer', 'Call functionality will be implemented');
    };

    const handleGetHelp = () => {
        Alert.alert(
            'Need Help?',
            'Contact support for assistance',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Call Support', onPress: () => {} }
            ]
        );
    };

    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Arrived at Location"
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                }
            />

            <View style={styles.container}>
                <LinearGradient
                    colors={['#F0FDF4', '#FFFFFF']}
                    style={styles.content}
                >
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="location" size={60} color="#10B981" />
                        </View>
                        <View style={styles.checkmarkBadge}>
                            <MaterialIcons name="check" size={20} color="#FFFFFF" />
                        </View>
                    </View>

                    <Text style={styles.title}>You've Arrived!</Text>
                    <Text style={styles.subtitle}>
                        You are at the customer's location. Confirm to proceed with the job.
                    </Text>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Ionicons name="person-outline" size={20} color="#6B7280" />
                            <Text style={styles.infoLabel}>Customer:</Text>
                            <Text style={styles.infoValue}>{customerName || 'Customer'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={20} color="#6B7280" />
                            <Text style={styles.infoLabel}>Location:</Text>
                            <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={2}>
                                {destinationAddress || 'No address provided'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleConfirmArrival}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#10B981', '#059669']}
                                style={styles.primaryButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />
                                <Text style={styles.primaryButtonText}>Confirm Arrival</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.secondaryButtons}>
                            <TouchableOpacity
                                style={[styles.secondaryButton, styles.callButton]}
                                onPress={handleCallCustomer}
                            >
                                <Ionicons name="call" size={20} color="#2563EB" />
                                <Text style={styles.secondaryButtonText}>Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.secondaryButton, styles.helpButton]}
                                onPress={handleGetHelp}
                            >
                                <Ionicons name="help-circle" size={20} color="#8B5CF6" />
                                <Text style={[styles.secondaryButtonText, { color: '#8B5CF6' }]}>Help</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>
            </View>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        padding: 24,
        paddingTop: 20,
    },
    iconContainer: {
        position: 'relative',
        marginBottom: 24,
        marginTop: 20,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmarkBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 32,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    infoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0F172A',
    },
    actionButtons: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
    },
    primaryButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    callButton: {
        borderColor: '#93C5FD',
    },
    helpButton: {
        borderColor: '#C4B5FD',
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2563EB',
    },
});