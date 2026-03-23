/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",  // ← ADD THIS
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
