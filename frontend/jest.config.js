module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  haste: {
    defaultPlatform: "android",
    platforms: ["android", "ios", "native"],
  },
};
