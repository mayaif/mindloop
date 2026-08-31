/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // NativeWind defaults to darkMode: 'media', which only lets the OS decide
  // via a CSS media query — react-native-css-interop then throws
  // "Cannot manually set color scheme, as dark mode is type 'media'" the
  // moment anything (e.g. Expo web's Appearance polyfill, triggered by
  // app.json's userInterfaceStyle: "automatic") calls setColorScheme(). We
  // haven't designed a dark palette yet, so 'class' mode just stops the
  // crash and keeps the app on the light palette until dark: variants exist.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sage green + cream palette, approximated by eye from the Stitch
        // design PNGs (not pixel-sampled) — refine against the reference
        // images when building the actual screens.
        background: '#F5F4F0',
        foreground: '#1F2A22',
        card: '#FFFFFF',
        border: '#E4E2DA',
        primary: {
          DEFAULT: '#3F5C43',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#EFEDE6',
          foreground: '#6B7268',
        },
      },
    },
  },
  plugins: [],
};
