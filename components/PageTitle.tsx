import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import {
    mistriDashboardColors,
    mistriDashboardElevation,
} from '../lib/mistriDashboardTokens';

interface PageTitleProps {
    title: string;
    subtitle?: string;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    style?: ViewStyle;
    /** Matches mistri home header chrome (shadow, typography, spacing). */
    variant?: 'default' | 'mistri';
}

export const PageTitle: React.FC<PageTitleProps> = ({
    title,
    subtitle,
    leftElement,
    rightElement,
    style,
    variant = 'default',
}) => {
    const isMistri = variant === 'mistri';
    return (
        <View
            style={[
                styles.container,
                isMistri && styles.containerMistri,
                style,
            ]}
        >
            {leftElement && (
                <View style={[styles.leftElement, isMistri && styles.leftElementMistri]}>
                    {leftElement}
                </View>
            )}
            <View style={styles.leftContent}>
                <Text style={[styles.title, isMistri && styles.titleMistri]}>{title}</Text>
                {subtitle && (
                    <Text
                        style={[styles.subtitle, isMistri && styles.subtitleMistri]}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
            {rightElement && (
                <View style={styles.rightContent}>
                    {rightElement}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    containerMistri: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 0,
        backgroundColor: mistriDashboardColors.surface,
        boxShadow: mistriDashboardElevation.header,
    },
    leftElement: {
        marginRight: 12,
    },
    leftElementMistri: {
        marginRight: 10,
    },
    leftContent: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    titleMistri: {
        fontSize: 21,
        fontWeight: '700',
        letterSpacing: -0.45,
        color: mistriDashboardColors.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    subtitleMistri: {
        fontSize: 12,
        color: mistriDashboardColors.muted,
    },
    rightContent: {
        marginLeft: 12,
    },
});

