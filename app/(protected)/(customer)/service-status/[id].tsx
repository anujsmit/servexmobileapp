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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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

// Define status mapping with fallback
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
  
  // Return the status or a fallback
  return statusMap[status] || { 
    label: status || 'Unknown Status', 
    color: '#94a3b8', 
    icon: 'help-circle-outline' 
  };
};

export default function ServiceStatusScreen() {
  const { id } = useLocalSearchParams();
  const { user, token, refreshAccessToken, logout, isTokenRefreshing } = useAuth();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequestStatus();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchRequestStatus, 30000);
    return () => clearInterval(interval);
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
      // Try to refresh the token
      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        // Token refresh failed - logout
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
      
      // Check if response is HTML (usually indicates a 404 page)
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
          setRequest(prev => ({ ...prev, mistriDetails: data.mistriDetails }));
        }
      } else {
        setError(data.message || 'Failed to load request');
      }
    } catch (error: any) {
      console.error('Error fetching request status:', error);
      
      // Check if it's a JSON parse error (HTML response)
      if (error.message?.includes('JSON Parse error') || error.message?.includes('Unexpected character')) {
        setError('API endpoint not found. Please check your server configuration.');
      } else if (error.message?.includes('Session expired')) {
        // Already handled in makeAuthenticatedRequest
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
      { key: 'pending_approval', label: 'Request Submitted', icon: 'checkmark-circle-outline' },
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e67e22" />
        <Text style={styles.loadingText}>Loading request details...</Text>
      </View>
    );
  }

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
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
      }
    >
      {/* Status Header with Gradient */}
      <LinearGradient
        colors={['#e67e22', '#f39c12']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity onPress={goBack} style={styles.backHeaderButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Status</Text>
        <View style={[styles.headerStatusBadge, { backgroundColor: statusInfo.color + '40' }]}>
          <Ionicons name={statusInfo.icon as any} size={20} color="#fff" />
          <Text style={styles.headerStatusText}>{statusInfo.label}</Text>
        </View>
        <Text style={styles.headerId}>Request #{request.id.slice(-8)}</Text>
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
                <Text style={styles.stepCurrent}>Current</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Assigned Professional Details */}
      {request.mistriDetails && request.status !== 'pending_approval' && request.status !== 'canceled' && request.status !== 'rejected' && (
        <View style={styles.mistriCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person" size={18} color="#e67e22" /> Assigned Professional
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
            <Ionicons name="cash" size={18} color="#e67e22" /> Payment Details
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
          <Ionicons name="information-circle" size={18} color="#e67e22" /> Service Details
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
            <Ionicons name="information-circle" size={18} color="#e67e22" />
            <Text style={styles.adminNoteText}>{request.adminNotes}</Text>
          </View>
        )}
      </View>

      {/* Timeline */}
      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="time" size={18} color="#e67e22" /> Timeline
        </Text>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineLabel}>📋 Requested</Text>
          <Text style={styles.timelineValue}>
            {new Date(request.createdAt).toLocaleString()}
          </Text>
        </View>
        {request.assignedAt && (
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>👤 Assigned</Text>
            <Text style={styles.timelineValue}>
              {new Date(request.assignedAt).toLocaleString()}
            </Text>
          </View>
        )}
        {request.startedWorkAt && (
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>🔨 Work Started</Text>
            <Text style={styles.timelineValue}>
              {new Date(request.startedWorkAt).toLocaleString()}
            </Text>
          </View>
        )}
        {request.completedAt && (
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>✅ Completed</Text>
            <Text style={styles.timelineValue}>
              {new Date(request.completedAt).toLocaleString()}
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
              router.push(`/review/${request.id}`);
            }}
          >
            <Ionicons name="star" size={20} color="#e67e22" />
            <Text style={[styles.actionButtonText, { color: '#e67e22' }]}>Leave a Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc', 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#e67e22', 
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
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backHeaderButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
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
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  
  // Progress Card
  progressCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 20, 
    margin: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: '#e67e22',
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stepLine: { 
    width: 2, 
    height: 32, 
    backgroundColor: '#e2e8f0', 
    marginTop: -2,
  },
  stepLineActive: { 
    backgroundColor: '#e67e22',
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
  stepCurrent: {
    fontSize: 10,
    color: '#e67e22',
    fontWeight: '600',
    marginTop: 2,
  },
  
  // Mistri Card
  mistriCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: '#e67e22', 
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
    backgroundColor: '#e67e22', 
    padding: 12,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Payment Card
  paymentCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    color: '#e67e22',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    color: '#e67e22', 
    fontStyle: 'italic',
  },
  
  // Timeline Card
  timelineCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
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
    paddingBottom: 24,
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
    backgroundColor: '#e67e22',
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e67e22',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});