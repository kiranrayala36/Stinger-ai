import { Animated, Easing } from 'react-native';
import type { 
  StackCardInterpolationProps,
  StackNavigationOptions,
  TransitionSpecs,
} from '@react-navigation/stack';

const { multiply } = Animated;

export const slideFromRight: StackNavigationOptions = {
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.bezier(0.2, 0, 0.2, 1),
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: StackCardInterpolationProps) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
      opacity: current.progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.7, 1],
      }),
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3],
      }),
      backgroundColor: '#181A20',
    },
  }),
};

export const slideUpWithFade: StackNavigationOptions = {
  gestureEnabled: true,
  gestureDirection: 'vertical',
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.bezier(0.2, 0, 0.2, 1),
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: StackCardInterpolationProps) => ({
    cardStyle: {
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.height, 0],
          }),
        },
      ],
      opacity: current.progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.7, 1],
      }),
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3],
      }),
      backgroundColor: '#181A20',
    },
  }),
};

export const modalPopup: StackNavigationOptions = {
  gestureEnabled: false,
  transitionSpec: {
    open: {
      animation: 'spring',
      config: {
        damping: 30,
        mass: 1,
        stiffness: 150,
        overshootClamping: true,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      },
    },
    close: {
      animation: 'spring',
      config: {
        damping: 25,
        mass: 1,
        stiffness: 120,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }: StackCardInterpolationProps) => ({
    cardStyle: {
      transform: [
        {
          translateY: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.height, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.5, 1],
        extrapolate: 'clamp',
      }),
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.6],
        extrapolate: 'clamp',
      }),
      backgroundColor: '#000',
    },
  }),
};

export const fadeThrough: StackNavigationOptions = {
  gestureEnabled: false,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.bezier(0.2, 0, 0.2, 1),
      },
    },
  },
  cardStyleInterpolator: ({ current }: StackCardInterpolationProps) => ({
    cardStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.7, 1],
      }),
    },
    overlayStyle: {
      opacity: current.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.3],
      }),
      backgroundColor: '#181A20',
    },
  }),
};

export const tabScreenOptions = {
  tabBarStyle: { display: 'flex' },
  animationEnabled: true,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.bezier(0.2, 0, 0.2, 1),
      },
    },
  },
  cardStyleInterpolator: ({ current, next, layouts }: any) => {
    const translateX = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [layouts.screen.width, 0],
    });

    const nextTranslateX = next
      ? next.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -layouts.screen.width],
        })
      : 0;

    return {
      cardStyle: {
        transform: [
          { translateX },
          {
            scale: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.95, 1],
            }),
          },
        ],
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
      overlayStyle: {
        opacity: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0.3],
        }),
      },
    };
  },
}; 