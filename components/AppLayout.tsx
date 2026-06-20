import React from 'react';

import {
    View,
    StyleSheet,
} from 'react-native';

import CustomBottomNavbar from './CustomBottomNavbarCustomer';

interface Props {
    children: React.ReactNode;
}

export default function AppLayout({
    children,
}: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {children}
            </View>

            <CustomBottomNavbar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    content: {
        flex: 1,
        paddingBottom: 95,
    },
});