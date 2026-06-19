import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimelineEvent {
  label: string;
  timestamp?: string;
  completed: boolean;
}

interface CompactTimelineProps {
  events: TimelineEvent[];
}

export const CompactTimeline: React.FC<CompactTimelineProps> = ({ events }) => {
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <View style={styles.container}>
      {events.map((event, index) => (
        <View key={index} style={styles.eventContainer}>
          {/* Dot */}
          <View style={styles.dotWrapper}>
            <View
              style={[
                styles.dot,
                event.completed && styles.dotCompleted,
              ]}
            >
              {event.completed && (
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              )}
            </View>
            {/* Connector line */}
            {index < events.length - 1 && (
              <View
                style={[
                  styles.connector,
                  event.completed && events[index + 1]?.completed && styles.connectorCompleted,
                ]}
              />
            )}
          </View>

          {/* Event info */}
          <View style={styles.eventInfo}>
            <Text
              style={[
                styles.label,
                event.completed && styles.labelCompleted,
              ]}
            >
              {event.label}
            </Text>
            {event.timestamp && (
              <Text style={styles.time}>{formatTime(event.timestamp)}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  eventContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dotWrapper: {
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  connector: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  connectorCompleted: {
    backgroundColor: '#10B981',
  },
  eventInfo: {
    flex: 1,
    paddingBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  labelCompleted: {
    color: '#111827',
  },
  time: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
