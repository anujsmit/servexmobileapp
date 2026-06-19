import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import React, { useState, useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaContainer } from '../../../../components/SafeAreaContainer';
import { ViewToggle, ViewMode } from '../../../../components/ViewToggle';
import { MistriListView } from '../../../../components/MistriListView';
import { MistriMapView } from '../../../../components/MistriMapView';
import { useNearbyMistrisQuery, NearbyMistri } from '../../../../hooks/queries';

export default function ServiceRequestAvailable() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const selectedService = params.selectedService as string;
    const latitude = parseFloat(params.latitude as string);
    const longitude = parseFloat(params.longitude as string);
    const address = params.address as string;

    // Results view state
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const markerLocation = { latitude, longitude };

    // Fetch nearby mistris
    const { data: allNearbyMistris = [], isLoading: mistrisLoading } = useNearbyMistrisQuery({
        lat: latitude,
        lng: longitude,
        maxDistanceKm: 20,
    });

    // Filter mistris by selected service (or show all if none selected)
    const nearbyMistris = useMemo(() => {
        if (!selectedService) {
            return allNearbyMistris; // Show all if no service selected
        }
        // Filter by service type based on serviceName
        return allNearbyMistris.filter(mistri =>
            mistri.serviceName.toLowerCase() === selectedService.toLowerCase()
        );
    }, [allNearbyMistris, selectedService]);

    // Handle mistri selection from list/map
    const handleMistriSelect = (mistri: NearbyMistri): void => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/(protected)/(customer)/service-request/[mistriId]',
            params: {
                mistriId: mistri.id,
                name: mistri.fullName,
                serviceType: mistri.serviceName,
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                address,
                profilePhotoUrl: mistri.profilePhotoUrl || '',
                bio: mistri.bio || '',
                jobsCompleted: mistri.jobsCompleted.toString(),
                averageRating: mistri.averageRating?.toString() || '0',
            },
        });
    };

    return (
        <SafeAreaContainer>
            <View style={[styles.header, styles.resultsHeader]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>Available Mistris</Text>
                    <Text style={styles.subtitle}>
                        {nearbyMistris.length} {selectedService ? `${selectedService}${nearbyMistris.length !== 1 ? 's' : ''}` : 'mistri(s)'} nearby
                    </Text>
                </View>
                <ViewToggle viewMode={viewMode} onToggle={setViewMode} />
            </View>

            {mistrisLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingText}>Loading mistris...</Text>
                </View>
            ) : viewMode === 'list' ? (
                <MistriListView
                    mistris={nearbyMistris}
                    onMistriSelect={handleMistriSelect}
                />
            ) : (
                <View style={styles.mapViewContainer}>
                    <MistriMapView
                        mistris={nearbyMistris}
                        customerLocation={{ lat: markerLocation.latitude, lng: markerLocation.longitude }}
                        onMistriSelect={handleMistriSelect}
                    />
                </View>
            )}
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    resultsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
    },
    mapViewContainer: {
        flex: 1,
    },
});

