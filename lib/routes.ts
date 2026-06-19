export const ROUTES = {
    // Public routes
    HOME: '/',

    // Auth routes
    LOGIN: '/login',
    VERIFY_OTP: '/verify-otp',

    // Onboarding routes
    ONBOARDING: {
        CUSTOMER: '/onboarding/customer',
        MISTRI: '/onboarding/mistri',
    },

    // Pending approval (mistri only)
    PENDING_APPROVAL: '/(protected)/pending-approval',

    // Protected routes
    CUSTOMER: {
        HOME: '/(protected)/(customer)',
        SERVICE_REQUEST: '/(protected)/(customer)/service-request',
        SEARCHING: '/(protected)/(customer)/searching',
    },

    MISTRI: {
        HOME: '/(protected)/(mistri)',
    }
} as const;

export type RouteType = typeof ROUTES;
