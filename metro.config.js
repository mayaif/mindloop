const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation ships a wa-sqlite.wasm asset — Metro
// doesn't treat .wasm as an asset type by default, so without this it fails
// to resolve on `expo export --platform web` / `expo start --web`.
config.resolver.assetExts.push('wasm');

module.exports = withNativeWind(config, { input: './src/global.css' });
