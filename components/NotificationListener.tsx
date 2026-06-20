// components/NotificationListener.tsx
import { useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function NotificationListener() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Handle notifications when app is in foreground
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const { type, requestId } = notification.request.content.data;
      
      if (type === 'request_assigned') {
        Alert.alert(
          'Service Request Approved! 🎉',
          'Your service request has been approved and assigned to a professional.',
          [
            {
              text: 'View Details',
              onPress: () => router.push(`/service-status/${requestId}`),
            },
          ]
        );
      } else if (type === 'request_rejected') {
        Alert.alert(
          'Service Request Update',
          'Your service request could not be processed. Please contact support.',
          [{ text: 'OK' }]
        );
      }
    });

    // Handle notification response (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { type, requestId } = response.notification.request.content.data;
      
      if (requestId) {
        router.push(`/service-status/${requestId}`);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return null;
}