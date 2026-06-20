import React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Text,
    Dimensions,
} from 'react-native';

import {
    usePathname,
    useRouter,
} from 'expo-router';

import {
    Ionicons,
    MaterialIcons,
} from '@expo/vector-icons';

import { customerBrand as B } from '../lib/customerDashboardTokens';

const { width } = Dimensions.get('window');

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

    // FIXED: Strict structure matching to handle nested path groups cleanly
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
        const color = isActive ? B.accent : '#94a3b8';
        const iconName = isActive ? tab.activeIcon : tab.icon;

        if (tab.type === 'ion') {
            return (
                <Ionicons
                    name={iconName}
                    size={22}
                    color={color}
                />
            );
        }

        return (
            <MaterialIcons
                name={iconName}
                size={22}
                color={color}
            />
        );
    };

    return (
        <View style={styles.wrapper}>
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
                                        isActive && { backgroundColor: `${B.accent}10` },
                                    ]}
                                >
                                    {renderIcon(tab, isActive)}
                                </View>

                                <Text
                                    style={[
                                        styles.label,
                                        isActive && { color: B.accent, fontWeight: '700' },
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
        bottom: 20,
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        width: width - 32,
        height: 66,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    tabButton: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        letterSpacing: -0.1,
    },
});