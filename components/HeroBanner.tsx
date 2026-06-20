// components/HeroBanner.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface Banner {
    id: string;
    title: string | null;
    subtitle: string | null;
    imageUrl: string;
    videoUrl: string | null;
    linkUrl: string | null;
    displayOrder: number;
    isActive: boolean;
    adType: 'ad1' | 'ad2' | 'both';
}

interface HeroBannerProps {
    banners: Banner[];
    autoScroll?: boolean;
    interval?: number;
    onBannerPress?: (banner: Banner) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
    banners,
    autoScroll = true,
    interval = 3000,
    onBannerPress,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Filter out inactive banners
    const activeBanners = banners.filter(b => b.isActive !== false);

    useEffect(() => {
        if (autoScroll && activeBanners.length > 1) {
            timerRef.current = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
            }, interval);
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [autoScroll, activeBanners.length, interval]);

    useEffect(() => {
        if (flatListRef.current && activeBanners.length > 0) {
            flatListRef.current.scrollToIndex({
                index: currentIndex,
                animated: true,
            });
        }
    }, [currentIndex]);

    const renderBanner = ({ item }: { item: Banner }) => {
        const isVideoAd = item.videoUrl && item.adType === 'ad2';

        return (
            <TouchableOpacity
                style={styles.bannerContainer}
                activeOpacity={0.9}
                onPress={() => onBannerPress?.(item)}
                disabled={!onBannerPress}
            >
                {item.imageUrl ? (
                    <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.bannerImage}
                        resizeMode="cover"
                    />
                ) : (
                    <LinearGradient
                        colors={['#e67e22', '#f39c12']}
                        style={styles.bannerPlaceholder}
                    >
                        <MaterialIcons name="image" size={40} color="rgba(255,255,255,0.5)" />
                    </LinearGradient>
                )}

                {isVideoAd && (
                    <View style={styles.videoBadge}>
                        <MaterialIcons name="play-circle" size={20} color="#fff" />
                        <Text style={styles.videoBadgeText}>Video</Text>
                    </View>
                )}

                {(item.title || item.subtitle) && (
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.overlay}
                    >
                        <View style={styles.textContainer}>
                            {item.title && (
                                <Text style={styles.bannerTitle} numberOfLines={1}>
                                    {item.title}
                                </Text>
                            )}
                            {item.subtitle && (
                                <Text style={styles.bannerSubtitle} numberOfLines={1}>
                                    {item.subtitle}
                                </Text>
                            )}
                        </View>
                    </LinearGradient>
                )}
            </TouchableOpacity>
        );
    };

    if (activeBanners.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No banners available</Text>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <FlatList
                ref={flatListRef}
                data={activeBanners}
                renderItem={renderBanner}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={activeBanners.length > 1}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(
                        event.nativeEvent.contentOffset.x / screenWidth
                    );
                    setCurrentIndex(index);
                }}
                getItemLayout={(_, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                })}
            />
            {activeBanners.length > 1 && (
                <View style={styles.dotsContainer}>
                    {activeBanners.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentIndex && styles.activeDot,
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
    },
    bannerContainer: {
        width: screenWidth - 40,
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        marginHorizontal: 0,
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        minHeight: 60,
        justifyContent: 'flex-end',
    },
    textContainer: {
        gap: 2,
    },
    bannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    bannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    videoBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    videoBadgeText: {
        fontSize: 10,
        color: '#ffffff',
        fontWeight: '600',
    },
    dotsContainer: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    activeDot: {
        backgroundColor: '#ffffff',
        width: 18,
    },
    emptyContainer: {
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 14,
    },
});