import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface SearchResult {
    place_id: string;
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    address?: {
        road?: string;
        suburb?: string;
        city?: string;
        county?: string;
        state?: string;
        country?: string;
    };
}

interface ExpandableMapSelectorProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (location: { latitude: number; longitude: number }) => void;
    initialLocation?: { latitude: number; longitude: number } | null;
    accentColor?: string;
}

function getShortName(result: SearchResult): string {
    const a = result.address;
    if (a) {
        const parts = [a.road, a.suburb, a.city || a.county, a.state].filter(Boolean);
        if (parts.length > 0) return parts.slice(0, 3).join(', ');
    }
    // Fallback: trim the display_name to first 2 comma-parts
    return result.display_name.split(',').slice(0, 2).join(',').trim();
}

export const ExpandableMapSelector: React.FC<ExpandableMapSelectorProps> = ({
    visible,
    onClose,
    onConfirm,
    initialLocation,
    accentColor = '#059669',
}) => {
    const mapRef = useRef<MapView>(null);
    const searchInputRef = useRef<TextInput>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [region, setRegion] = useState<Region>({
        latitude: initialLocation?.latitude || 27.7172,
        longitude: initialLocation?.longitude || 85.3240,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });
    const [centerCoordinate, setCenterCoordinate] = useState({
        latitude: initialLocation?.latitude || 27.7172,
        longitude: initialLocation?.longitude || 85.3240,
    });
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (initialLocation) {
            const r = {
                latitude: initialLocation.latitude,
                longitude: initialLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(r);
            setCenterCoordinate(initialLocation);
        }
    }, [initialLocation]);

    // Reset search when modal closes
    useEffect(() => {
        if (!visible) {
            setSearchQuery('');
            setSearchResults([]);
            setShowResults(false);
        }
    }, [visible]);

    const searchPlaces = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        setIsSearching(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1&countrycodes=np`,
                { headers: { 'User-Agent': 'MistriApp/1.0' } }
            );
            if (!response.ok) throw new Error('Search failed');
            const data: SearchResult[] = await response.json();
            setSearchResults(data);
            setShowResults(data.length > 0);
        } catch {
            setSearchResults([]);
            setShowResults(false);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (text.trim().length < 2) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        debounceTimer.current = setTimeout(() => searchPlaces(text), 400);
    };

    const handleSelectResult = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const newRegion: Region = {
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
        };
        setRegion(newRegion);
        setCenterCoordinate({ latitude: lat, longitude: lon });
        mapRef.current?.animateToRegion(newRegion, 600);
        setSearchQuery(getShortName(result));
        setShowResults(false);
        Keyboard.dismiss();
    };

    const handleRegionChangeComplete = (newRegion: Region) => {
        setRegion(newRegion);
        setCenterCoordinate({
            latitude: newRegion.latitude,
            longitude: newRegion.longitude,
        });
    };

    const getCurrentLocation = async () => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            const newRegion: Region = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
            setCenterCoordinate({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            mapRef.current?.animateToRegion(newRegion, 800);
            setSearchQuery('');
            setShowResults(false);
        } catch {
            Alert.alert('Error', 'Failed to get current location. Please try again.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleConfirm = () => {
        onConfirm(centerCoordinate);
        onClose();
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        searchInputRef.current?.focus();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#ffffff' }} behavior="padding">
                {/* Header */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14,
                    backgroundColor: '#ffffff',
                    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
                }}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ padding: 8, borderRadius: 20, backgroundColor: '#f1f5f9' }}
                    >
                        <MaterialIcons name="close" size={22} color="#374151" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>
                        Set Service Location
                    </Text>
                    <View style={{ width: 38 }} />
                </View>

                {/* Map + Search overlay */}
                <View style={{ flex: 1, position: 'relative' }}>
                    <MapView
                        ref={mapRef}
                        style={{ ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } }}
                        region={region}
                        onRegionChangeComplete={handleRegionChangeComplete}
                        showsUserLocation
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        onPress={() => {
                            if (showResults) {
                                setShowResults(false);
                                Keyboard.dismiss();
                            }
                        }}
                    />

                    {/* Center crosshair pin */}
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            marginLeft: -20, marginTop: -44,
                            alignItems: 'center',
                        }}
                    >
                        <View style={{
                            width: 40, height: 40, borderRadius: 20,
                            backgroundColor: `${accentColor}33`,
                            borderWidth: 2, borderColor: accentColor,
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <View style={{
                                width: 12, height: 12, borderRadius: 6,
                                backgroundColor: accentColor,
                            }} />
                        </View>
                        <View style={{
                            width: 0, height: 0,
                            borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 16,
                            borderLeftColor: 'transparent', borderRightColor: 'transparent',
                            borderTopColor: accentColor,
                            marginTop: -2,
                        }} />
                    </View>

                    {/* Search bar — floats over the top of the map */}
                    <View style={{
                        position: 'absolute', top: 16, left: 16, right: 16,
                        zIndex: 10,
                    }}>
                        {/* Input row */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: '#ffffff',
                            borderRadius: 14, borderCurve: 'continuous',
                            paddingHorizontal: 14, paddingVertical: 10,
                            gap: 10,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                        }}>
                            {isSearching
                                ? <ActivityIndicator size="small" color={accentColor} />
                                : <MaterialIcons name="search" size={22} color="#94a3b8" />
                            }
                            <TextInput
                                ref={searchInputRef}
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                                placeholder="Search for a place or address…"
                                placeholderTextColor="#94a3b8"
                                style={{ flex: 1, fontSize: 15, color: '#0f172a', paddingVertical: 0 }}
                                returnKeyType="search"
                                onSubmitEditing={() => searchPlaces(searchQuery)}
                                clearButtonMode="never"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close-circle" size={20} color="#cbd5e1" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Results dropdown */}
                        {showResults && (
                            <View style={{
                                backgroundColor: '#ffffff',
                                borderRadius: 14, borderCurve: 'continuous',
                                marginTop: 6,
                                overflow: 'hidden',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                                maxHeight: 280,
                            }}>
                                <FlatList
                                    data={searchResults}
                                    keyExtractor={item => item.place_id}
                                    keyboardShouldPersistTaps="always"
                                    bounces={false}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            onPress={() => handleSelectResult(item)}
                                            activeOpacity={0.7}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center', gap: 12,
                                                paddingHorizontal: 14, paddingVertical: 13,
                                                borderTopWidth: index === 0 ? 0 : 1,
                                                borderTopColor: '#f1f5f9',
                                            }}
                                        >
                                            <View style={{
                                                width: 32, height: 32, borderRadius: 8, borderCurve: 'continuous',
                                                backgroundColor: `${accentColor}15`,
                                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                            }}>
                                                <MaterialIcons name="location-on" size={18} color={accentColor} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}
                                                    numberOfLines={1}
                                                >
                                                    {getShortName(item)}
                                                </Text>
                                                <Text
                                                    style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}
                                                    numberOfLines={1}
                                                >
                                                    {item.display_name.split(',').slice(2, 5).join(',').trim()}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}
                    </View>

                    {/* GPS button */}
                    <TouchableOpacity
                        onPress={getCurrentLocation}
                        disabled={loadingLocation}
                        style={{
                            position: 'absolute', bottom: 24, right: 16,
                            width: 52, height: 52, borderRadius: 26,
                            backgroundColor: '#ffffff',
                            alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                        }}
                    >
                        {loadingLocation
                            ? <ActivityIndicator size="small" color={accentColor} />
                            : <MaterialIcons name="my-location" size={24} color={accentColor} />
                        }
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={{
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40,
                    borderTopWidth: 1, borderTopColor: '#f1f5f9',
                }}>
                    {/* Coordinates pill */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, marginBottom: 14,
                        backgroundColor: '#f8fafc', borderRadius: 10,
                        padding: 10,
                    }}>
                        <MaterialIcons name="location-on" size={16} color={accentColor} />
                        <Text style={{
                            fontSize: 13, color: '#475569', fontFamily: 'monospace', fontWeight: '500',
                        }} selectable>
                            {centerCoordinate.latitude.toFixed(6)}, {centerCoordinate.longitude.toFixed(6)}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            paddingVertical: 16, borderRadius: 14, borderCurve: 'continuous',
                            backgroundColor: accentColor, gap: 8,
                        }}
                    >
                        <MaterialIcons name="check" size={20} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                            Confirm Location
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
