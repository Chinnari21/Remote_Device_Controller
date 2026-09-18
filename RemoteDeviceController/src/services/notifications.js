import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical Android device.');
      return null;
    }

    // Request notification permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied.');
      return null;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alarm-v2', {
        name: 'Alarm',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'alarm.wav',
        vibrationPattern: [0, 500, 500, 500],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // Get Firebase FCM token
    const token = await messaging().getToken();

    console.log('FCM TOKEN:', token);

    return token;
  } catch (error) {
    console.log('Notification registration error:', error);
    return null;
  }
}