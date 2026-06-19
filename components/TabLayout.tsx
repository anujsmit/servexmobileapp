import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import React from 'react';

export interface TabConfig {
    name: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
}

interface TabLayoutProps {
    tabs: TabConfig[];
    activeTintColor: string;
    children?: React.ReactNode;
}

export function TabLayout({ tabs, activeTintColor, children }: TabLayoutProps) {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: activeTintColor,
                tabBarInactiveTintColor: '#6b7280',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopWidth: 1,
                    borderTopColor: '#e5e7eb',
                    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
                    height: Platform.OS === 'ios' ? 85 : 60,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
            }}
        >
            {tabs.map((tab) => (
                <Tabs.Screen
                    key={tab.name}
                    name={tab.name}
                    options={{
                        title: tab.title,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name={tab.icon} size={size} color={color} />
                        ),
                    }}
                />
            ))}
            {children}
        </Tabs>
    );
}
