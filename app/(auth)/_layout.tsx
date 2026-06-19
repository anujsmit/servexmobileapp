import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'none',
                gestureEnabled: false, // Disable swipe back gesture
                contentStyle: {
                    backgroundColor: 'transparent',
                }
            }}
        >
            <Stack.Screen
                name="login"
                options={{
                    // Prevent going back from login screen
                    headerBackVisible: false,
                }}
            />
        </Stack>
    );
}
