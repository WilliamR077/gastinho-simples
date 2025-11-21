import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastinhosimples.app',
  appName: 'Gastinho Simples',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    AdMob: {
      appIdAndroid: "ca-app-pub-7994981472093749~6808485616" // ID de teste
    }
  }
};

export default config;
