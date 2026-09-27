# Implementation Plan - Ozone Generator Outreach Automation

This plan outlines the steps to add a business outreach feature for "Ozone Generator cleaning services" to the Intermingled app (or as a new standalone feature). This will involve finding nearby businesses and facilitating phone calls.

## User Review Required

> [!IMPORTANT]
> **OS Restrictions on Automated Calling**: Android and iOS do not allow apps to initiate phone calls without user confirmation for security reasons. "Automating" will likely mean providing a streamlined workflow to call multiple businesses in sequence (one-tap dialing).

## Open Questions

1. **API for Business Search**: Should we use the Google Places API? If so, do you have an API key? (I will use a mock for now if not provided).
2. **Target Businesses**: Which types of businesses should we target for "Ozone Generator cleaning services"? (e.g., Hotels, Gyms, Car Detailers).
3. **Location**: Should it always use the user's current location, or should they be able to enter a zip code (like 95152)?

## Proposed Changes

### [Business Outreach Module]

#### [NEW] [BusinessService.ts](file:///C:/Users/Ivan Work/Projects/intermingled-/artifacts/flirtfest-mobile-native/src/lib/BusinessService.ts)
- Implement a service to fetch nearby businesses.
- Support filtering by keyword (e.g., "hotel").
- Handle extraction of phone numbers and addresses.

#### [NEW] [OutreachScreen.tsx](file:///C:/Users/Ivan Work/Projects/intermingled-/artifacts/flirtfest-mobile-native/src/screens/OutreachScreen.tsx)
- UI to display a list of target businesses.
- "Call" button for each item using `Linking.openURL`.
- Progress tracking (e.g., "Called", "Interested", "Not Interested").

#### [MODIFY] [AppNavigator.tsx](file:///C:/Users/Ivan Work/Projects/intermingled-/artifacts/flirtfest-mobile-native/src/navigation/AppNavigator.tsx)
- Add `Outreach` screen to the root stack.

#### [MODIFY] [HomeScreen.tsx](file:///C:/Users/Ivan Work/Projects/intermingled-/artifacts/flirtfest-mobile-native/src/screens/HomeScreen.tsx)
- Add a navigation entry for "Business Outreach" (perhaps under a new "Business Tools" section).

## Verification Plan

### Automated Tests
- Unit tests for `BusinessService` (mocking API responses).

### Manual Verification
- Verify `expo-location` correctly gets coordinates.
- Verify the list of businesses renders correctly.
- Verify tapping "Call" opens the system dialer with the correct number.
