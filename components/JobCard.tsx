import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TargetedRequest } from '../hooks/queries';
import { getLightBgColor } from '../lib/serviceColors';
import { useServices } from '../context/ServicesContext';
import { useMistriTradeTheme } from '../context/MistriTradeThemeContext';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../lib/mistriDashboardTokens';

interface JobCardProps {
    job: TargetedRequest | any; // Support both TargetedRequest and MistriJob types
    onAccept?: (jobId: string) => void;
    onDecline?: (jobId: string) => void;
    onViewDetails?: (jobId: string) => void;
    isAccepting?: boolean;
    isDeclining?: boolean;
    showActions?: boolean; // Control whether to show Accept/Decline buttons
}

export const JobCard: React.FC<JobCardProps> = ({
    job,
    onAccept,
    onDecline,
    onViewDetails,
    isAccepting = false,
    isDeclining = false,
    showActions = true,
}) => {
    const trade = useMistriTradeTheme();
    const distance = calculateDistance(job.lat, job.lng);
    const { getServiceColor } = useServices();

    // Get service color from database via context
    const serviceColor = getServiceColor(job.type);
    const serviceBgColor = getLightBgColor(serviceColor);

    // Get status badge properties
    const getStatusBadge = () => {
        switch (job.status) {
            case 'assigned':
                return { text: 'Active', color: '#059669', bgColor: '#d1fae5' };
            case 'completed':
                return { text: 'Completed', color: '#6b7280', bgColor: '#f3f4f6' };
            case 'canceled':
                return { text: 'Canceled', color: '#dc2626', bgColor: '#fee2e2' };
            default:
                return { text: 'Pending', color: '#d97706', bgColor: '#fef3c7' };
        }
    };

    const statusBadge = getStatusBadge();

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => onViewDetails?.(job.id)}
            activeOpacity={onViewDetails ? 0.7 : 1}
            disabled={!onViewDetails}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.serviceIcon, { backgroundColor: serviceBgColor }]}>
                    <MaterialIcons
                        name={job.type === 'electrician' ? 'electrical-services' : 'plumbing'}
                        size={24}
                        color={serviceColor}
                    />
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.serviceType}>
                        {job.type.charAt(0).toUpperCase() + job.type.slice(1)} Service
                    </Text>
                    <Text style={styles.customerName}>{job.customerName}</Text>
                </View>
                {!showActions ? (
                    <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                        <Text style={[styles.statusText, { color: statusBadge.color }]}>
                            {statusBadge.text}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.distanceBadge}>
                        <MaterialIcons name="location-on" size={14} color={DC.muted} />
                        <Text style={styles.distanceText}>{distance}</Text>
                    </View>
                )}
            </View>

            {/* Location */}
            <View style={styles.infoRow}>
                <MaterialIcons name="place" size={20} color={DC.muted} />
                <Text style={styles.address} numberOfLines={2}>
                    {job.address}
                </Text>
            </View>

            {/* Time */}
            <View style={styles.infoRow}>
                <MaterialIcons name="access-time" size={20} color={DC.muted} />
                <Text style={styles.time}>
                    {job.completedAt && !showActions
                        ? `Completed: ${new Date(job.completedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                          })}`
                        : `Created: ${new Date(job.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                          })}`}
                </Text>
            </View>

            {/* Action Buttons (only for pending requests) */}
            {showActions && onAccept && onDecline && (
                <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.declineButton, isDeclining && styles.buttonDisabled]}
                    onPress={() => onDecline(job.id)}
                    disabled={isAccepting || isDeclining}
                    activeOpacity={0.7}
                >
                    {isDeclining ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                        <>
                            <MaterialIcons name="close" size={20} color="#dc2626" />
                            <Text style={styles.declineButtonText}>Decline</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.acceptButton,
                        { backgroundColor: trade.accent },
                        isAccepting && styles.buttonDisabled,
                    ]}
                    onPress={() => onAccept(job.id)}
                    disabled={isAccepting || isDeclining}
                    activeOpacity={0.7}
                >
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <MaterialIcons name="check" size={20} color="#fff" />
                            <Text style={styles.acceptButtonText}>Accept Job</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
            )}

            {/* View Details Hint */}
            {onViewDetails && (
                <View style={styles.viewDetailsHint}>
                    <Text style={[styles.viewDetailsText, { color: trade.accent }]}>Tap to view full details</Text>
                    <MaterialIcons name="arrow-forward-ios" size={14} color={DC.muted} />
                </View>
            )}
        </TouchableOpacity>
    );
};

// Simple distance calculation (can be enhanced with actual customer location)
function calculateDistance(lat: string, lng: string): string {
    // Placeholder - in real implementation, calculate from mistri's current location
    // For now, return a mock distance
    return '~2.5km';
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 14,
        marginBottom: 10,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceIcon: {
        width: 44,
        height: 44,
        borderRadius: 13,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    serviceType: {
        fontSize: 15,
        fontWeight: '600',
        color: DC.text,
    },
    customerName: {
        fontSize: 12,
        color: DC.muted,
        marginTop: 1,
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DC.surfaceMuted,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        borderCurve: 'continuous',
    },
    distanceText: {
        fontSize: 12,
        color: DC.muted,
        fontWeight: '600',
        marginLeft: 4,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    address: {
        flex: 1,
        fontSize: 12,
        color: DC.text,
        marginLeft: 8,
        lineHeight: 18,
    },
    time: {
        fontSize: 12,
        color: DC.text,
        marginLeft: 8,
    },
    actions: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 12,
    },
    declineButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#dc2626',
        backgroundColor: '#ffffff',
        gap: 6,
    },
    acceptButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderCurve: 'continuous',
        gap: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    declineButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#dc2626',
    },
    acceptButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    viewDetailsHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(15, 23, 42, 0.06)',
    },
    viewDetailsText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
