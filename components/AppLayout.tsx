import React from 'react';
import {
    View,
    StyleSheet,
} from 'react-native';
import { usePathname } from 'expo-router';
import CustomBottomNavbar, { shouldShowNavbar } from './CustomBottomNavbarCustomer';

interface Props {
    children: React.ReactNode;
}

export default function AppLayout({
    children,
}: Props) {
    const pathname = usePathname();
    const showNavbar = shouldShowNavbar(pathname);
    const contentPaddingBottom = showNavbar ? 95 : 0;

    return (
        <View style={styles.container}>
            <View style={[styles.content, { paddingBottom: contentPaddingBottom }]}>
                {children}
            </View>

            {showNavbar && <CustomBottomNavbar />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});