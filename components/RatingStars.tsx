import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RatingStarsProps {
  rating: number; // Current rating (0-5)
  totalStars?: number; // Total number of stars (default: 5)
  size?: number; // Star size (default: 20)
  interactive?: boolean; // Whether user can change rating (default: false)
  onRatingChange?: (rating: number) => void; // Callback when rating changes
  showNumber?: boolean; // Show numerical rating next to stars (default: false)
  color?: string; // Active star color (default: #FFD700)
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  totalStars = 5,
  size = 20,
  interactive = false,
  onRatingChange,
  showNumber = false,
  color = '#FFD700',
}) => {
  const renderStar = (index: number) => {
    const starNumber = index + 1;
    const isFilled = starNumber <= Math.floor(rating);
    const isHalfFilled = starNumber === Math.ceil(rating) && rating % 1 !== 0;

    const starName = isFilled ? 'star' : isHalfFilled ? 'star-half' : 'star-outline';

    const StarComponent = interactive ? TouchableOpacity : View;

    return (
      <StarComponent
        key={index}
        onPress={interactive ? () => onRatingChange?.(starNumber) : undefined}
        disabled={!interactive}
        activeOpacity={0.7}
      >
        <Ionicons
          name={starName}
          size={size}
          color={isFilled || isHalfFilled ? color : '#D1D5DB'}
        />
      </StarComponent>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {Array.from({ length: totalStars }).map((_, index) => renderStar(index))}
      </View>
      {showNumber && (
        <Text style={[styles.ratingText, { fontSize: size * 0.8 }]}>
          {rating != null ? Number(rating).toFixed(1) : '0.0'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    color: '#374151',
    fontWeight: '600',
    marginLeft: 2,
  },
});
