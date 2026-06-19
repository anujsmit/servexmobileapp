import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { NearbyMistri } from '../hooks/queries';
import { getServiceIcon, getLightBgColor } from '../lib/serviceColors';

interface MistriListViewProps {
    mistris: NearbyMistri[];
    onMistriSelect: (mistri: NearbyMistri) => void;
}

export const MistriListView: React.FC<MistriListViewProps> = ({
    mistris,
    onMistriSelect,
}) => {
    if (mistris.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialIcons name="person-off" size={64} color="#9ca3af" />
                <Text style={styles.emptyText}>No mistris found nearby</Text>
                <Text style={styles.emptySubtext}>
                    Try selecting a different service type or check back later
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {mistris.map((mistri) => {
                // Use the color from the database
                const serviceColor = mistri.serviceMapIconColor;
                const serviceBgColor = getLightBgColor(serviceColor);
                const serviceIcon = getServiceIcon(mistri.serviceName);

                return (
                    <TouchableOpacity
                        key={mistri.id}
                        style={styles.card}
                        onPress={() => onMistriSelect(mistri)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardContent}>
                            {/* Left: Avatar */}
                            <View style={styles.avatarContainer}>
                                {mistri.profilePhotoUrl ? (
                                    <Image
                                        source={{ uri: mistri.profilePhotoUrl }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <MaterialIcons name="person" size={20} color="#9ca3af" />
                                    </View>
                                )}
                            </View>

                            {/* Center: Info */}
                            <View style={styles.infoSection}>
                                {/* Name with Service Type Badge */}
                                <View style={styles.nameRow}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {mistri.fullName}
                                    </Text>
                                    <View style={[styles.serviceBadge, { backgroundColor: serviceBgColor }]}>
                                        <MaterialIcons name="verified" size={12} color={serviceColor} />
                                        <Ionicons name={serviceIcon} size={12} color={serviceColor} />
                                        <Text style={[styles.serviceText, { color: serviceColor }]}>
                                            {mistri.serviceName}
                                        </Text>
                                    </View>
                                </View>

                                {/* Stats Row */}
                                <View style={styles.statsRow}>
                                    {/* Rating */}
                                    <View style={styles.statItem}>
                                        <MaterialIcons name="star" size={14} color="#fbbf24" />
                                        <Text style={styles.statText}>
                                            {mistri.averageRating && mistri.averageRating > 0
                                                ? Number(mistri.averageRating).toFixed(1)
                                                : 'New'}
                                        </Text>
                                    </View>

                                    {/* Jobs Count */}
                                    <View style={styles.statItem}>
                                        <MaterialIcons name="work-outline" size={14} color="#6b7280" />
                                        <Text style={styles.statText}>{mistri.jobsCompleted || 0}</Text>
                                    </View>

                                    {/* Distance */}
                                    <View style={styles.statItem}>
                                        <MaterialIcons name="location-on" size={14} color="#6b7280" />
                                        <Text style={styles.statText}>{mistri.distance}km</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Right: Chevron */}
                            <MaterialIcons name="chevron-right" size={24} color="#d1d5db" />
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    contentContainer: {
        padding: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 8,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    avatarContainer: {
        marginRight: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: '#f3f4f6',
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoSection: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        flex: 0,
        flexShrink: 1,
    },
    serviceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
    },
    serviceText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    statText: {
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
});
