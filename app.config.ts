import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "ServeX",
    slug: "servex",
    version: "1.0.0",
    description: "ServeX - Your trusted home service partner. Connect with verified electricians and plumbers in your area. Book services instantly, track professionals in real-time, and get quality service at your doorstep.",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "servex",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
        supportsTablet: true,
        infoPlist: {
            UIStatusBarStyle: "UIStatusBarStyleDarkContent",
            UIViewControllerBasedStatusBarAppearance: false,
            NSLocationWhenInUseUsageDescription: "ServeX needs your location to find nearby service professionals and show them on the map.",
            NSCameraUsageDescription: "ServeX needs camera access to capture photos for service verification.",
            NSPhotoLibraryUsageDescription: "ServeX needs access to your photo library to upload photos for service requests."
        },
        bundleIdentifier: "com.laayo.servexapp",
        config: {
            usesNonExemptEncryption: false
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/images/adaptive-icon.png",
            backgroundColor: "#ffffff"
        },
        config: {
            googleMaps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY
            }
        },
        softwareKeyboardLayoutMode: "pan",
        edgeToEdgeEnabled: true,
        package: "com.laayo.servexapp",
        playStoreUrl: "https://play.google.com/store/apps/details?id=com.laayo.servexapp",
        permissions: [
            "RECEIVE_BOOT_COMPLETED",
            "VIBRATE",
            "POST_NOTIFICATIONS",
            "ACCESS_FINE_LOCATION",
            "ACCESS_COARSE_LOCATION",
            "CAMERA",
            "READ_MEDIA_IMAGES"
        ],
        minSdkVersion: 31,
        targetSdkVersion: 35,
        compileSdkVersion: 35
    },
    plugins: [
        [
            "expo-camera",
            {
                "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera"
            }
        ],
        "expo-router",
        [
            "expo-splash-screen",
            {
                image: "./assets/images/splash-icon.png",
                imageWidth: 200,
                resizeMode: "contain",
                backgroundColor: "#ffffff"
            }
        ],
        "expo-secure-store",
        "expo-font",
        "expo-web-browser",
        [
            "expo-notifications",
            {
                icon: "./assets/images/notification-icon.png",
                color: "#ffffff",
                sounds: [
                    "./assets/sounds/notification.mp3"
                ],
                androidMode: "default",
                androidCollapsedTitle: "#{unread_notifications} new notifications"
            }
        ],
        [
            "expo-location",
            {
                isAndroidBackgroundLocationEnabled: false,
                locationWhenInUsePermission:
                    "ServeX needs your location while you use the app to find and connect you with nearby service professionals."
            }
        ]
    ],
    experiments: {
        typedRoutes: true
    },
    "extra": {
        "eas": {
            "projectId": "8daf9335-5cbc-4c09-8b37-8c35eb60c402"
        }
    },
    owner: "anujkattel"
});