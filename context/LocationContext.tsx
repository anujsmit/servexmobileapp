import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

interface LocationContextType {
    location: Location.LocationObject | null;
    address: string;
    coordinates: LocationCoordinates | null;
    isLoading: boolean;
    error: string | null;
    refreshLocation: () => Promise<void>;
    updateLocation: (newLocation: Location.LocationObject) => void;
    updateAddress: (newAddress: string) => void;
    setCustomLocation: (coords: LocationCoordinates) => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const GEOCODE_MIN_INTERVAL_MS = 60000;
const GEOCODE_MIN_DISTANCE_KM = 0.05;
const addressCache = new Map<string, string>();

const coordsKey = (coords: LocationCoordinates) =>
    `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;

const haversineDistanceKm = (a: LocationCoordinates, b: LocationCoordinates): number => {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [address, setAddress] = useState<string>('Detecting location...');
    const [coordinates, setCoordinates] = useState<LocationCoordinates | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const lastGeocodeAt = useRef<number>(0);
    const lastGeocodeCoords = useRef<LocationCoordinates | null>(null);

    const reverseGeocode = async (coords: LocationCoordinates): Promise<string> => {
        const key = coordsKey(coords);
        const cached = addressCache.get(key);
        if (cached) return cached;
        try {
            const addressResult = await Location.reverseGeocodeAsync(coords);
            if (addressResult.length > 0) {
                const { name, street, city, region, country } = addressResult[0];
                const formattedAddress = `${name || street || ''}, ${city}, ${country}`.replace(/^,\s*/, '');
                addressCache.set(key, formattedAddress || 'Unknown location');
                return formattedAddress || 'Unknown location';
            }
            addressCache.set(key, 'Unknown location');
            return 'Unknown location';
        } catch (error) {
            if (__DEV__) console.error('Failed to reverse geocode', error);
            const fallback = 'Could not fetch address';
            addressCache.set(key, fallback);
            return fallback;
        }
    };

    const fetchLocation = async (): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Permission denied');
                setAddress('Location permission denied');
                setIsLoading(false);
                Alert.alert('Permission denied', 'Permission to access location was denied');
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation);

            const coords: LocationCoordinates = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
            };
            setCoordinates(coords);

            const key = coordsKey(coords);
            const cached = addressCache.get(key);
            if (cached) {
                setAddress(cached);
                return;
            }

            const now = Date.now();
            if (lastGeocodeCoords.current) {
                const distance = haversineDistanceKm(lastGeocodeCoords.current, coords);
                const recentlyGeocoded = now - lastGeocodeAt.current < GEOCODE_MIN_INTERVAL_MS;
                if (distance < GEOCODE_MIN_DISTANCE_KM && recentlyGeocoded) {
                    return;
                }
            }

            const fetchedAddress = await reverseGeocode(coords);
            setAddress(fetchedAddress);
            lastGeocodeAt.current = now;
            lastGeocodeCoords.current = coords;
        } catch (error) {
            if (__DEV__) console.error('Error fetching location:', error);
            setError('Could not fetch location');
            setAddress('Could not fetch location');
            Alert.alert('Error', 'Could not fetch location. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const refreshLocation = async (): Promise<void> => {
        await fetchLocation();
    };

    const updateLocation = (newLocation: Location.LocationObject): void => {
        setLocation(newLocation);
        const coords: LocationCoordinates = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
        };
        setCoordinates(coords);
    };

    const updateAddress = (newAddress: string): void => {
        setAddress(newAddress);
    };

    const setCustomLocation = async (coords: LocationCoordinates): Promise<void> => {
        setCoordinates(coords);
        setAddress('Updating address...');
        const fetchedAddress = await reverseGeocode(coords);
        setAddress(fetchedAddress);
    };

    // Fetch location on mount
    useEffect(() => {
        fetchLocation();
    }, []);

    return (
        <LocationContext.Provider
            value={{
                location,
                address,
                coordinates,
                isLoading,
                error,
                refreshLocation,
                updateLocation,
                updateAddress,
                setCustomLocation,
            }}
        >
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = (): LocationContextType => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
