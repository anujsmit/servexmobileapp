import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SearchingAnimationProps {
    onComplete?: () => void;
    duration?: number; // Duration in milliseconds (default 2500)
}

export const SearchingAnimation: React.FC<SearchingAnimationProps> = ({
    onComplete,
    duration = 2500,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulsing animation for the center circle
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );

        // Rotating animation for orbit dots
        const rotateAnimation = Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            })
        );

        pulseAnimation.start();
        rotateAnimation.start();

        // Call onComplete after duration
        const timer = setTimeout(() => {
            onComplete?.();
        }, duration);

        return () => {
            pulseAnimation.stop();
            rotateAnimation.stop();
            clearTimeout(timer);
        };
    }, [duration, onComplete]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            <View style={styles.animationContainer}>
                {/* Outer rotating circle with dots */}
                <Animated.View style={[styles.orbitCircle, { transform: [{ rotate }] }]}>
                    <View style={[styles.dot, styles.dotTop]} />
                    <View style={[styles.dot, styles.dotRight]} />
                    <View style={[styles.dot, styles.dotBottom]} />
                    <View style={[styles.dot, styles.dotLeft]} />
                </Animated.View>

                {/* Center pulsing circle */}
                <Animated.View
                    style={[
                        styles.centerCircle,
                        { transform: [{ scale: pulseAnim }] },
                    ]}
                >
                    <MaterialIcons name="search" size={40} color="#ffffff" />
                </Animated.View>
            </View>

            <Text style={styles.searchingText}>Searching for nearby mistris...</Text>
            <View style={styles.dotsContainer}>
                <Animated.View style={styles.loadingDot} />
                <Animated.View style={[styles.loadingDot, { opacity: 0.7 }]} />
                <Animated.View style={[styles.loadingDot, { opacity: 0.4 }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        paddingVertical: 60,
    },
    animationContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    orbitCircle: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 2,
        borderColor: '#dbeafe',
        borderStyle: 'dashed',
    },
    dot: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#2563eb',
    },
    dotTop: {
        top: -6,
        left: '50%',
        marginLeft: -6,
    },
    dotRight: {
        right: -6,
        top: '50%',
        marginTop: -6,
    },
    dotBottom: {
        bottom: -6,
        left: '50%',
        marginLeft: -6,
    },
    dotLeft: {
        left: -6,
        top: '50%',
        marginTop: -6,
    },
    centerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#2563eb',
        justifyContent: 'center',
        alignItems: 'center',
                                            },
    searchingText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    loadingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2563eb',
    },
});
