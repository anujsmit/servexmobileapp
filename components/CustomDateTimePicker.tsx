// components/CustomDateTimePicker.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomDateTimePickerProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date, time: Date) => void;
    initialDate?: Date;
    initialTime?: Date;
}

export default function CustomDateTimePicker({
    visible,
    onClose,
    onConfirm,
    initialDate = new Date(),
    initialTime = new Date(),
}: CustomDateTimePickerProps) {
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [selectedTime, setSelectedTime] = useState(initialTime);
    const [mode, setMode] = useState<'date' | 'time'>('date');

    // Generate days for the next 30 days
    const getDates = () => {
        const dates = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    // Generate hours (0-23)
    const getHours = () => {
        const hours = [];
        for (let i = 0; i < 24; i++) {
            hours.push(i);
        }
        return hours;
    };

    // Generate minutes (0-59 in 15-minute intervals)
    const getMinutes = () => {
        const minutes = [];
        for (let i = 0; i < 60; i += 15) {
            minutes.push(i);
        }
        return minutes;
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTime = (hour: number, minute: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    };

    const handleConfirm = () => {
        const timeDate = new Date(selectedTime);
        const finalTime = new Date(selectedDate);
        finalTime.setHours(timeDate.getHours());
        finalTime.setMinutes(timeDate.getMinutes());
        onConfirm(selectedDate, finalTime);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {mode === 'date' ? 'Select Date' : 'Select Time'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Mode Toggle */}
                    <View style={styles.modeToggle}>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'date' && styles.modeButtonActive]}
                            onPress={() => setMode('date')}
                        >
                            <Text style={[styles.modeText, mode === 'date' && styles.modeTextActive]}>
                                Date
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'time' && styles.modeButtonActive]}
                            onPress={() => setMode('time')}
                        >
                            <Text style={[styles.modeText, mode === 'time' && styles.modeTextActive]}>
                                Time
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'date' ? (
                        <ScrollView style={styles.pickerContainer} showsVerticalScrollIndicator={false}>
                            {getDates().map((date, index) => {
                                const isSelected = formatDate(date) === formatDate(selectedDate);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                                        onPress={() => setSelectedDate(date)}
                                    >
                                        <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                                            {formatDate(date)}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={styles.timeContainer}>
                            {/* Hours Column */}
                            <View style={styles.timeColumn}>
                                <Text style={styles.timeColumnTitle}>Hour</Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {getHours().map((hour) => {
                                        const isSelected = hour === selectedTime.getHours();
                                        return (
                                            <TouchableOpacity
                                                key={hour}
                                                style={[styles.timeItem, isSelected && styles.timeItemSelected]}
                                                onPress={() => {
                                                    const newTime = new Date(selectedTime);
                                                    newTime.setHours(hour);
                                                    setSelectedTime(newTime);
                                                }}
                                            >
                                                <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                                                    {hour.toString().padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Minutes Column */}
                            <View style={styles.timeColumn}>
                                <Text style={styles.timeColumnTitle}>Minute</Text>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {getMinutes().map((minute) => {
                                        const isSelected = minute === selectedTime.getMinutes();
                                        return (
                                            <TouchableOpacity
                                                key={minute}
                                                style={[styles.timeItem, isSelected && styles.timeItemSelected]}
                                                onPress={() => {
                                                    const newTime = new Date(selectedTime);
                                                    newTime.setMinutes(minute);
                                                    setSelectedTime(newTime);
                                                }}
                                            >
                                                <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                                                    {minute.toString().padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Preview */}
                            <View style={styles.timePreview}>
                                <Text style={styles.timePreviewLabel}>Selected Time</Text>
                                <Text style={styles.timePreviewValue}>
                                    {formatTime(selectedTime.getHours(), selectedTime.getMinutes())}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    modeToggle: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    modeButtonActive: {
        backgroundColor: '#e67e22',
    },
    modeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748b',
    },
    modeTextActive: {
        color: '#ffffff',
    },
    pickerContainer: {
        paddingHorizontal: 16,
        maxHeight: 400,
    },
    dateItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f2f5',
    },
    dateItemSelected: {
        backgroundColor: '#fef3e8',
    },
    dateText: {
        fontSize: 16,
        color: '#0f172a',
    },
    dateTextSelected: {
        color: '#e67e22',
        fontWeight: '500',
    },
    timeContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 16,
        maxHeight: 400,
    },
    timeColumn: {
        flex: 1,
    },
    timeColumnTitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 8,
    },
    timeItem: {
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
        marginVertical: 2,
    },
    timeItemSelected: {
        backgroundColor: '#e67e22',
    },
    timeText: {
        fontSize: 16,
        color: '#64748b',
    },
    timeTextSelected: {
        color: '#ffffff',
        fontWeight: '600',
    },
    timePreview: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
    },
    timePreviewLabel: {
        fontSize: 11,
        color: '#94a3b8',
        marginBottom: 4,
    },
    timePreviewValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#e67e22',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f2f5',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#64748b',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#e67e22',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
});