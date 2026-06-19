import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    Dimensions,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { NearbyMistri } from '../hooks/queries';

const { width, height } = Dimensions.get('window');

interface MistriMapViewProps {
    mistris: NearbyMistri[];
    customerLocation: { lat: number; lng: number };
    onMistriSelect?: (mistri: NearbyMistri) => void;
}

export const MistriMapView: React.FC<MistriMapViewProps> = ({
    mistris,
    customerLocation,
    onMistriSelect,
}) => {
    const [selectedMistri, setSelectedMistri] = useState<NearbyMistri | null>(null);
    const [mapRegion, setMapRegion] = useState<Region>({
        latitude: customerLocation.lat,
        latitudeDelta: 0.01,
        longitude: customerLocation.lng,
        longitudeDelta: 0.01,
    });

    // Update map region when customer location changes
    useEffect(() => {
        if (mistris.length > 0) {
            // Calculate bounds to fit all mistris and customer location
            const latitudes = [customerLocation.lat, ...mistris.map(m => m.location.lat)];
            const longitudes = [customerLocation.lng, ...mistris.map(m => m.location.lng)];

            const minLat = Math.min(...latitudes);
            const maxLat = Math.max(...latitudes);
            const minLng = Math.min(...longitudes);
            const maxLng = Math.max(...longitudes);

            const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
            const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01);

            setMapRegion({
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2,
                latitudeDelta: latDelta,
                longitudeDelta: lngDelta,
            });
        } else {
            setMapRegion({
                latitude: customerLocation.lat,
                longitude: customerLocation.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }
    }, [mistris, customerLocation]);

    const handleMarkerPress = (mistri: NearbyMistri) => {
        setSelectedMistri(mistri);
    };

    const handleBookPress = () => {
        if (selectedMistri && onMistriSelect) {
            onMistriSelect(selectedMistri);
        }
    };

    const getServiceIcon = (serviceName: string) => {
        switch (serviceName.toLowerCase()) {
            case 'electrician':
                return '⚡';
            case 'plumber':
                return '🔧';
            default:
                return '👷';
        }
    };

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                region={mapRegion}
                showsUserLocation={false}
                showsMyLocationButton={false}
                toolbarEnabled={false}
            >
                {/* Mistri markers */}
                {mistris.map((mistri) => (
                    <Marker
                        key={mistri.id}
                        coordinate={{
                            latitude: mistri.location.lat,
                            longitude: mistri.location.lng,
                        }}
                        title={mistri.fullName}
                        description={`${mistri.serviceName} • ${mistri.distance}km away`}
                        onPress={() => handleMarkerPress(mistri)}
                    >
                        <View style={styles.markerContainer}>
                            <View style={[styles.markerBubble, { backgroundColor: mistri.serviceMapIconColor || '#2563eb' }]}>
                                <Text style={styles.markerText}>
                                    {getServiceIcon(mistri.serviceName)}
                                </Text>
                            </View>
                            <View style={styles.markerArrow} />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* Selected mistri info card */}
            {selectedMistri && (
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <View style={styles.infoAvatar}>
                            {selectedMistri.profilePhotoUrl ? (
                                <Text style={styles.avatarEmoji}>
                                    {getServiceIcon(selectedMistri.serviceName)}
                                </Text>
                            ) : (
                                <MaterialIcons name="person" size={20} color="#6b7280" />
                            )}
                        </View>
                        <View style={styles.infoDetails}>
                            <Text style={styles.infoName}>{selectedMistri.fullName}</Text>
                            <Text style={styles.infoService}>{selectedMistri.serviceName}</Text>
                            <Text style={styles.infoDistance}>{selectedMistri.distance}km away</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setSelectedMistri(null)}
                        >
                            <MaterialIcons name="close" size={20} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoStats}>
                        <View style={styles.statItem}>
                            <MaterialIcons name="star" size={16} color="#fbbf24" />
                            <Text style={styles.statText}>
                                {(selectedMistri.averageRating && selectedMistri.averageRating > 0) ? Number(selectedMistri.averageRating).toFixed(1) : 'New'}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <MaterialIcons name="work" size={16} color="#6b7280" />
                            <Text style={styles.statText}>{selectedMistri.jobsCompleted} jobs</Text>
                        </View>
                    </View>

                    {selectedMistri.bio && (
                        <Text style={styles.infoBio} numberOfLines={2}>
                            {selectedMistri.bio}
                        </Text>
                    )}

                    <TouchableOpacity style={styles.bookButton} onPress={handleBookPress}>
                        <Text style={styles.bookButtonText}>Book This Mistri</Text>
                        <MaterialIcons name="arrow-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerBubble: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
                                            },
    markerText: {
        fontSize: 16,
    },
    markerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#fff',
        marginTop: -1,
    },
    infoCard: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
                                            },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarEmoji: {
        fontSize: 20,
    },
    infoDetails: {
        flex: 1,
    },
    infoName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    infoService: {
        fontSize: 14,
        color: '#6b7280',
    },
    infoDistance: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '500',
    },
    closeButton: {
        padding: 4,
    },
    infoStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        fontSize: 14,
        color: '#111827',
        marginLeft: 4,
    },
    statDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#e5e7eb',
        marginHorizontal: 12,
    },
    infoBio: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    bookButton: {
        backgroundColor: '#16a34a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
    },
    bookButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },

});
