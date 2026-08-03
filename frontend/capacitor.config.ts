import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.scaleupp.app",
  appName: "ScaleUpp",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#0d9488",
    },
  },
};

export default config;
