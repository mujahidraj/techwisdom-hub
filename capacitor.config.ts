import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.techwisdom.erp',
  appName: 'TechWisdom ERP',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
 plugins: {
    LocalNotifications: {
      // Remove the "smallIcon" line. Let Android decide.
      iconColor: "#488AFF",
      presentationOptions: ["badge", "sound", "alert"] // This forces the visual banner
    },
  },
};

export default config;