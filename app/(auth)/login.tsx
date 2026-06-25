import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    Modal,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Animated,
    Image,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import NepaliDate from 'nepali-date-converter';
import { useAuth } from '../../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DeletionPromptModal } from '../../components/DeletionPromptModal';

const { width, height } = Dimensions.get('window');

interface Errors {
    name?: string;
    phone?: string;
    password?: string;
    dob?: string;
}

interface FormData {
    name: string;
    phone: string;
    password: string;
    dob: string;
}

type RoleParam = 'user' | 'mistri';
type FieldName = 'name' | 'phone' | 'password';

const ROLE_CONFIG = {
    user: {
        accent: '#0177b8',
        accentSoft: '#e7f3fb',
        title: 'Find a Service',
        subtitle: 'Login or create an account',
        placeholder: 'John Doe',
        gradient: ['#0a8fd1', '#045a8f'] as const,
    },
    mistri: {
        accent: '#179d2e',
        accentSoft: '#e9f8ec',
        title: "I'm a Mistri",
        subtitle: 'Login or start earning',
        placeholder: 'Ram Bahadur',
        gradient: ['#22b83b', '#0e6b20'] as const,
    },
};

// Month names in the Nepali (Bikram Sambat) calendar
const MONTH_NAMES = [
    'Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

const ITEM_HEIGHT = 46;
const VISIBLE_ROWS = 5;
const PICKER_ROW_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PICKER_PADDING = (PICKER_ROW_HEIGHT - ITEM_HEIGHT) / 2;

// Get current Nepali date in YYYY-MM-DD format
const getCurrentNepaliDate = (): string => {
    const nepaliDate = new NepaliDate(new Date());
    const year = nepaliDate.getYear();
    const month = String(nepaliDate.getMonth() + 1).padStart(2, '0');
    const day = String(nepaliDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Format Nepali date for display (e.g., "2060-04-28" -> "Bhadra 28, 2060 BS")
const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        if (!year || !month || !day) return dateStr;
        return `${MONTH_NAMES[month - 1]} ${day}, ${year} BS`;
    } catch {
        return dateStr;
    }
};

// Calculate age from a Nepali (BS) date string
const calculateAgeFromNepaliDate = (nepaliDateStr: string): number | null => {
    if (!nepaliDateStr) return null;
    try {
        const currentNepali = new NepaliDate(new Date());
        const [year, month, day] = nepaliDateStr.split('-').map(Number);

        if (!year || !month || !day) return null;

        let age = currentNepali.getYear() - year;
        const currentMonth = currentNepali.getMonth() + 1;
        const currentDay = currentNepali.getDate();

        if (currentMonth < month || (currentMonth === month && currentDay < day)) {
            age--;
        }
        return age;
    } catch {
        return null;
    }
};

const getDaysInMonth = (month: number, year: number): number => {
    if (!month || !year) return 32;
    try {
        const nextMonthIndex = month === 12 ? 0 : month;
        const nextYear = month === 12 ? year + 1 : year;
        const firstOfNextMonth = new NepaliDate(nextYear, nextMonthIndex, 1).toJsDate();
        const lastDayOfThisMonth = new Date(firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000);
        const bsLastDay = new NepaliDate(lastDayOfThisMonth);
        return bsLastDay.getDate();
    } catch {
        return 30;
    }
};

// ---------------------------------------------------------------------------
// Date Picker Modal - redesigned as a bottom sheet with a centered "wheel"
// highlight, tap-to-select, drag-to-snap, and auto-scroll to the current
// selection when it opens.
// ---------------------------------------------------------------------------
const DatePickerModal = ({
    visible,
    onClose,
    onConfirm,
    initialDate,
    accentColor = '#0177b8',
}: {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: string) => void;
    initialDate?: string;
    accentColor?: string;
}) => {
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedDay, setSelectedDay] = useState('');

    const slideAnim = useRef(new Animated.Value(height)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const yearScrollRef = useRef<ScrollView>(null);
    const monthScrollRef = useRef<ScrollView>(null);
    const dayScrollRef = useRef<ScrollView>(null);

    const currentYear = new NepaliDate(new Date()).getYear();
    const years = Array.from({ length: 121 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const daysInSelectedMonth = getDaysInMonth(parseInt(selectedMonth, 10), parseInt(selectedYear, 10));
    const dayList = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

    const scrollToValue = (ref: React.RefObject<ScrollView>, list: number[], value: number, animated = false) => {
        const index = list.indexOf(value);
        if (index >= 0 && ref.current) {
            ref.current.scrollTo({ y: index * ITEM_HEIGHT, animated });
        }
    };

    useEffect(() => {
        if (visible) {
            let y = '';
            let m = '';
            let d = '';

            if (initialDate && initialDate.includes('-')) {
                const parts = initialDate.split('-');
                if (parts.length === 3) {
                    [y, m, d] = parts;
                }
            } else {
                const current = getCurrentNepaliDate();
                [y, m, d] = current.split('-');
            }

            setSelectedYear(y);
            setSelectedMonth(m);
            setSelectedDay(d);

            Animated.parallel([
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 18,
                    mass: 0.9,
                    stiffness: 160,
                }),
            ]).start();

            const timeout = setTimeout(() => {
                scrollToValue(yearScrollRef, years, parseInt(y, 10));
                scrollToValue(monthScrollRef, months, parseInt(m, 10));
                scrollToValue(dayScrollRef, dayList, parseInt(d, 10));
            }, 60);
            return () => clearTimeout(timeout);
        }

        Animated.parallel([
            Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: height, duration: 220, useNativeDriver: true }),
        ]).start();
        return undefined;
    }, [visible]);

    useEffect(() => {
        if (!visible || !selectedDay) return;
        const maxDay = daysInSelectedMonth;
        if (parseInt(selectedDay, 10) > maxDay) {
            setSelectedDay(String(maxDay));
            scrollToValue(dayScrollRef, dayList, maxDay, true);
        }
    }, [selectedMonth, selectedYear]);

    const selectValue = (
        list: number[],
        value: number,
        ref: React.RefObject<ScrollView>,
        setter: (v: string) => void
    ) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setter(String(value));
        scrollToValue(ref, list, value, true);
    };

    const handleScrollEnd = (
        e: NativeSyntheticEvent<NativeScrollEvent>,
        list: number[],
        setter: (v: string) => void
    ) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        const index = Math.max(0, Math.min(list.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
        setter(String(list[index]));
    };

    const handleConfirm = () => {
        if (!selectedYear || !selectedMonth || !selectedDay) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        const formattedDate = `${selectedYear}-${String(parseInt(selectedMonth, 10)).padStart(2, '0')}-${String(
            parseInt(selectedDay, 10)
        ).padStart(2, '0')}`;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onConfirm(formattedDate);
        onClose();
    };

    const age = selectedYear && selectedMonth && selectedDay
        ? calculateAgeFromNepaliDate(`${selectedYear}-${selectedMonth}-${selectedDay}`)
        : null;
    const isUnderage = age !== null && age < 18;

    return (
        <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
            <Animated.View style={[styles.modalBackdrop, { opacity: backdropAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            <Animated.View
                style={[
                    styles.sheetContent,
                    { transform: [{ translateY: slideAnim }] },
                ]}
            >
                <View style={styles.sheetHandle} />

                <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Date of Birth</Text>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                        }}
                        style={styles.sheetClose}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={18} color="#666" />
                    </TouchableOpacity>
                </View>

                {selectedYear && selectedMonth && selectedDay && (
                    <View style={styles.selectedDateContainer}>
                        <Text style={[styles.selectedDateText, { color: accentColor }]}>
                            {formatDisplayDate(`${selectedYear}-${selectedMonth}-${selectedDay}`)}
                        </Text>
                        {age !== null && (
                            <View
                                style={[
                                    styles.agePill,
                                    { backgroundColor: isUnderage ? '#fff0ef' : accentColor + '15' },
                                ]}
                            >
                                <Ionicons
                                    name={isUnderage ? 'alert-circle' : 'checkmark-circle'}
                                    size={14}
                                    color={isUnderage ? '#ff3b30' : accentColor}
                                />
                                <Text style={[styles.agePillText, { color: isUnderage ? '#ff3b30' : accentColor }]}>
                                    {age} years old{isUnderage ? ' · under 18' : ''}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.pickerRow}>
                    <View style={[styles.pickerHighlight, { borderColor: accentColor + '40', backgroundColor: accentColor + '0d' }]} pointerEvents="none" />

                    <View style={styles.pickerColumn}>
                        <ScrollView
                            ref={yearScrollRef}
                            style={styles.pickerScroll}
                            showsVerticalScrollIndicator={false}
                            snapToInterval={ITEM_HEIGHT}
                            decelerationRate="fast"
                            contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
                            onMomentumScrollEnd={(e) => handleScrollEnd(e, years, setSelectedYear)}
                        >
                            {years.map((year) => (
                                <TouchableOpacity
                                    key={year}
                                    style={styles.pickerItem}
                                    onPress={() => selectValue(years, year, yearScrollRef, setSelectedYear)}
                                >
                                    <Text
                                        style={[
                                            styles.pickerItemText,
                                            selectedYear === year.toString() && {
                                                color: accentColor,
                                                fontWeight: '700',
                                                fontSize: 17,
                                            },
                                        ]}
                                    >
                                        {year}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.pickerColumn}>
                        <ScrollView
                            ref={monthScrollRef}
                            style={styles.pickerScroll}
                            showsVerticalScrollIndicator={false}
                            snapToInterval={ITEM_HEIGHT}
                            decelerationRate="fast"
                            contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
                            onMomentumScrollEnd={(e) => handleScrollEnd(e, months, setSelectedMonth)}
                        >
                            {months.map((month) => (
                                <TouchableOpacity
                                    key={month}
                                    style={styles.pickerItem}
                                    onPress={() => selectValue(months, month, monthScrollRef, setSelectedMonth)}
                                >
                                    <Text
                                        style={[
                                            styles.pickerItemText,
                                            selectedMonth === month.toString() && {
                                                color: accentColor,
                                                fontWeight: '700',
                                                fontSize: 17,
                                            },
                                        ]}
                                    >
                                        {MONTH_NAMES[month - 1].substring(0, 3)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.pickerColumn}>
                        <ScrollView
                            ref={dayScrollRef}
                            style={styles.pickerScroll}
                            showsVerticalScrollIndicator={false}
                            snapToInterval={ITEM_HEIGHT}
                            decelerationRate="fast"
                            contentContainerStyle={{ paddingVertical: PICKER_PADDING }}
                            onMomentumScrollEnd={(e) => handleScrollEnd(e, dayList, setSelectedDay)}
                        >
                            {dayList.map((day) => (
                                <TouchableOpacity
                                    key={day}
                                    style={styles.pickerItem}
                                    onPress={() => selectValue(dayList, day, dayScrollRef, setSelectedDay)}
                                >
                                    <Text
                                        style={[
                                            styles.pickerItemText,
                                            selectedDay === day.toString() && {
                                                color: accentColor,
                                                fontWeight: '700',
                                                fontSize: 17,
                                            },
                                        ]}
                                    >
                                        {day}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>

                <View style={styles.sheetFooter}>
                    <TouchableOpacity
                        style={[styles.sheetButton, styles.sheetButtonCancel]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.sheetButtonCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sheetButton, { backgroundColor: accentColor }]}
                        onPress={handleConfirm}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.sheetButtonConfirmText}>Confirm</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
};

export default function LoginScreen() {
    const router = useRouter();
    const { loginWithPassword, register, isLoading: authLoading, cancelDeletion, logout, user } = useAuth();
    const params = useLocalSearchParams<{ role?: string }>();

    const role: RoleParam = params.role === 'mistri' ? 'mistri' : 'user';
    const config = ROLE_CONFIG[role];

    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [formData, setFormData] = useState<FormData>({
        name: '',
        phone: '',
        password: '',
        dob: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [focusedField, setFocusedField] = useState<FieldName | null>(null);
    
    // ✅ Deletion prompt state
    const [showDeletionPrompt, setShowDeletionPrompt] = useState(false);
    const [deletionDate, setDeletionDate] = useState<string | null>(null);
    const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);

    const nameInputRef = useRef<TextInput>(null);
    const phoneInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);

    // Entrance animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const riseAnim = useRef(new Animated.Value(16)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const switchAnim = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
            Animated.timing(riseAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]).start();
    }, []);

    useEffect(() => {
        Animated.timing(switchAnim, {
            toValue: mode === 'login' ? 0 : 1,
            duration: 240,
            useNativeDriver: false,
        }).start();
    }, [mode]);

    const triggerShake = () => {
        shakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 5, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]).start();
    };

    const showToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
        Toast.show({
            type,
            text1: title,
            text2: message,
            position: 'top',
            visibilityTime: 3000,
            autoHide: true,
            topOffset: 50,
        });
    };

    // BUG FIX: the original regex `[6-9]\d{9}` accepted any 10-digit number
    // starting with 6-9, including numbers starting with "6" or plain "7"
    // which Nepali mobile numbers never do - they're all 10 digits
    // starting with "9" (96/97/98xxxxxxxx).
    const validatePhone = (phoneNumber: string): boolean => {
        return /^9[6-8]\d{8}$/.test(phoneNumber);
    };

    const validateForm = (): boolean => {
        const newErrors: Errors = {};

        if (mode === 'signup') {
            if (!formData.name.trim()) {
                newErrors.name = 'Full name is required';
            } else if (formData.name.trim().length < 2) {
                newErrors.name = 'Name must be at least 2 characters';
            }

            if (!formData.dob) {
                newErrors.dob = 'Date of birth is required';
            } else {
                const age = calculateAgeFromNepaliDate(formData.dob);
                if (age !== null && age < 18) {
                    newErrors.dob = 'You must be at least 18 years old';
                }
            }
        }

        if (!formData.phone) {
            newErrors.phone = 'Phone number is required';
        } else if (!validatePhone(formData.phone)) {
            newErrors.phone = 'Enter a valid 10-digit Nepali number';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
        }
    };

    const handlePhoneChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length <= 10) {
            handleInputChange('phone', cleaned);
        }
    };

    // ✅ Handle cancel deletion
    const handleCancelDeletion = async () => {
        try {
            setIsCancellingDeletion(true);
            await cancelDeletion();
            setShowDeletionPrompt(false);
            
            // Show success message
            Alert.alert(
                'Deletion Cancelled',
                'Your account deletion has been cancelled. You can continue using ServeX.',
                [
                    {
                        text: 'Continue',
                        onPress: () => {
                            // Navigate to dashboard based on role
                            const userRole = user?.role;
                            if (userRole === 'mistri') {
                                const isOnboarded = user?.isOnboarded;
                                const approvalStatus = user?.approvalStatus;
                                
                                if (!isOnboarded) {
                                    router.replace('/onboarding/mistri');
                                } else if (approvalStatus !== 'approved') {
                                    router.replace('/pending-approval');
                                } else {
                                    router.replace('/(protected)/(mistri)');
                                }
                            } else {
                                const isOnboarded = user?.isOnboarded;
                                if (!isOnboarded) {
                                    router.replace('/onboarding/customer');
                                } else {
                                    router.replace('/(protected)/(customer)');
                                }
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to cancel deletion'
            );
        } finally {
            setIsCancellingDeletion(false);
        }
    };

    // ✅ Handle logout from deletion prompt
    const handleLogoutFromDeletion = async () => {
        await logout();
        setShowDeletionPrompt(false);
        // Stay on login screen
        showToast('info', 'Logged Out', 'You have been logged out');
    };

    const handleContinue = async () => {
        if (!validateForm()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            triggerShake();
            return;
        }

        setIsSubmitting(true);

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            if (mode === 'signup') {
                await register({
                    phone: formData.phone,
                    fullName: formData.name.trim(),
                    password: formData.password,
                    dob: formData.dob,
                    role,
                });

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast('success', 'Registration Successful', 'Please verify your phone number with OTP');

                router.push({
                    pathname: '/verify-otp',
                    params: {
                        phone: formData.phone,
                        role,
                        mode: 'signup',
                        name: formData.name.trim(),
                    },
                });
            } else {
                const response = await loginWithPassword(formData.phone, formData.password);
                
                // ✅ Check if account has scheduled deletion
                if (response?.requiresDeletionAction && response?.deletionScheduledAt) {
                    setDeletionDate(response.deletionScheduledAt);
                    setShowDeletionPrompt(true);
                    setIsSubmitting(false);
                    return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (response?.isVerified === false || response?.user?.isVerified === false) {
                    showToast('info', 'Verification Required', 'Please verify your phone number first');
                    router.push({
                        pathname: '/verify-otp',
                        params: {
                            phone: formData.phone,
                            role,
                            mode: 'login',
                        },
                    });
                    return;
                }

                if (response?.user) {
                    showToast('success', 'Welcome Back!', `Hello ${response.user.fullName}`);

                    const userRole = response.user.role;
                    const isOnboarded = response.user.isOnboarded || response.user.is_onboarded;
                    const approvalStatus = response.user.approvalStatus || response.user.approval_status;

                    if (userRole === 'mistri') {
                        if (!isOnboarded) {
                            router.replace('/onboarding/mistri');
                        } else if (approvalStatus !== 'approved') {
                            router.replace('/pending-approval');
                        } else {
                            router.replace('/(protected)/(mistri)');
                        }
                    } else if (userRole === 'user') {
                        if (!isOnboarded) {
                            router.replace('/onboarding/customer');
                        } else {
                            router.replace('/(protected)/(customer)');
                        }
                    } else {
                        router.replace('/');
                    }
                }
            }
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showToast('error', 'Authentication Failed', error?.message || 'Please try again');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = isSubmitting || authLoading;

    const switchContainerWidth = width - 48;
    const switchPadding = 4;
    const pillWidth = (switchContainerWidth - switchPadding * 2) / 2;
    const pillLeft = switchAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [switchPadding, switchPadding + pillWidth],
    });

    const focusStyle = (field: FieldName) =>
        focusedField === field
            ? {
                  borderColor: config.accent,
                  borderWidth: 1.5,
                  backgroundColor: '#fff',
                  shadowColor: config.accent,
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
              }
            : null;

    const onPressInButton = () => {
        Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    };
    const onPressOutButton = () => {
        Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
    };

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header with Logo */}
                        <LinearGradient
                            colors={config.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.headerGradient}
                        >
                            <View style={styles.headerDecorCircleOne} />
                            <View style={styles.headerDecorCircleTwo} />

                            <TouchableOpacity
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.back();
                                }}
                                style={styles.backButton}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel="Go back"
                            >
                                <Ionicons name="arrow-back" size={22} color="#fff" />
                            </TouchableOpacity>

                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../../assets/images/icon.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                                <Text style={styles.brandText}>ServeX</Text>
                            </View>

                            <Text style={styles.title}>{config.title}</Text>
                            <Text style={styles.subtitle}>{config.subtitle}</Text>
                        </LinearGradient>

                        {/* Mode Switch */}
                        <View style={styles.switchContainer}>
                            <Animated.View
                                style={[
                                    styles.switchPill,
                                    { left: pillLeft, width: pillWidth, backgroundColor: config.accent },
                                ]}
                            />
                            <TouchableOpacity
                                style={styles.switchButton}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setMode('login');
                                    setErrors({});
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>
                                    Login
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.switchButton}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setMode('signup');
                                    setErrors({});
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.switchText, mode === 'signup' && styles.switchTextActive]}>
                                    Sign Up
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <Animated.View
                            style={[
                                styles.formContainer,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: riseAnim }, { translateX: shakeAnim }],
                                },
                            ]}
                        >
                            {mode === 'signup' && (
                                <>
                                    <View style={[styles.inputGroup, focusStyle('name'), errors.name && styles.inputGroupError]}>
                                        <View style={styles.inputIcon}>
                                            <Ionicons name="person-outline" size={20} color={config.accent} />
                                        </View>
                                        <TextInput
                                            ref={nameInputRef}
                                            placeholder={config.placeholder}
                                            placeholderTextColor="#999"
                                            value={formData.name}
                                            onChangeText={(text) => handleInputChange('name', text)}
                                            onFocus={() => setFocusedField('name')}
                                            onBlur={() => setFocusedField(null)}
                                            style={styles.input}
                                            autoCapitalize="words"
                                            autoComplete="name"
                                            textContentType="name"
                                            returnKeyType="next"
                                            onSubmitEditing={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setShowDatePicker(true);
                                            }}
                                        />
                                    </View>
                                    {errors.name && (
                                        <View style={styles.errorRow}>
                                            <Ionicons name="alert-circle" size={13} color="#ff3b30" />
                                            <Text style={styles.errorText}>{errors.name}</Text>
                                        </View>
                                    )}

                                    <View style={[styles.inputGroup, errors.dob && styles.inputGroupError]}>
                                        <View style={styles.inputIcon}>
                                            <Ionicons name="calendar-outline" size={20} color={config.accent} />
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setShowDatePicker(true);
                                            }}
                                            activeOpacity={0.7}
                                            style={styles.dateInputField}
                                            accessibilityRole="button"
                                            accessibilityLabel="Select date of birth"
                                        >
                                            <Text style={formData.dob ? styles.dateInputText : styles.dateInputPlaceholder}>
                                                {formData.dob ? formatDisplayDate(formData.dob) : 'Date of Birth (BS)'}
                                            </Text>
                                            <MaterialIcons name="calendar-today" size={20} color={config.accent} />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.dob && (
                                        <View style={styles.errorRow}>
                                            <Ionicons name="alert-circle" size={13} color="#ff3b30" />
                                            <Text style={styles.errorText}>{errors.dob}</Text>
                                        </View>
                                    )}
                                </>
                            )}

                            <View style={[styles.inputGroup, focusStyle('phone'), errors.phone && styles.inputGroupError]}>
                                <View style={styles.inputIcon}>
                                    <Ionicons name="call-outline" size={20} color={config.accent} />
                                </View>
                                <View style={styles.phoneWrapper}>
                                    <View style={styles.countryCode}>
                                        <Text style={styles.countryText}>+977</Text>
                                    </View>
                                    <View style={styles.countryDivider} />
                                    <TextInput
                                        ref={phoneInputRef}
                                        placeholder="98XXXXXXXX"
                                        placeholderTextColor="#999"
                                        value={formData.phone}
                                        onChangeText={handlePhoneChange}
                                        onFocus={() => setFocusedField('phone')}
                                        onBlur={() => setFocusedField(null)}
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        style={styles.phoneInput}
                                        autoComplete="tel"
                                        textContentType="telephoneNumber"
                                        returnKeyType="next"
                                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                                    />
                                </View>
                            </View>
                            {errors.phone && (
                                <View style={styles.errorRow}>
                                    <Ionicons name="alert-circle" size={13} color="#ff3b30" />
                                    <Text style={styles.errorText}>{errors.phone}</Text>
                                </View>
                            )}

                            <View style={[styles.inputGroup, focusStyle('password'), errors.password && styles.inputGroupError]}>
                                <View style={styles.inputIcon}>
                                    <Ionicons name="lock-closed-outline" size={20} color={config.accent} />
                                </View>
                                <TextInput
                                    ref={passwordInputRef}
                                    placeholder="Password"
                                    placeholderTextColor="#999"
                                    value={formData.password}
                                    onChangeText={(text) => handleInputChange('password', text)}
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                    secureTextEntry={!showPassword}
                                    style={styles.input}
                                    autoCapitalize="none"
                                    autoComplete={mode === 'signup' ? 'new-password' : 'password'}
                                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                                    returnKeyType="done"
                                    onSubmitEditing={handleContinue}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setShowPassword(!showPassword);
                                    }}
                                    style={styles.passwordToggle}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#999"
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password && (
                                <View style={styles.errorRow}>
                                    <Ionicons name="alert-circle" size={13} color="#ff3b30" />
                                    <Text style={styles.errorText}>{errors.password}</Text>
                                </View>
                            )}

                            {/* Submit Button */}
                            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        { backgroundColor: config.accent },
                                        isLoading && styles.buttonDisabled,
                                    ]}
                                    onPress={handleContinue}
                                    onPressIn={onPressInButton}
                                    onPressOut={onPressOutButton}
                                    disabled={isLoading}
                                    activeOpacity={0.9}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {mode === 'login' ? 'Login' : 'Create Account'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>

                            {mode === 'login' && (
                                <TouchableOpacity
                                    style={styles.forgotPassword}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        router.push('/forgot-password');
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Date Picker Modal */}
                <DatePickerModal
                    visible={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    onConfirm={(date) => {
                        handleInputChange('dob', date);
                        const age = calculateAgeFromNepaliDate(date);
                        if (age !== null && age < 18) {
                            showToast('info', 'Age Notice', `You are ${age} years old. Minimum age is 18.`);
                        } else if (age !== null) {
                            showToast('success', 'Date Selected', `${formatDisplayDate(date)} (Age: ${age})`);
                        }
                    }}
                    initialDate={formData.dob}
                    accentColor={config.accent}
                />

                {/* ✅ Deletion Prompt Modal */}
                <DeletionPromptModal
                    visible={showDeletionPrompt}
                    deletionDate={deletionDate}
                    onCancelDeletion={handleCancelDeletion}
                    onLogout={handleLogoutFromDeletion}
                    isLoading={isCancellingDeletion}
                />
            </SafeAreaView>
            <Toast />
        </>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    headerGradient: {
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 40,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        minHeight: height * 0.28,
        overflow: 'hidden',
        position: 'relative',
    },
    headerDecorCircleOne: {
        position: 'absolute',
        top: -60,
        right: -50,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    headerDecorCircleTwo: {
        position: 'absolute',
        bottom: -70,
        left: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    backButton: {
        position: 'absolute',
        top: 16,
        left: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    logo: {
        width: 48,
        height: 48,
        marginRight: 12,
    },
    brandText: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    title: {
        fontSize: 21,
        fontWeight: '700',
        color: '#fff',
        marginTop: 4,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    switchContainer: {
        flexDirection: 'row',
        backgroundColor: '#f1f2f6',
        borderRadius: 30,
        padding: 4,
        marginHorizontal: 24,
        marginTop: 24,
        marginBottom: 24,
        position: 'relative',
    },
    switchPill: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        borderRadius: 26,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    switchButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 26,
        zIndex: 1,
    },
    switchText: {
        fontWeight: '600',
        color: '#666',
        fontSize: 15,
    },
    switchTextActive: {
        color: '#fff',
    },
    formContainer: {
        paddingHorizontal: 24,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        overflow: 'hidden',
    },
    inputGroupError: {
        borderColor: '#ff3b30',
        borderWidth: 1.5,
        backgroundColor: '#fff8f8',
    },
    inputIcon: {
        paddingLeft: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#333',
    },
    phoneWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    countryCode: {
        paddingLeft: 12,
        justifyContent: 'center',
    },
    countryText: {
        fontWeight: '600',
        color: '#333',
        fontSize: 15,
    },
    countryDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#ddd',
        marginLeft: 10,
    },
    phoneInput: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#333',
    },
    dateInputField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    dateInputText: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    dateInputPlaceholder: {
        fontSize: 15,
        color: '#999',
    },
    passwordToggle: {
        paddingHorizontal: 16,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
        marginTop: -8,
        marginLeft: 12,
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 12,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    forgotPassword: {
        alignItems: 'center',
        marginTop: 20,
    },
    forgotPasswordText: {
        color: '#666',
        fontSize: 14,
    },
    // ---- Date picker bottom sheet ----
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheetContent: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 12,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e0e0e0',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#222',
    },
    sheetClose: {
        position: 'absolute',
        right: 16,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    selectedDateContainer: {
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        gap: 8,
    },
    selectedDateText: {
        fontSize: 19,
        fontWeight: '700',
    },
    agePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
    },
    agePillText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pickerRow: {
        flexDirection: 'row',
        height: PICKER_ROW_HEIGHT,
        paddingHorizontal: 8,
        position: 'relative',
    },
    pickerHighlight: {
        position: 'absolute',
        left: 8,
        right: 8,
        top: (PICKER_ROW_HEIGHT - ITEM_HEIGHT) / 2,
        height: ITEM_HEIGHT,
        borderRadius: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    pickerScroll: {
        flex: 1,
        width: '100%',
    },
    pickerItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    pickerItemText: {
        fontSize: 15,
        color: '#999',
    },
    sheetFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    sheetButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    sheetButtonCancel: {
        backgroundColor: '#f0f0f0',
    },
    sheetButtonCancelText: {
        color: '#666',
        fontWeight: '600',
    },
    sheetButtonConfirmText: {
        color: '#fff',
        fontWeight: '600',
    },
});