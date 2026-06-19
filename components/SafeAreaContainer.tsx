import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, setStatusBarBackgroundColor, setStatusBarTranslucent } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

interface SafeAreaContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

const STATUS_BG = '#ffffff';

export function SafeAreaContainer({ children, style }: SafeAreaContainerProps) {
    useEffect(() => {
        void SystemUI.setBackgroundColorAsync(STATUS_BG);
        if (Platform.OS === 'android') {
            setStatusBarTranslucent(false);
            setStatusBarBackgroundColor(STATUS_BG);
        }
    }, []);

    return (
        <SafeAreaView style={[styles.container, style]} edges={['right', 'left', 'top']}>
            <StatusBar style="dark" backgroundColor={STATUS_BG} translucent={Platform.OS === 'android' ? false : undefined} />
            {children}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: STATUS_BG,
    },
});
