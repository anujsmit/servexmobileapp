import React, { useEffect } from 'react';
import { Stack, useRouter } from "expo-router";
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SearchProvider } from '../context/SearchContext';
import { ServicesProvider } from '../context/ServicesContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from "expo-status-bar";
import { LoadingGuard } from '../components/AuthGuard';
import { Platform, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

SplashScreen.preventAutoHideAsync().catch(() => { });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});

function AppLayout() {
  const { isLoading, user } = useAuth();
  const router = useRouter();

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
          if (__DEV__) console.log('Customer notification tapped for request:', requestId);
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

// root lyout with auth context 
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider>
          <AuthProvider>
            <SearchProvider>
              <AppLayout />
            </SearchProvider>
          </AuthProvider>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
