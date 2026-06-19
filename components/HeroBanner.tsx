import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Image,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { API_BASE_URL } from '../lib/config';
import {
    customerBrand,
    customerDashboardColors as C,
    customerDashboardElevation as ELEV,
} from '../lib/customerDashboardTokens';

const H_INSET = 16;
const CARD_HEIGHT = 176;
const SECTION_PADDING_TOP = 12;
const SECTION_PADDING_BOTTOM = 10;

interface Banner {
    id: string;
    imageUrl: string;
    title?: string;
    subtitle?: string;
    linkUrl?: string;
}

export const HeroBanner: React.FC = () => {
    const { width: windowWidth } = useWindowDimensions();
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchBanners = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/hero-banners`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                if (!cancelled) setBanners(data.banners ?? []);
            } catch {
                // silently fall back to no banners
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchBanners();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(() => {
            setActiveIndex((current) => {
                const next = (current + 1) % banners.length;
                scrollViewRef.current?.scrollTo({ x: next * windowWidth, animated: true });
                return next;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [banners.length, windowWidth]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / windowWidth);
        setActiveIndex(index);
    };

    const cardShellStyle = {
        marginHorizontal: H_INSET,
        height: CARD_HEIGHT,
        borderRadius: 16,
        borderCurve: 'continuous' as const,
        overflow: 'hidden' as const,
        borderWidth: 1,
        borderColor: C.cardBorder,
        boxShadow: ELEV.card,
    };

    if (loading) {
        return (
            <View style={styles.section}>
                <View style={[styles.cardShell, cardShellStyle]}>
                    <View style={styles.loadingInner}>
                        <ActivityIndicator size="small" color={customerBrand.accent} />
                    </View>
                </View>
            </View>
        );
    }

    if (banners.length === 0) return null;

    return (
        <View style={styles.section}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentInsetAdjustmentBehavior="automatic"
                style={styles.slider}
            >
                {banners.map((banner) => (
                    <View key={banner.id} style={[styles.slidePage, { width: windowWidth }]}>
                        <TouchableOpacity activeOpacity={0.92} style={styles.cardPressable}>
                            <View style={[styles.cardShell, cardShellStyle]}>
                                <Image
                                    source={{ uri: banner.imageUrl }}
                                    style={styles.bannerImage}
                                    resizeMode="cover"
                                />
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            {banners.length > 1 && (
                <View style={styles.pagination}>
                    {banners.map((_, index) => (
                        <View
                            key={index}
                            style={[styles.dot, index === activeIndex && styles.activeDot]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    section: {
        width: '100%',
        paddingTop: SECTION_PADDING_TOP,
        paddingBottom: SECTION_PADDING_BOTTOM,
        backgroundColor: C.canvas,
    },
    slider: {
        backgroundColor: C.canvas,
    },
    slidePage: {
        backgroundColor: C.canvas,
    },
    cardShell: {
        backgroundColor: C.cardFill,
    },
    cardPressable: {
        width: '100%',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    loadingInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: CARD_HEIGHT,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
        paddingHorizontal: H_INSET,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(15, 23, 42, 0.2)',
    },
    activeDot: {
        backgroundColor: customerBrand.accent,
        width: 22,
    },
});
