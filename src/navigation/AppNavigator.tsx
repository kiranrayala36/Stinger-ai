import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { 
  createStackNavigator, 
  StackNavigationOptions,
} from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { Icon } from 'react-native-elements';
import { useTheme } from '../context/ThemeContext';
import { View, TouchableOpacity, StyleSheet, Platform, Text, Dimensions, Image, AppState, Animated, Easing, StatusBar } from 'react-native';
import type { BottomTabBarProps, BottomTabNavigationEventMap } from '@react-navigation/bottom-tabs';
import type { ParamListBase, NavigationHelpers, TabNavigationState } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { slideFromRight, slideUpWithFade, modalPopup, fadeThrough } from './animations';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import AIChatScreen from '../screens/AIChatScreen';
import TasksScreen from '../screens/TasksScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AuthScreen from '../screens/AuthScreen';
import AddTaskScreen from '../screens/AddTaskScreen';
import ViewTaskScreen from '../screens/ViewTaskScreen';
import EditTaskScreen from '../screens/EditTaskScreen';
import NotesScreen from '../screens/NotesScreen';
import ChatHistoryScreen from '../screens/ChatHistoryScreen';
import TrashScreen from '../screens/TrashScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ResearchSearchScreen from '../screens/ResearchSearchScreen';
import { ResearchDetailScreen } from '../screens/ResearchDetailScreen';
import AssignmentHelperScreen from '../screens/AssignmentHelperScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import SavedAnswersScreen from '../screens/SavedAnswersScreen';
import SavedAnswerDetailScreen from '../screens/SavedAnswerDetailScreen';
import PDFHistoryScreen from '../screens/PDFHistoryScreen';

// Define Task type
export type Task = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  category: string;
  status: string;
  attachments?: string[];
};

// Define navigation types
export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: {
    screen?: 'Home';
    params?: {
      newTask?: Task;
      refreshTasks?: boolean;
    };
  };
  AIChat: {
    chatId?: string;
  };
  'Chat History': undefined;
  ViewTask: { 
    task: Task;
  };
  EditTask: { 
    task: Task;
  };
  TasksScreen: undefined;
  AddTask: undefined;
  Auth: undefined;
  Tasks: {
    screen?: string;
    params?: any;
  };
  Trash: undefined;
  Notifications: undefined;
  ResearchSearch: undefined;
  ResearchDetail: { paperId: string };
  'Assignment Helper': undefined;
  Bookmarks: undefined;
  'Saved Answers': undefined;
  'Saved Answer Detail': {
    answer: {
      id: string;
      topic: string;
      questions: Array<{
        question: string;
        answer: string;
      }>;
      length: string;
      style: string;
      created_at: string;
    };
  };
  PDFHistory: undefined;
};

export type BottomTabParamList = {
  Home: {
    newTask?: Task;
    refreshTasks?: boolean;
  };
  Tasks: undefined;
  Notes: undefined;
  AIChat: undefined;
  Settings: undefined;
  Profile: undefined;
  Research: undefined;
  Bookmarks: undefined;
};

export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
> & {
  navigate: (screen: keyof RootStackParamList, params?: any) => void;
};

export type HomeScreenRouteProp = RouteProp<RootStackParamList, 'MainTabs'>;

export interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
}

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();
const { width } = Dimensions.get('window');

const sparklesPng = require('../../assets/sparkles.png');

function TasksStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#181A20' },
        ...slideFromRight
      } as StackNavigationOptions}
    >
      <Stack.Screen 
        name="TasksScreen" 
        component={TasksScreen}
      />
      <Stack.Screen 
        name="AddTask" 
        component={AddTaskScreen}
        options={modalPopup}
      />
      <Stack.Screen 
        name="ViewTask" 
        component={ViewTaskScreen}
        options={modalPopup}
      />
      <Stack.Screen 
        name="EditTask" 
        component={EditTaskScreen}
        options={modalPopup}
      />
    </Stack.Navigator>
  );
}

const withTabAnimation = (WrappedComponent: React.ComponentType<any>) => {
  return function WithTabAnimationComponent(props: any) {
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (props.isFocused) {
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 300,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.bezier(0.2, 0.8, 0.2, 1),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        translateX.setValue(props.direction === 'left' ? -100 : 100);
        opacity.setValue(0);
      }
    }, [props.isFocused, props.direction]);

    return (
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX }],
          opacity,
        }}
      >
        <WrappedComponent {...props} />
      </Animated.View>
    );
  };
};

const AnimatedHomeScreen = withTabAnimation(HomeScreen);
const AnimatedTasksStack = withTabAnimation(TasksStack);
const AnimatedNotesScreen = withTabAnimation(NotesScreen);
const AnimatedProfileScreen = withTabAnimation(ProfileScreen);

function TabNavigator() {
  const [activeTab, setActiveTab] = useState('Home');
  const [direction, setDirection] = useState('right');
  const previousTab = useRef(activeTab);

  const handleTabPress = (tabName: string) => {
    const oldIndex = ['Home', 'Tasks', 'Notes', 'Profile'].indexOf(previousTab.current);
    const newIndex = ['Home', 'Tasks', 'Notes', 'Profile'].indexOf(tabName);
    setDirection(oldIndex < newIndex ? 'right' : 'left');
    previousTab.current = tabName;
    setActiveTab(tabName);
  };

  const screenOptions = React.useCallback(({ route }: any): BottomTabNavigationOptions => ({
    headerShown: false,
    tabBarStyle: { 
      display: shouldShowTabBar(route) ? 'flex' : 'none',
      backgroundColor: '#23262B',
      borderTopWidth: 0,
      elevation: 0,
      height: Platform.OS === 'ios' ? 85 : 65,
      paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    } as const,
    lazy: false,
  }), []);

  function shouldShowTabBar(route: any) {
    const routeName = getFocusedRouteNameFromRoute(route) ?? route?.state?.routes[route.state.index]?.name;
    return routeName !== 'AI Chat';
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#181A20' }}>
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} onTabPress={handleTabPress} />}
        screenOptions={screenOptions}
        backBehavior="history"
      >
        <Tab.Screen 
          name="Home" 
          children={(props) => (
            <AnimatedHomeScreen 
              {...props} 
              isFocused={activeTab === 'Home'}
              direction={direction}
            />
          )}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Icon
                name="home"
                type="font-awesome-5"
                color={color}
                size={22}
                solid={focused}
              />
            ),
          }}
        />
        <Tab.Screen 
          name="Tasks" 
          component={TasksStack}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Icon
                name="tasks"
                type="font-awesome-5"
                color={color}
                size={22}
                solid={focused}
              />
            ),
          }}
        />
        <Tab.Screen 
          name="Notes" 
          children={(props) => (
            <AnimatedNotesScreen 
              {...props} 
              isFocused={activeTab === 'Notes'}
              direction={direction}
            />
          )}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Icon
                name="book"
                type="font-awesome-5"
                color={color}
                size={22}
                solid={focused}
              />
            ),
          }}
        />
        <Tab.Screen 
          name="Profile" 
          children={(props) => (
            <AnimatedProfileScreen 
              {...props} 
              isFocused={activeTab === 'Profile'}
              direction={direction}
            />
          )}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Icon
                name="user-circle"
                type="font-awesome-5"
                color={color}
                size={22}
                solid={focused}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation, onTabPress }: BottomTabBarProps & { onTabPress: (name: string) => void }) {
  const { colors } = useTheme();
  const visibleRoutes = state.routes.filter(r => 
    r.name === 'Home' || r.name === 'Tasks' || r.name === 'Notes' || r.name === 'Profile'
  );

  // Animation values for each tab
  const fadeAnims = useRef(visibleRoutes.map(() => new Animated.Value(0))).current;
  const scaleAnims = useRef(visibleRoutes.map(() => new Animated.Value(1))).current;

  // Update animations when focused tab changes
  useEffect(() => {
    visibleRoutes.forEach((route, index) => {
      const isFocused = state.routes[state.index].name === route.name;
      
      Animated.parallel([
        Animated.timing(fadeAnims[index], {
          toValue: isFocused ? 1 : 0.5,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.spring(scaleAnims[index], {
          toValue: isFocused ? 1.1 : 1,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        })
      ]).start();
    });
  }, [state.index]);

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabBarContent}>
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.routes[state.index].name === route.name;
          let iconName = '';
          let iconType = 'font-awesome-5';
          
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Tasks') {
            iconName = 'tasks';
          } else if (route.name === 'Notes') {
            iconName = 'book';
          } else if (route.name === 'Profile') {
            iconName = 'user-circle';
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  onTabPress(route.name);
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.iconWrapper,
                  isFocused && styles.iconWrapperActive,
                  {
                    transform: [{ scale: scaleAnims[index] }],
                    opacity: fadeAnims[index]
                  }
                ]}
              >
                <Icon
                  name={iconName}
                  type={iconType}
                  color={isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'}
                  size={22}
                  solid={isFocused}
                />
              </Animated.View>
              {isFocused && (
                <Animated.View 
                  style={[
                    styles.activeIndicator,
                    {
                      opacity: fadeAnims[index],
                      transform: [{ scale: scaleAnims[index] }]
                    }
                  ]} 
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('AIChat')}
        activeOpacity={0.8}
      >
        <Animated.View 
          style={[
            styles.fabButton,
            {
              transform: [{ scale: new Animated.Value(1) }]
            }
          ]}
        >
          <Image source={sparklesPng} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

function ResearchStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ResearchSearch" 
        component={ResearchSearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ResearchDetail" 
        component={ResearchDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export const AppNavigator = () => {
  const { user, loading: authLoading, isInitialized } = useAuth();
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);

  const checkOnboardingStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('@onboarding_complete');
      setIsOnboardingCompleted(status === 'true');
    } catch (error) {
      setIsOnboardingCompleted(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkOnboardingStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Add a listener for AsyncStorage changes
  useEffect(() => {
    const checkStorage = async () => {
      const status = await AsyncStorage.getItem('@onboarding_complete');
      if (status === 'true' && !isOnboardingCompleted) {
        setIsOnboardingCompleted(true);
      }
    };

    const interval = setInterval(checkStorage, 100);
    return () => clearInterval(interval);
  }, [isOnboardingCompleted]);

  if (!isInitialized || isOnboardingCompleted === null) {
    return null;
  }

  if (authLoading) {
    return null;
  }

  const defaultScreenOptions: StackNavigationOptions = {
    headerShown: false,
    cardStyle: { 
      backgroundColor: '#181A20',
      paddingTop: 0
    },
    ...slideFromRight,
    detachPreviousScreen: false,
    presentation: 'card'
  };

  return (
    <Stack.Navigator
      screenOptions={defaultScreenOptions}
    >
      {!isOnboardingCompleted ? (
        <Stack.Screen 
          name="Onboarding" 
          component={OnboardingScreen} 
        />
      ) : !user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="AIChat" component={AIChatScreen} />
          <Stack.Screen name="Chat History" component={ChatHistoryScreen} />
          <Stack.Screen name="ViewTask" component={ViewTaskScreen} />
          <Stack.Screen name="EditTask" component={EditTaskScreen} />
          <Stack.Screen name="Trash" component={TrashScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ResearchSearch" component={ResearchSearchScreen} />
          <Stack.Screen name="ResearchDetail" component={ResearchDetailScreen} />
          <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
          <Stack.Screen
            name="Assignment Helper"
            component={AssignmentHelperScreen}
            options={{
              headerShown: false,
              ...slideFromRight
            }}
          />
          <Stack.Screen
            name="Saved Answers"
            component={SavedAnswersScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Saved Answer Detail"
            component={SavedAnswerDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PDFHistory"
            component={PDFHistoryScreen}
            options={{
              title: 'PDF History',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    height: 65,
    backgroundColor: '#23262B',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 65,
    paddingHorizontal: 16,
  },
  tabItem: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    height: 65,
    paddingVertical: 8,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapperActive: {
    backgroundColor: '#2563EB',
    borderRadius: 24,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 35,
    alignSelf: 'center',
    zIndex: 1,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
});