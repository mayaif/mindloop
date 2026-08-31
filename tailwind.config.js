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
        // Modern-vibrant refresh of the original sage/cream Stitch reference
        // — a punchier emerald primary plus a warm coral accent for
        // highlights, kept in sync with src/theme/colors.ts (which Feather
        // icons read from directly, since className can't reach their
        // `color` prop).
        background: '#FAF8F3',
        foreground: '#1C2620',
        card: '#FFFFFF',
        border: '#E9E4D8',
        // primary and muted.foreground are deliberately darker than a first
        // pass — see the WCAG contrast comments in src/theme/colors.ts,
        // which these must stay in sync with.
        primary: {
          DEFAULT: '#0A7A52',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#FF6B4A',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1EEE3',
          foreground: '#5B6255',
        },
      },
    },
  },
  plugins: [],
};
