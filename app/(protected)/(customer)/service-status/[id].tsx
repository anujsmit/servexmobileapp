// app/(protected)/(customer)/service-status/[id].tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width: screenWidth } = Dimensions.get('window');

interface ServiceRequest {
  id: string;
  type: string;
  address: string;
  status: string;
  paymentAmount: string;
  customerNotes: string;
  adminNotes: string;
  createdAt: string;
  assignedAt: string;
  startedWorkAt: string;
  completedAt: string;
  assignedMistriId: string;
  mistriDetails?: {
    id: string;
    fullName: string;
    phoneNumber: string;
    profilePhotoUrl: string;
    averageRating: string;
  };
}

// Define status mapping with blue theme
const getStatusDetails = (status: string) => {
  const statusMap: Record<string, { label: string; color: string; icon: string }> = {
    'pending_approval': { 
      label: 'Awaiting Admin Approval', 
      color: '#f59e0b', 
      icon: 'time-outline' 
    },
    'pending': { 
      label: 'Awaiting Admin Approval', 
      color: '#f59e0b', 
      icon: 'time-outline' 
    },
    'assigned': { 
      label: 'Professional Assigned', 
      color: '#3b82f6', 
      icon: 'people-outline' 
    },
    'started': { 
      label: 'Work in Progress', 
      color: '#8b5cf6', 
      icon: 'construct-outline' 
    },
    'completed': { 
      label: 'Completed', 
      color: '#10b981', 
      icon: 'checkmark-circle-outline' 
    },
    'canceled': { 
      label: 'Canceled', 
      color: '#ef4444', 
      icon: 'close-circle-outline' 
    },
    'rejected': { 
      label: 'Rejected', 
      color: '#ef4444', 
      icon: 'close-circle-outline' 
    },
  };
  
  return statusMap[status] || { 
    label: status || 'Unknown Status', 
    color: '#94a3b8', 
    icon: 'help-circle-outline' 
  };
};

export default function ServiceStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token, refreshAccessToken, logout } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set header title
  useEffect(() => {
    navigation.setOptions({
      title: 'Service Status',
      headerBackTitle: 'Back',
    });
  }, [navigation]);

  useEffect(() => {
    if (id) {
      fetchRequestStatus();
      
      // Poll every 30 seconds for updates
      const interval = setInterval(fetchRequestStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    let currentToken = token;
    if (!currentToken) {
      throw new Error('No token available');
    }
    
    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          'Authorization': `Bearer ${authToken}`,
        },
      });
    };

    let response = await makeRequest(currentToken);
    
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        await logout();
        router.replace('/(auth)/login');
        throw new Error('Session expired. Please login again.');
      }
    }
    return response;
  };

  const fetchRequestStatus = async () => {
    try {
      setError(null);
      
      const url = `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/service-requests/${id}`;
      console.log('📡 Fetching from:', url);
      
      const response = await makeAuthenticatedRequest(url);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Received HTML instead of JSON - endpoint may not exist');
        throw new Error('Service endpoint not found. Please check the API URL.');
      }
      
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (response.ok && data.success) {
        setRequest(data.request);
        if (data.mistriDetails) {
          setRequest(prev => prev ? { ...prev, mistriDetails: data.mistriDetails } : null);
        }
      } else {
        setError(data.message || 'Failed to load request');
      }
    } catch (error: any) {
      console.error('Error fetching request status:', error);
      
      if (error.message?.includes('JSON Parse error') || error.message?.includes('Unexpected character')) {
        setError('API endpoint not found. Please check your server configuration.');
      } else if (error.message?.includes('Session expired')) {
        return;
      } else {
        setError(error.message || 'Network error. Please pull to refresh.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequestStatus();
  };

  const getStatusStep = () => {
    const steps = [
      { key: 'pending', label: 'Request Submitted', icon: 'checkmark-circle-outline' },
      { key: 'assigned', label: 'Professional Assigned', icon: 'people-outline' },
      { key: 'started', label: 'Work Started', icon: 'construct-outline' },
      { key: 'completed', label: 'Completed', icon: 'checkbox-outline' },
    ];
    
    let currentIndex = 0;
    if (request?.status === 'assigned') currentIndex = 1;
    if (request?.startedWorkAt) currentIndex = 2;
    if (request?.status === 'completed') currentIndex = 3;
    
    return { steps, currentIndex };
  };

  const statusInfo = getStatusDetails(request?.status || 'pending');

  const callMistri = () => {
    if (request?.mistriDetails?.phoneNumber) {
      Linking.openURL(`tel:${request.mistriDetails.phoneNumber}`);
    }
  };

  const goBack = () => {
    router.back();
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading request details...</Text>
      </View>
    );
  }

  // Error state
  if (error || !request) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={48} color="#dc2626" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error || 'Request not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { steps, currentIndex } = getStatusStep();

  return (
    <>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
      >
        {/* Status Header with Blue Gradient */}
        <LinearGradient
          colors={['#1a56db', '#2563eb']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Service Status</Text>
            <View style={[styles.headerStatusBadge, { backgroundColor: statusInfo.color + '30' }]}>
              <Ionicons name={statusInfo.icon as any} size={20} color="#fff" />
              <Text style={styles.headerStatusText}>{statusInfo.label}</Text>
            </View>
            <Text style={styles.headerId}>Request #{request.id.slice(-8).toUpperCase()}</Text>
          </View>
        </LinearGradient>

        {/* Progress Steps */}
        <View style={styles.progressCard}>
          {steps.map((step, index) => (
            <View key={step.key} style={styles.stepContainer}>
              <View style={styles.stepIconContainer}>
                <View style={[
                  styles.stepCircle,
                  index <= currentIndex && styles.stepCircleActive,
                ]}>
                  {index < currentIndex ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Ionicons
                      name={step.icon as any}
                      size={18}
                      color={index <= currentIndex ? '#fff' : '#94a3b8'}
                    />
                  )}
                </View>
                {index < steps.length - 1 && (
                  <View style={[
                    styles.stepLine,
                    index < currentIndex && styles.stepLineActive,
                  ]} />
                )}
              </View>
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepLabel,
                  index <= currentIndex && styles.stepLabelActive,
                ]}>
                  {step.label}
                </Text>
                {index === currentIndex && (
                  <View style={styles.stepCurrentBadge}>
                    <Text style={styles.stepCurrent}>Current</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Assigned Professional Details */}
        {request.mistriDetails && request.status !== 'pending' && request.status !== 'canceled' && request.status !== 'rejected' && (
          <View style={styles.mistriCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="person" size={18} color="#2563eb" /> Assigned Professional
            </Text>
            <View style={styles.mistriInfo}>
              <View style={styles.mistriAvatar}>
                {request.mistriDetails.profilePhotoUrl ? (
                  <Image source={{ uri: request.mistriDetails.profilePhotoUrl }} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarText}>
                    {request.mistriDetails.fullName?.charAt(0).toUpperCase() || 'M'}
                  </Text>
                )}
              </View>
              <View style={styles.mistriDetails}>
                <Text style={styles.mistriName}>{request.mistriDetails.fullName}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text style={styles.ratingText}>
                    {request.mistriDetails.averageRating || 'New'} 
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callButton} onPress={callMistri}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Payment Details */}
        {request.paymentAmount && (
          <View style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="cash" size={18} color="#2563eb" /> Payment Details
            </Text>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Total Amount</Text>
              <Text style={styles.paymentAmount}>
                रु {parseFloat(request.paymentAmount).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.paymentNote}>
              💳 Payment to be made directly to the professional after service completion
            </Text>
          </View>
        )}

        {/* Service Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="information-circle" size={18} color="#2563eb" /> Service Details
          </Text>
          <View style={styles.detailRow}>
            <Ionicons name="build" size={18} color="#64748b" />
            <Text style={styles.detailText}>{request.type}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location" size={18} color="#64748b" />
            <Text style={styles.detailText}>{request.address}</Text>
          </View>
          {request.customerNotes && (
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={18} color="#64748b" />
              <Text style={styles.detailText}>{request.customerNotes}</Text>
            </View>
          )}
          {request.adminNotes && (
            <View style={styles.adminNoteContainer}>
              <Ionicons name="information-circle" size={18} color="#2563eb" />
              <Text style={styles.adminNoteText}>{request.adminNotes}</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time" size={18} color="#2563eb" /> Timeline
          </Text>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>📋 Requested</Text>
            <Text style={styles.timelineValue}>
              {new Date(request.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          {request.assignedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>👤 Assigned</Text>
              <Text style={styles.timelineValue}>
                {new Date(request.assignedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {request.startedWorkAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>🔨 Work Started</Text>
              <Text style={styles.timelineValue}>
                {new Date(request.startedWorkAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {request.completedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>✅ Completed</Text>
              <Text style={styles.timelineValue}>
                {new Date(request.completedAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonPrimary]} 
            onPress={() => router.push('/(protected)/(customer)')}
          >
            <Ionicons name="home" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Back to Home</Text>
          </TouchableOpacity>
          
          {request.status === 'completed' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => {
                router.push(`/(protected)/(customer)/review/${request.id}`);
              }}
            >
              <Ionicons name="star" size={20} color="#2563eb" />
              <Text style={[styles.actionButtonText, { color: '#2563eb' }]}>Leave a Review</Text>
            </TouchableOpacity>
          )}

          {/* Show "Book Again" button for completed requests */}
          {request.status === 'completed' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonTertiary]}
              onPress={() => {
                router.push('/(protected)/(customer)/services');
              }}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Book Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f4f8', 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#f0f4f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 12,
  },
  errorText: { 
    fontSize: 14, 
    color: '#64748b', 
    textAlign: 'center', 
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  retryButton: { 
    marginTop: 16, 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    backgroundColor: '#2563eb', 
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },
  backButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#64748b',
    fontWeight: '500',
    fontSize: 16,
  },
  
  // Header Styles
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  headerStatusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  headerId: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  
  // Progress Card
  progressCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    margin: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  stepContainer: { 
    flexDirection: 'row', 
    marginBottom: 4,
  },
  stepIconContainer: { 
    alignItems: 'center', 
    marginRight: 12,
  },
  stepCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#e2e8f0', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 2,
  },
  stepCircleActive: { 
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  stepLine: { 
    width: 2, 
    height: 32, 
    backgroundColor: '#e2e8f0', 
    marginTop: -2,
  },
  stepLineActive: { 
    backgroundColor: '#2563eb',
  },
  stepContent: { 
    flex: 1, 
    justifyContent: 'center',
    paddingBottom: 12,
  },
  stepLabel: { 
    fontSize: 14, 
    color: '#94a3b8',
  },
  stepLabelActive: { 
    color: '#0f172a', 
    fontWeight: '600',
  },
  stepCurrentBadge: {
    marginTop: 2,
  },
  stepCurrent: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: '700',
    backgroundColor: '#2563eb15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  
  // Mistri Card
  mistriCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#0f172a', 
    marginBottom: 12,
  },
  mistriInfo: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  mistriAvatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#2563eb', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  mistriDetails: { 
    flex: 1,
  },
  mistriName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#0f172a',
  },
  ratingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 4,
    gap: 4,
  },
  ratingText: { 
    fontSize: 12, 
    color: '#64748b',
  },
  callButton: { 
    backgroundColor: '#2563eb', 
    padding: 12,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  
  // Payment Card
  paymentCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  paymentRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8,
  },
  paymentLabel: { 
    fontSize: 14, 
    color: '#64748b',
  },
  paymentAmount: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#2563eb',
  },
  paymentNote: { 
    fontSize: 12, 
    color: '#94a3b8', 
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
  },
  
  // Details Card
  detailsCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  detailRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10,
    gap: 10,
  },
  detailText: { 
    flex: 1, 
    fontSize: 14, 
    color: '#334155',
  },
  adminNoteContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#f0f2f5',
    gap: 10,
  },
  adminNoteText: { 
    flex: 1, 
    fontSize: 13, 
    color: '#2563eb', 
    fontStyle: 'italic',
  },
  
  // Timeline Card
  timelineCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  timelineItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 8,
    paddingVertical: 4,
  },
  timelineLabel: { 
    fontSize: 13, 
    color: '#64748b',
  },
  timelineValue: { 
    fontSize: 13, 
    color: '#0f172a',
    fontWeight: '500',
  },
  
  // Action Buttons
  actionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  actionButtonTertiary: {
    backgroundColor: '#1e293b',
    shadowColor: '#1e293b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});