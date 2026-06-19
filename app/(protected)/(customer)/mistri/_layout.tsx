import { Stack } from 'expo-router';

export default function MistriLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}
