import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastinhosimples.app',
  appName: 'Gastinho Simples',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    AdMob: {
      appIdAndroid: "ca-app-pub-3940256099942544~3347511713" // ID de teste
    }
  }
};

export default config;
