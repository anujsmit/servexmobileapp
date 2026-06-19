import React, { useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    AppState,
    AppStateStatus,
    ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ROUTES } from '../../lib/routes';

const POLL_INTERVAL_MS = 30_000;

export default function PendingApprovalScreen() {
    const { user, getMe, logout } = useAuth();
    const router = useRouter();
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const appStateRef = useRef<AppStateStatus>('active');

    const isRejected = user?.approvalStatus === 'rejected';

    const checkApproval = useCallback(async () => {
        await getMe();
    }, [getMe]);

    // When user gets approved, AuthGuard will redirect automatically via the
    // approval guard — but we also reactively push the user on state change
    useEffect(() => {
        if (user?.approvalStatus === 'approved') {
            router.replace(ROUTES.MISTRI.HOME as any);
        }
    }, [user?.approvalStatus]);

    // Poll every 30s while screen is active
    useEffect(() => {
        pollInterval.current = setInterval(checkApproval, POLL_INTERVAL_MS);

        const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
            if (appStateRef.current !== 'active' && nextState === 'active') {
                await checkApproval();
            }
            appStateRef.current = nextState;
        });

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
            subscription.remove();
        };
    }, [checkApproval]);

    const handleLogout = async () => {
        await logout();
        router.replace(ROUTES.LOGIN);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.container}>
                    {isRejected ? (
                        <>
                            <View style={[styles.iconContainer, styles.iconRejected]}>
                                <Ionicons name="close-circle" size={72} color="#ef4444" />
                            </View>
                            <Text style={styles.title}>Application Not Approved</Text>
                            <Text style={styles.subtitle}>
                                Unfortunately, your application was not approved at this time.
                            </Text>
                            {user?.approvalRejectionReason ? (
                                <View style={styles.reasonBox}>
                                    <Text style={styles.reasonLabel}>Reason provided:</Text>
                                    <Text style={styles.reasonText}>{user.approvalRejectionReason}</Text>
                                </View>
                            ) : null}
                            <Text style={styles.contactText}>
                                If you believe this is a mistake, please contact our support team.
                            </Text>
                        </>
                    ) : (
                        <>
                            <View style={[styles.iconContainer, styles.iconPending]}>
                                <Ionicons name="time" size={72} color="#f59e0b" />
                            </View>
                            <Text style={styles.title}>Under Review</Text>
                            <Text style={styles.subtitle}>
                                Your application is being reviewed by our team. This usually takes 1–2 business days.
                            </Text>

                            <View style={styles.stepsCard}>
                                {[
                                    { icon: 'checkmark-circle', label: 'Profile submitted', done: true },
                                    { icon: 'time', label: 'Identity verification in progress', done: false },
                                    { icon: 'shield-checkmark-outline', label: 'Approval pending', done: false },
                                ].map((step, i) => (
                                    <View key={i} style={styles.stepRow}>
                                        <Ionicons
                                            name={step.icon as any}
                                            size={20}
                                            color={step.done ? '#22c55e' : '#9ca3af'}
                                        />
                                        <Text style={[styles.stepText, step.done && styles.stepTextDone]}>
                                            {step.label}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={styles.pollingNote}>
                                We'll check for updates automatically. You'll be redirected as soon as you're approved.
                            </Text>
                        </>
                    )}

                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
                        <Ionicons name="log-out-outline" size={18} color="#cc0000" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#ffffff' },
    scrollContent: { flexGrow: 1 },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 48,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    iconPending: { backgroundColor: '#fef3c7' },
    iconRejected: { backgroundColor: '#fee2e2' },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1a1a1a',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 28,
    },
    stepsCard: {
        width: '100%',
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 20,
        gap: 16,
        marginBottom: 24,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
    stepTextDone: { color: '#374151' },
    pollingNote: {
        fontSize: 13,
        color: '#9ca3af',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
        paddingHorizontal: 16,
    },
    reasonBox: {
        width: '100%',
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fca5a5',
        padding: 16,
        marginBottom: 20,
    },
    reasonLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ef4444',
        marginBottom: 6,
    },
    reasonText: {
        fontSize: 15,
        color: '#7f1d1d',
        lineHeight: 22,
    },
    contactText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 20,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fca5a5',
        backgroundColor: '#fff5f5',
    },
    logoutText: { color: '#cc0000', fontSize: 16, fontWeight: '600' },
});
