// components/DeletionPromptModal.tsx

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface DeletionPromptModalProps {
    visible: boolean;
    deletionDate: string | null;
    onCancelDeletion: () => void;
    onLogout: () => void;
    isLoading: boolean;
}

export function DeletionPromptModal({
    visible,
    deletionDate,
    onCancelDeletion,
    onLogout,
    isLoading,
}: DeletionPromptModalProps) {
    const router = useRouter();

    if (!deletionDate) return null;

    const deletionDateObj = new Date(deletionDate);
    const formattedDate = deletionDateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const formattedTime = deletionDateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const daysRemaining = Math.ceil(
        (deletionDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => {}}
        >
            <TouchableWithoutFeedback>
                <View style={styles.overlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.container}
                    >
                        <View style={styles.content}>
                            <View style={styles.iconContainer}>
                                <View style={styles.warningCircle}>
                                    <MaterialIcons name="warning" size={48} color="#dc2626" />
                                </View>
                            </View>

                            <Text style={styles.title}>Account Deletion Pending</Text>

                            <Text style={styles.description}>
                                Your account has been scheduled for deletion. You can cancel this request if you wish to continue using ServeX.
                            </Text>

                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <Ionicons name="calendar-outline" size={20} color="#64748b" />
                                    <Text style={styles.infoText}>
                                        Deletion scheduled for: {formattedDate} at {formattedTime}
                                    </Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Ionicons name="time-outline" size={20} color="#64748b" />
                                    <Text style={styles.infoText}>
                                        {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onLogout}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.cancelButtonText}>Logout</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.continueButton}
                                    onPress={onCancelDeletion}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="refresh-outline" size={18} color="#fff" />
                                            <Text style={styles.continueButtonText}>Cancel Deletion & Continue</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.footerText}>
                                Your account and all data will be permanently deleted after this date.
                            </Text>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 400,
    },
    content: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    warningCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: 15,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    infoCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoText: {
        fontSize: 14,
        color: '#334155',
        flex: 1,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748b',
    },
    continueButton: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#2563eb',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    footerText: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 16,
    },
});