# COM setup

This repository is prepared as a monorepo for:

- `com-api`: Laravel API
- `com-mobile`: React Native / Expo app

## Required GitHub Actions secrets

Add these repository secrets before running Actions:

- `COM_SSH_HOST`
- `COM_SSH_PORT`
- `COM_SSH_USER`
- `COM_PROJECT_PATH`
- `COM_SSH_PRIVATE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

## First-time bootstrap

Run the manual workflow:

`Actions` > `Bootstrap COM` > `Run workflow`

The workflow connects to the server, creates the Laravel API and Expo mobile app if they do not already exist, prepares basic environment files, then commits generated project files back to `main`.

## Deployment

Every push to `main` runs:

`Deploy COM`

The deployment workflow pulls the latest code to the server path, installs Composer dependencies for the API, runs safe Laravel cache commands, and installs mobile dependencies if the mobile app exists.

## Expected API health endpoint

After bootstrap, the API contains:

`GET /api/v1/health`

Expected JSON response:

```json
{
  "ok": true,
  "app": "COM API",
  "version": "v1"
}
```
