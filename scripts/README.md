# Capacitor Development Environment Setup

This directory contains scripts for Capacitor development and deployment.

## Available Scripts

### capacitor-setup.sh
Automated setup script that:
- Installs dependencies
- Builds the web application
- Initializes Capacitor
- Adds Android platform
- Copies web assets
- Syncs all platforms

**Usage:**
```bash
bash scripts/capacitor-setup.sh
```

## Manual Commands

If you prefer to run commands manually:

```bash
# Install dependencies
npm install

# Build web app
npm run build

# Initialize Capacitor
npx cap init talkme com.talkme.app --web-dir=dist

# Add Android platform
npx cap add android

# Copy web assets
npx cap copy android

# Sync platforms
npx cap sync

# Open in Android Studio
npx cap open android
```

## Troubleshooting

If you encounter issues, try these steps in order:

1. **Clear and reinstall**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Rebuild everything**
   ```bash
   npm run build
   rm -rf android/
   npx cap add android
   npx cap sync
   ```

3. **Clear Gradle cache**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

4. **Check versions**
   ```bash
   node --version  # Should be 20+
   npm --version   # Should be 10+
   npx cap --version  # Should show Capacitor 7.x
   ```
