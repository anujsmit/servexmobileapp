import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTargetedRequestsQuery, useMistriProfileQuery } from '../../../../hooks/queries';
import { useMistriTradeTheme } from '../../../../context/MistriTradeThemeContext';

function NotificationBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
    );
}

export default function MistriTabLayout() {
    const insets = useSafeAreaInsets();
    const tabBarHeight = 56 + insets.bottom;
    const trade = useMistriTradeTheme();

    // Fetch mistri profile to determine polling status
    const { data: profile } = useMistriProfileQuery();
    // Only poll when mistri is available (not unavailable or on_work)
    const shouldPoll = profile?.availabilityStatus === 'available';
    const { data: targetedRequests } = useTargetedRequestsQuery({ enablePolling: shouldPoll });
    // Count only pending requests (not accepted, completed, or declined)
    const pendingCount = targetedRequests?.filter((req: any) =>
        req.status === 'pending' || req.status === 'targeted'
    ).length || 0;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: trade.accent,
                tabBarInactiveTintColor: '#6b7280',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopWidth: 1,
                    borderTopColor: '#e5e7eb',
                    height: tabBarHeight,
                    paddingBottom: insets.bottom,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="requests"
                options={{
                    title: 'Requests',
                    tabBarIcon: ({ color, size }) => (
                        <View>
                            <Ionicons name="notifications-outline" size={size} color={color} />
                            <NotificationBadge count={pendingCount} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="my-jobs"
                options={{
                    title: 'My jobs',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="briefcase-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="reviews"
                options={{
                    title: 'Reviews',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="star" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        right: -8,
        top: -4,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
});
