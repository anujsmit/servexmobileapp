// app/_layout.tsx

import React, { useEffect, useRef } from 'react';
import { Stack, useRouter } from "expo-router";
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SearchProvider } from '../context/SearchContext';
import { ServicesProvider } from '../context/ServicesContext';
import { LocationProvider } from '../context/LocationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from "expo-status-bar";
import { LoadingGuard } from '../components/AuthGuard';
import { Platform, LogBox, AppState, AppStateStatus } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => { });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function AppLayout() {
  const { isLoading, user, token, refreshAccessToken } = useAuth();
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const isMounted = useRef(true);

  // ✅ Handle splash screen hide
  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      if (!cancelled && Platform.OS !== 'web') {
        await SplashScreen.hideAsync();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading]);

  // ✅ Handle app state changes - keep session alive
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // When app comes to foreground
      if (appState.current.match(/background/) && nextAppState === 'active') {
        console.log('📱 App came to foreground, checking session...');
        
        // If we have a token but no user, try to refresh
        if (token && !user) {
          console.log('📱 Token exists but no user, refreshing...');
          await refreshAccessToken();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [token, user, refreshAccessToken]);

  // ✅ Handle push notification responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.id) {
        const requestId = data.id as string;

        if (user?.role === 'mistri') {
          router.push({
            pathname: '/(protected)/(mistri)/job-details',
            params: { requestId },
          });
        } else if (user?.role === 'user') {
          router.push({
            pathname: '/(protected)/(customer)/service-status',
            params: { id: requestId },
          });
        }
      }
    });

    return () => subscription.remove();
  }, [user?.role, router]);

  return (
    <LoadingGuard>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          gestureEnabled: true,
          contentStyle: {
            backgroundColor: 'transparent',
          }
        }}
      />
    </LoadingGuard>
  );
}

// Root layout with auth context - ✅ FIXED order
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider>
          <LocationProvider>
            <AuthProvider>
              <SearchProvider>
                <AppLayout />
              </SearchProvider>
            </AuthProvider>
          </LocationProvider>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}