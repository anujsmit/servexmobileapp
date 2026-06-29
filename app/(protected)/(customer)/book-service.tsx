// app/(protected)/(customer)/book-service.tsx (or similar service request screen)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { useLocation } from '../../../context/LocationContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function BookServiceScreen() {
  const { user } = useAuth();
  const { address, coordinates } = useLocation();
  const router = useRouter();
  
  const [selectedService, setSelectedService] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlatformServices, setSelectedPlatformServices] = useState<string[]>([]);

  const createServiceRequest = async () => {
    if (!selectedService) {
      Alert.alert('Error', 'Please select a service type');
      return;
    }

    if (!address) {
      Alert.alert('Error', 'Please enable location services');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/users/service-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          type: selectedService,
          platformServiceIds: selectedPlatformServices,
          coords: {
            lat: coordinates?.lat || 27.7172,
            lng: coordinates?.lng || 85.324,
          },
          address: address,
          source: 'gps',
          customerNotes: customerNotes,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          'Request Submitted',
          'Your service request has been submitted for admin approval. You will be notified once a mistri is assigned.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(protected)/(customer)/dashboard'),
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to create service request');
      }
    } catch (error) {
      console.error('Error creating service request:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Book a Service</Text>
      <Text style={styles.subtitle}>We'll find the best professional for you</Text>

      {/* Service Selection UI - Your existing service selection UI */}
      
      <TouchableOpacity
        style={styles.submitButton}
        onPress={createServiceRequest}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Request</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        Note: Your request will be reviewed by an admin. You'll receive a notification with the price and assigned professional.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  submitButton: {
    backgroundColor: '#e67e22',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
  },
});