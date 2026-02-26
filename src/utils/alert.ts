import { Alert } from 'react-native';

let customAlertCallback: ((props: {
  title: string;
  message: string;
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
}) => void) | null = null;

export const setCustomAlertHandler = (handler: typeof customAlertCallback) => {
  customAlertCallback = handler;
};

export const showAlert = (
  title: string,
  message: string,
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[]
) => {
  const alertButtons = buttons || [];
  if (customAlertCallback) {
    customAlertCallback({ title, message, buttons: alertButtons });
  } else {
    Alert.alert(title, message, alertButtons.map(b => ({
      text: b.text,
      onPress: b.onPress,
      style: b.style
    })));
  }
}; 