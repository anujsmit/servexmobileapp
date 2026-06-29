// app/(protected)/(mistri)/start-work-confirmation.tsx
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

export default function StartWorkConfirmationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const requestId = params.requestId as string;
    const customerName = params.customerName as string;

    const handleStartWork = () => {
        Alert.alert(
            'Start Work',
            'Are you ready to start working on this job?',
            [
                { text: 'Not Yet', style: 'cancel' },
                {
                    text: 'Start Now',
                    onPress: async () => {
                        try {
                            // Call API to start work
                            // await startWorkMutation.mutateAsync(requestId);
                            
                            // Navigate back to job details with started status
                            router.replace({
                                pathname: '/(protected)/(mistri)/job-details',
                                params: { requestId, started: 'true' }
                            });
                        } catch (error) {
                            Alert.alert('Error', 'Failed to start work. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaContainer>
            <PageTitle
                variant="mistri"
                title="Start Work"
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                }
            />

            <View style={styles.container}>
                <LinearGradient
                    colors={['#EEF2FF', '#FFFFFF']}
                    style={styles.content}
                >
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="hammer" size={50} color="#4F46E5" />
                        </View>
                    </View>

                    <Text style={styles.title}>Ready to Work?</Text>
                    <Text style={styles.subtitle}>
                        You are at the customer's location. Start working on the job now.
                    </Text>

                    <View style={styles.tipsCard}>
                        <Text style={styles.tipsTitle}>Before You Start</Text>
                        <View style={styles.tipItem}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.tipText}>Confirm you have all required tools</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.tipText}>Wear appropriate safety gear</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.tipText}>Communicate with the customer</Text>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleStartWork}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#4F46E5', '#4338CA']}
                                style={styles.primaryButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Ionicons name="play-circle" size={22} color="#FFFFFF" />
                                <Text style={styles.primaryButtonText}>Start Work</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.secondaryButtonText}>Go Back</Text>
                        </TouchableOpacity>
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
        marginBottom: 24,
        marginTop: 20,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E0E7FF',
        alignItems: 'center',
        justifyContent: 'center',
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
    tipsCard: {
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
    tipsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 12,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
    },
    tipText: {
        fontSize: 13,
        color: '#374151',
        flex: 1,
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
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
    },
});