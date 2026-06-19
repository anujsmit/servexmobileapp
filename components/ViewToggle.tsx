import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type ViewMode = 'list' | 'map';

interface ViewToggleProps {
    viewMode: ViewMode;
    onToggle: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onToggle }) => {
    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.button, viewMode === 'list' && styles.buttonActive]}
                onPress={() => onToggle('list')}
                activeOpacity={0.7}
            >
                <MaterialIcons
                    name="list"
                    size={20}
                    color={viewMode === 'list' ? '#fff' : '#6b7280'}
                />
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.button, viewMode === 'map' && styles.buttonActive]}
                onPress={() => onToggle('map')}
                activeOpacity={0.7}
            >
                <MaterialIcons
                    name="map"
                    size={20}
                    color={viewMode === 'map' ? '#fff' : '#6b7280'}
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        padding: 2,
    },
    button: {
        padding: 8,
        borderRadius: 6,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonActive: {
        backgroundColor: '#2563eb',
    },
});
