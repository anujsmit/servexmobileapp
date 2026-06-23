// components/CustomBottomNavbar.tsx

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
const INACTIVE_COLOR = '#94a3b8';
const INACTIVE_LABEL = '#64748b';

// ✅ Updated paths to match what usePathname() returns
const TABS = [
    {
        label: 'Home',
        icon: 'home-outline',
        activeIcon: 'home',
        type: 'ion',
        path: '/',
        exact: true,
    },
    {
        label: 'Services',
        icon: 'miscellaneous-services',
        activeIcon: 'miscellaneous-services',
        type: 'material',
        path: '/services',
        exact: false,
    },
    {
        label: 'Requests',
        icon: 'receipt-long',
        activeIcon: 'receipt-long',
        type: 'material',
        path: '/requests',
        exact: false,
    },
    {
        label: 'Settings',
        icon: 'person-outline',
        activeIcon: 'person',
        type: 'ion',
        path: '/settings',
        exact: false,
    },
];

// ✅ Pages where the navbar should be shown
const NAVBAR_PATHS = [
    '/',
    '/services',
    '/requests',
    '/settings',
];

export default function CustomBottomNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    // ✅ Check if navbar should be shown on this page
    const shouldShowNavbar = NAVBAR_PATHS.some(path => {
        if (path === '/') {
            return pathname === '/' || pathname === '';
        }
        return pathname.startsWith(path);
    });

    // ✅ If not on a navbar page, return null (don't render anything)
    if (!shouldShowNavbar) {
        return null;
    }

    // ✅ Fixed active tab detection
    const getActiveIndex = () => {
        for (let i = 0; i < TABS.length; i++) {
            const tab = TABS[i];
            const tabPath = tab.path;
            
            // For Home tab - exact match
            if (tab.exact) {
                if (pathname === tabPath || pathname === tabPath + '/') {
                    return i;
                }
                continue;
            }
            
            // For other tabs - check if pathname starts with tab path
            if (pathname.startsWith(tabPath)) {
                return i;
            }
        }
        
        // Default to Home (index 0)
        return 0;
    };

    const activeIndex = getActiveIndex();

    const handleNavigation = (path: string) => {
        if (pathname !== path) {
            router.push(path);
        }
    };

    const renderIcon = (tab: typeof TABS[0], isActive: boolean) => {
        const color = isActive ? ACTIVE_BLUE : INACTIVE_COLOR;
        const iconName = isActive ? tab.activeIcon : tab.icon;

        if (tab.type === 'ion') {
            return (
                <Ionicons
                    name={iconName as any}
                    size={24}
                    color={color}
                />
            );
        }

        return (
            <MaterialIcons
                name={iconName as any}
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
                                {renderIcon(tab, isActive)}

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
        gap: 2,
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