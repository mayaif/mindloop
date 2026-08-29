/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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
