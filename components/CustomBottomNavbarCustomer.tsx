import React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Text,
    Dimensions,
    Platform,
} from 'react-native';

import {
    usePathname,
    useRouter,
} from 'expo-router';

import {
    Ionicons,
    MaterialIcons,
} from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// DEFINING BLUE THEME FOR ACTIVE TABS
const ACTIVE_BLUE = '#2563eb';
const ACTIVE_BLUE_BG = '#2563eb15';
const INACTIVE_COLOR = '#94a3b8';
const INACTIVE_LABEL = '#64748b';

const TABS = [
    {
        label: 'Home',
        icon: 'home-outline',
        activeIcon: 'home',
        type: 'ion',
        path: '/(protected)/(customer)',
    },
    {
        label: 'Services',
        icon: 'miscellaneous-services',
        activeIcon: 'miscellaneous-services',
        type: 'material',
        path: '/(protected)/(customer)/services',
    },
    {
        label: 'Requests',
        icon: 'receipt-long',
        activeIcon: 'receipt-long',
        type: 'material',
        path: '/(protected)/(customer)/requests',
    },
    {
        label: 'Settings',
        icon: 'person-outline',
        activeIcon: 'person',
        type: 'ion',
        path: '/(protected)/(customer)/settings',
    },
];

export default function CustomBottomNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const activeIndex = TABS.findIndex((tab) => {
        if (tab.path === '/(protected)/(customer)') {
            return pathname === '/(protected)/(customer)' || pathname === '/(protected)/(customer)/';
        }
        return pathname.startsWith(tab.path);
    });

    const handleNavigation = (path) => {
        if (pathname !== path) {
            router.replace(path);
        }
    };

    const renderIcon = (tab, isActive) => {
        const color = isActive ? ACTIVE_BLUE : INACTIVE_COLOR;
        const iconName = isActive ? tab.activeIcon : tab.icon;

        if (tab.type === 'ion') {
            return (
                <Ionicons
                    name={iconName}
                    size={24}
                    color={color}
                />
            );
        }

        return (
            <MaterialIcons
                name={iconName}
                size={24}
                color={color}
            />
        );
    };

    return (
        <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.container}>
                {TABS.map((tab, index) => {
                    const isActive = index === activeIndex;

                    return (
                        <TouchableOpacity
                            key={tab.label}
                            style={styles.tabButton}
                            activeOpacity={0.7}
                            onPress={() => handleNavigation(tab.path)}
                        >
                            <View style={styles.tabContent}>
                                <View
                                    style={[
                                        styles.iconWrapper,
                                        isActive && styles.activeIconWrapper,
                                    ]}
                                >
                                    {renderIcon(tab, isActive)}
                                </View>

                                <Text
                                    style={[
                                        styles.label,
                                        isActive && styles.activeLabel,
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        width: width - 32,
        height: 70,
        backgroundColor: '#ffffff',
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 4,
        // Enhanced shadow for better depth
        shadowColor: '#000',
        shadowOffset: { 
            width: 0, 
            height: Platform.OS === 'ios' ? 2 : 4,
        },
        shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.15,
        shadowRadius: Platform.OS === 'ios' ? 12 : 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
    },
    tabButton: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 6,
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 44,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
        // Transition for smooth state changes
        backgroundColor: 'transparent',
    },
    activeIconWrapper: {
        backgroundColor: ACTIVE_BLUE_BG,
        // Optional: add a subtle scale animation effect
        transform: [{ scale: 1 }],
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
        color: INACTIVE_LABEL,
        letterSpacing: -0.1,
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    activeLabel: {
        color: ACTIVE_BLUE,
        fontWeight: '700',
    },
});