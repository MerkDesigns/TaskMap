module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        premium: "0 18px 55px rgba(8, 13, 22, 0.38)",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        taskmap: {
          primary: "#1d9a8a",
          secondary: "#d89f45",
          accent: "#e26f56",
          neutral: "#202428",
          "base-100": "#f6f3ec",
          "base-200": "#e9e3d8",
          "base-300": "#d7cec0",
          info: "#376eaa",
          success: "#24865f",
          warning: "#c78125",
          error: "#bc3e3e",
        },
      },
    ],
  },
};
