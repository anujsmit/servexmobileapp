import { useAuth } from '../context/AuthContext';
import {
  Text,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../lib/legalUrls';

const SERVICES = [
  { emoji: '⚡', label: 'Electrical' },
  { emoji: '🔧', label: 'Plumbing' },
  { emoji: '🪚', label: 'Carpentry' },
  { emoji: '🎨', label: 'Painting' },
  { emoji: '❄️', label: 'AC Repair' },
];

export default function Index() {
  const { token } = useAuth();
  const { isRedirecting } = useAuthRedirect();
  const router = useRouter();

  if (token || isRedirecting) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Decorative blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      <View style={styles.inner}>
        {/* ── Top: brand + hero ── */}
        <View style={styles.topGroup}>
          {/* Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.logoTextBlock}>
                <Text style={styles.brandName}>ServeX</Text>
                <Text style={styles.brandTagline}>Your trusted home services</Text>
              </View>
            </View>

            {/* <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeText}>Available in Kathmandu Valley</Text>
            </View> */}
          </View>

          {/* Hero Copy */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>
              Home services,{'\n'}
              <Text style={styles.heroTitleAccent}>on demand.</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Trusted electricians, plumbers, and more — at your doorstep.
            </Text>
          </View>

          {/* Service Chips */}
          {/* <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {SERVICES.map((s) => (
              <View key={s.label} style={styles.chip}>
                <Text style={styles.chipEmoji}>{s.emoji}</Text>
                <Text style={styles.chipLabel}>{s.label}</Text>
              </View>
            ))}
            <View style={styles.chipMore}>
              <Text style={styles.chipMoreText}>+12 more</Text>
            </View>
          </ScrollView> */}
        </View>

        {/* ── Bottom: CTAs + footer ── */}
        <View style={styles.bottomGroup}>
          <Text style={styles.ctaHeading}>How would you like to continue?</Text>

          {/* Customer Card */}
          <TouchableOpacity
            style={styles.customerCard}
            onPress={() => router.push({ pathname: '/login', params: { role: 'user' } })}
            activeOpacity={0.88}
          >
            <View style={styles.customerCardInner}>
              <View style={[styles.cardIconBubble, styles.customerIconBubble]}>
                <Ionicons name="home-outline" size={22} color="#0369a1" />
              </View>
              <View style={styles.cardTextBlock}>
                <Text style={styles.customerCardTitle}>Find a Service</Text>
                <Text style={styles.customerCardSub}>Book a trusted professional near you</Text>
              </View>
              <View style={[styles.cardArrow, styles.customerCardArrow]}>
                <Ionicons name="arrow-forward" size={16} color="#0369a1" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Mistri Card */}
          <TouchableOpacity
            style={styles.mistriCard}
            onPress={() => router.push({ pathname: '/login', params: { role: 'mistri' } })}
            activeOpacity={0.88}
          >
            <View style={styles.mistriCardInner}>
              <View style={[styles.cardIconBubble, styles.mistriIconBubble]}>
                <Ionicons name="construct-outline" size={22} color="rgba(255,255,255,0.9)" />
              </View>
              <View style={styles.cardTextBlock}>
                <Text style={styles.mistriCardTitle}>I'm a Mistri</Text>
                <Text style={styles.mistriCardSub}>Offer your skills and grow your income</Text>
              </View>
              <View style={[styles.cardArrow, styles.mistriCardArrow]}>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Verified pros' },
              { icon: 'star-outline', label: 'Rated & reviewed' },
              { icon: 'time-outline', label: 'Fast booking' },
            ].map((item) => (
              <View key={item.label} style={styles.trustBadge}>
                <Ionicons name={item.icon as any} size={14} color="#6b7280" />
                <Text style={styles.trustBadgeText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F7F3',
  },

  /* ── Decorative blobs ── */
  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#DBEAFE',
    opacity: 0.55,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 60,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#DCFCE7',
    opacity: 0.6,
  },

  /* ── Layout ── */
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 36,
  },
  topGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  bottomGroup: {
    paddingTop: 8,
  },

  /* ── Header ── */
  header: {
    marginBottom: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 0,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  logoTextBlock: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.2,
  },
  brandTagline: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '400',
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  heroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  heroBadgeText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  /* ── Hero copy ── */
  heroSection: {
    marginBottom: 0,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 50,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  heroTitleAccent: {
    color: '#0369a1',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 25,
    fontWeight: '400',
  },

  /* ── Service chips ── */
  chipsScroll: {
    marginBottom: 36,
    marginHorizontal: -24,
  },
  chipsContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  chipMore: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
  },
  chipMoreText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },

  ctaHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 18,
  },

  /* Customer card */
  customerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    ...Platform.select({
      ios: {
        shadowColor: '#0369a1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  customerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  customerIconBubble: {
    backgroundColor: '#EFF6FF',
  },
  customerCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  customerCardSub: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '400',
    lineHeight: 18,
  },
  customerCardArrow: {
    backgroundColor: '#EFF6FF',
  },

  /* Mistri card */
  mistriCard: {
    backgroundColor: '#14532d',
    borderRadius: 18,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#14532d',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  mistriCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  mistriIconBubble: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mistriCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 3,
  },
  mistriCardSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '400',
    lineHeight: 18,
  },
  mistriCardArrow: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  /* Shared card pieces */
  cardIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTextBlock: {
    flex: 1,
  },
  cardArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Trust badges */
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },

  /* Terms */
  termsText: {
    fontSize: 11,
    color: '#b0b8c5',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  termsLink: {
    color: '#64748b',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
