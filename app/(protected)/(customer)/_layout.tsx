import { Stack, usePathname } from 'expo-router';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomBottomNavbar, { shouldShowNavbar } from '../../../components/CustomBottomNavbarCustomer';

const { width } = Dimensions.get('window');

export default function CustomerLayout() {
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    
    // Check if the navbar is active on the current page
    const isNavbarVisible = shouldShowNavbar(pathname);
    
    // Calculate navbar height including its bottom position
    const navbarHeight = 70; // Height from CustomBottomNavbar container
    const navbarBottom = Math.max(insets.bottom, 16); // Bottom offset from CustomBottomNavbar
    
    // Only apply padding space if the navbar should actually be shown on this page
    const totalNavbarSpace = isNavbarVisible ? (navbarHeight + navbarBottom + 16) : 0;

    return (
        <View style={styles.container}>
            {/* The main screen stack content with conditional bottom padding */}
            <View style={[styles.content, { paddingBottom: totalNavbarSpace }]}>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        animation: 'none',
                    }}
                />
            </View>

            {/* Render the floating custom navbar over the layout */}
            <CustomBottomNavbar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        flex: 1,
    },
});