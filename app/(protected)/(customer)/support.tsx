// app/(protected)/(customer)/support.tsx

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { customerBrand as B } from '../../../lib/customerDashboardTokens';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SupportScreen() {
    const router = useRouter();
    const [activeFaq, setActiveFaq] = useState<number | null>(0);

    const contactMethods = [
        {
            id: 'call',
            icon: 'call',
            label: 'Call Us',
            subtext: 'Mon-Sun, 8am-8pm',
            color: '#10b981',
            action: () => Linking.openURL('tel:+9779825995421'),
        },
        {
            id: 'whatsapp',
            icon: 'logo-whatsapp',
            label: 'WhatsApp',
            subtext: 'Chat with us',
            color: '#25D366',
            action: () => Linking.openURL('https://wa.me/9779825995421'),
        },
        {
            id: 'email',
            icon: 'mail',
            label: 'Email',
            subtext: 'Reply within 24h',
            color: '#3b82f6',
            action: () => Linking.openURL('mailto:anujkattel6@gmail.com'),
        },
    ];

    const faqs = [
        {
            id: 0,
            question: 'How do I track my current booking?',
            answer: 'You can track your booking in real-time by going to the "My Bookings" section or by tapping "Track Order" on the dashboard. You will see the live location of your assigned professional once they are en route.'
        },
        {
            id: 1,
            question: 'What is the cancellation policy?',
            answer: 'You can cancel your booking free of charge up to 1 hour before the scheduled time. If the professional has already been assigned and is on the way, a small visit fee may apply.'
        },
        {
            id: 2,
            question: 'How do I pay for the service?',
            answer: 'We support Cash on Delivery (COD), and major digital wallets. Online card payments are currently being integrated and will be available soon.'
        },
        {
            id: 3,
            question: 'Are the professionals verified?',
            answer: 'Yes, all our professionals undergo strict background checks, identity verification, and skill testing before being onboarded to ensure your safety and service quality.'
        },
    ];

    const toggleFaq = (id: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveFaq(activeFaq === id ? null : id);
    };

    return (
        <SafeAreaContainer style={styles.safeRoot}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <LinearGradient
                    colors={[B.accent, '#9f988c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroIconCircle}>
                        <FontAwesome5 name="headset" size={28} color="#fff" />
                    </View>
                    <Text style={styles.heroTitle}>How can we help you?</Text>
                    <Text style={styles.heroSubtitle}>
                        We are here to assist you with any questions or concerns you may have.
                    </Text>
                </LinearGradient>

                {/* Contact Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Get in Touch</Text>
                    <View style={styles.contactGrid}>
                        {contactMethods.map((method) => (
                            <TouchableOpacity
                                key={method.id}
                                style={styles.contactCard}
                                onPress={method.action}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.contactIconWrapper, { backgroundColor: method.color + '15' }]}>
                                    <Ionicons name={method.icon as any} size={24} color={method.color} />
                                </View>
                                <Text style={styles.contactLabel}>{method.label}</Text>
                                <Text style={styles.contactSubtext}>{method.subtext}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* FAQ Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                    <View style={styles.faqContainer}>
                        {faqs.map((faq) => (
                            <View key={faq.id} style={styles.faqItem}>
                                <TouchableOpacity
                                    style={styles.faqHeader}
                                    onPress={() => toggleFaq(faq.id)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                                    <Ionicons
                                        name={activeFaq === faq.id ? 'chevron-up' : 'chevron-down'}
                                        size={20}
                                        color="#64748b"
                                    />
                                </TouchableOpacity>
                                {activeFaq === faq.id && (
                                    <View style={styles.faqAnswerContainer}>
                                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    safeRoot: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        paddingBottom: 40,
    },
    heroCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 28,
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    heroIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        lineHeight: 20,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 16,
    },
    contactGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    contactCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    contactIconWrapper: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    contactLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    contactSubtext: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
    },
    faqContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    faqItem: {
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
        overflow: 'hidden',
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    faqQuestion: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
        marginRight: 12,
    },
    faqAnswerContainer: {
        paddingHorizontal: 12,
        paddingBottom: 16,
    },
    faqAnswer: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 22,
    },
    reportSection: {
        marginTop: 8,
    },
    reportButton: {
        flexDirection: 'row',
        backgroundColor: B.accent,
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: B.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    reportButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});