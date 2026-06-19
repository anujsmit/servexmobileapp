import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ServiceCardProps {
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
  isSelected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean; // Compact mode for dense UI
  showActions?: boolean; // Show edit/delete actions (for mistri management)
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  name,
  description,
  price,
  imageUrl,
  isSelected = false,
  onPress,
  onEdit,
  onDelete,
  compact = false,
  showActions = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        compact && styles.compactCard,
        isSelected && styles.selectedCard,
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Image */}
        {imageUrl && !compact && (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        )}

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, compact && styles.compactName]} numberOfLines={1}>
            {name}
          </Text>
          {description && !compact && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
          <Text style={[styles.price, compact && styles.compactPrice]}>
            Rs. {parseFloat(price).toLocaleString()}
          </Text>
        </View>

        {/* Selection indicator or Actions */}
        {isSelected && !showActions && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        )}

        {showActions && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                <Ionicons name="pencil" size={20} color="#3B82F6" />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                <Ionicons name="trash" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  compactCard: {
    padding: 8,
    marginBottom: 6,
    borderRadius: 8,
  },
  selectedCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  content: {
    flexDirection: 'row',
    gap: 10,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  compactName: {
    fontSize: 14,
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    lineHeight: 18,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  compactPrice: {
    fontSize: 13,
  },
  checkmark: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
  },
});
