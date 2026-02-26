import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  ColorValue,
} from 'react-native';
import { Icon } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';

interface CustomAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: CustomAlertButton[];
  onDismiss?: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons,
  onDismiss
}) => {
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [scaleAnim] = React.useState(new Animated.Value(0.3));
  const [slideAnim] = React.useState(new Animated.Value(50));

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getIconName = () => {
    if (title.toLowerCase().includes('error')) return 'alert-circle';
    if (title.toLowerCase().includes('success')) return 'check-circle';
    if (title.toLowerCase().includes('warning')) return 'alert-triangle';
    return 'info';
  };

  const getIconColor = () => {
    if (title.toLowerCase().includes('error')) return '#FF5B5B';
    if (title.toLowerCase().includes('success')) return '#00C851';
    if (title.toLowerCase().includes('warning')) return '#FFD056';
    return '#3B82F6';
  };

  const getIconGradient = (): [string, string] => {
    if (title.toLowerCase().includes('error')) return ['#FF5B5B20', '#FF5B5B10'];
    if (title.toLowerCase().includes('success')) return ['#00C85120', '#00C85110'];
    if (title.toLowerCase().includes('warning')) return ['#FFD05620', '#FFD05610'];
    return ['#3B82F620', '#3B82F610'];
  };

  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.destructiveButton;
      case 'cancel':
        return styles.cancelButton;
      default:
        return styles.defaultButton;
    }
  };

  const getButtonGradient = (style?: 'default' | 'cancel' | 'destructive'): [string, string] => {
    switch (style) {
      case 'destructive':
        return ['#EF444460', '#EF4444'];
      case 'cancel':
        return ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'];
      default:
        return ['#3B82F660', '#3B82F6'];
    }
  };

  const getButtonTextStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'destructive':
        return styles.destructiveButtonText;
      case 'cancel':
        return styles.cancelButtonText;
      default:
        return styles.defaultButtonText;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.alertContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { scale: scaleAnim },
                  { translateY: slideAnim }
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#23262B', '#1A1D22'] as [string, string]}
              style={styles.gradientContainer}
            >
              <View style={styles.contentContainer}>
                <LinearGradient
                  colors={getIconGradient()}
                  style={styles.iconContainer}
                >
                  <Icon
                    name={getIconName()}
                    type="feather"
                    size={32}
                    color={getIconColor()}
                  />
                </LinearGradient>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>
                <View
                  style={[
                    styles.buttonContainer,
                    buttons.length > 2 && styles.verticalButtons,
                  ]}
                >
                  {buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.buttonWrapper,
                        buttons.length === 2 ? { flex: 1 } : styles.fullWidthButton,
                        buttons.length === 2 && index === 0 && styles.buttonMarginRight,
                        buttons.length > 2 && index < buttons.length - 1 && styles.buttonMarginBottom,
                      ]}
                      onPress={button.onPress}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={getButtonGradient(button.style)}
                        style={[styles.button, getButtonStyle(button.style)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={[styles.buttonText, getButtonTextStyle(button.style)]}>
                          {button.text}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  gradientContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
  },
  contentContainer: {
    padding: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  verticalButtons: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  buttonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonMarginRight: {
    marginRight: 12,
  },
  buttonMarginBottom: {
    marginBottom: 12,
  },
  defaultButton: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  destructiveButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  defaultButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  destructiveButtonText: {
    color: '#fff',
  },
});

export default CustomAlert; 