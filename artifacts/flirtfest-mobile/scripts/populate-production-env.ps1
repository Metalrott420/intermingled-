Set-Location "$PSScriptRoot/.."

Write-Host "Populate EAS production variables for @metalrott/intermingled" -ForegroundColor Cyan
Write-Host "Secrets should be entered directly in terminal when prompted." -ForegroundColor Yellow

# Known non-secret value
pnpm exec eas env:create production --name EXPO_PUBLIC_PROJECT_ID --value "600d565b-c228-43ef-9bcd-7d4c055b9151" --visibility plaintext --scope project --force --non-interactive

# Non-secret deployment domain (set your real production host)
pnpm exec eas env:create production --name EXPO_PUBLIC_DOMAIN --value "<set-production-domain>" --visibility plaintext --scope project --force --non-interactive

# Sensitive values (replace placeholders locally before running, or run commands manually)
pnpm exec eas env:create production --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "<set-clerk-publishable-key>" --visibility sensitive --scope project --force --non-interactive
pnpm exec eas env:create production --name EXPO_PUBLIC_REVENUECAT_TEST_API_KEY --value "<set-revenuecat-test-key>" --visibility sensitive --scope project --force --non-interactive
pnpm exec eas env:create production --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value "<set-revenuecat-ios-key>" --visibility sensitive --scope project --force --non-interactive
pnpm exec eas env:create production --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY --value "<set-revenuecat-android-key>" --visibility sensitive --scope project --force --non-interactive

pnpm exec eas env:list --environment production
