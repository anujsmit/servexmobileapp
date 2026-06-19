# Play Store Assets

This directory contains all assets required for Google Play Store listing.

## Required Assets

### 1. App Icon (512×512)
**File:** `app-icon-512x512.png`
- **Dimensions:** 512×512 pixels
- **Format:** PNG (24-bit, no alpha channel)
- **Purpose:** High-resolution icon displayed in Play Store listing
- **Note:** This is different from the app's launcher icon

### 2. Feature Graphic (1024×500)
**File:** `feature-graphic-1024x500.png`
- **Dimensions:** 1024×500 pixels
- **Format:** PNG or JPEG
- **Purpose:** Banner displayed at the top of Play Store listing
- **Note:** Should be eye-catching and represent the app's brand

### 3. Screenshots (4-10 required)
**Directory:** `screenshots/`
- **Aspect Ratio:** 9:16 (portrait) or 16:9 (landscape)
- **Minimum Dimensions:** 1024×500 pixels
- **Maximum Width:** 3840 pixels
- **Format:** JPEG or PNG (24-bit, no alpha)
- **Quantity:** Minimum 4, maximum 10
- **Purpose:** Showcase app features and UI

#### Screenshot Naming Convention:
- `screenshot-01-home.png` - Home/Dashboard screen
- `screenshot-02-services.png` - Services listing
- `screenshot-03-booking.png` - Service booking flow
- `screenshot-04-tracking.png` - Real-time tracking
- `screenshot-05-profile.png` - User profile (optional)
- `screenshot-06-mistri-dashboard.png` - Mistri dashboard (optional)

## Best Practices

### App Icon
- Use high contrast and clear imagery
- Avoid text if possible
- Make it recognizable at small sizes
- Follow Google Play icon design guidelines
- Test on different background colors

### Feature Graphic
- Should work well as a banner
- Include app name or logo
- Use brand colors
- Keep important content in the center (safe zone)
- Avoid small text that may be hard to read

### Screenshots
- Capture on high-resolution device (1080×1920 or higher)
- Show key features and user flows
- Use actual app screens (not mockups)
- Consider adding captions or annotations
- Ensure UI looks polished and complete
- Remove any test/dummy data
- Show realistic use cases

## Asset Creation Tools

- **Design:** Figma, Adobe XD, Sketch, Canva
- **Screenshot Capture:** Android Studio Emulator, Physical Device
- **Image Editing:** Photoshop, GIMP, Pixelmator
- **Screenshot Tools:** 
  - Android Device Bridge (ADB): `adb shell screencap`
  - Expo Development Build on physical device
  - Android Studio screenshot tool

## Upload Instructions

1. Create all required assets and place them in this directory
2. Verify dimensions and formats match requirements
3. Upload to Google Play Console:
   - Go to Store presence → Main store listing
   - Scroll to Graphics section
   - Upload app icon, feature graphic, and screenshots
   - Add descriptions for each screenshot (optional but recommended)

## Checklist

Before uploading to Play Console:

- [ ] App icon created (512×512)
- [ ] Feature graphic created (1024×500)
- [ ] At least 4 screenshots captured
- [ ] All images are correct dimensions
- [ ] All images are PNG or JPEG (no alpha for JPEGs)
- [ ] Screenshots show polished, realistic app usage
- [ ] No placeholder or test data visible
- [ ] Images represent current app version
- [ ] All assets follow Google Play guidelines

## References

- [Google Play Asset Guidelines](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Play Store Graphic Assets Specifications](https://support.google.com/googleplay/android-developer/answer/1078870)
- [App Icon Design Guidelines](https://developer.android.com/google-play/resources/icon-design-specifications)
