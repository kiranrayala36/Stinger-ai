import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView, Animated, Dimensions, Easing, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Text, Input, Button, Icon, CheckBox } from 'react-native-elements';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Initialize WebBrowser
WebBrowser.maybeCompleteAuthSession();

type AuthScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Auth'>;

const BLUE = '#0033FF';
const BLACK = '#000';
const WHITE = '#fff';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const GREY = '#888';

// Enhanced password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const [showForm, setShowForm] = useState<'none' | 'signup' | 'login'>('none');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedBg = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const initialButtonsOpacity = useRef(new Animated.Value(1)).current;
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loginStep, setLoginStep] = useState<'email' | 'password'>('email');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [lastNameFocused, setLastNameFocused] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [passwordHelperText, setPasswordHelperText] = useState('Password must be at least 8 characters long and include uppercase, lowercase, number and special character');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [socialProvider, setSocialProvider] = useState<string | null>(null);

  // Typewriter animation for logo
  const logoFull = 'StingerAI●';
  const [logoText, setLogoText] = useState('');
  useEffect(() => {
    setLogoText('');
    let i = 0;
    const interval = setInterval(() => {
      setLogoText(logoFull.slice(0, i + 1));
      i++;
      if (i === logoFull.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Add effect to handle navigation when user is set
  useEffect(() => {
    if (user) {
      navigation.replace('MainTabs', { screen: 'Home' });
    }
  }, [user, navigation]);

  // Animate black area expansion and background color
  useEffect(() => {
    if (showForm !== 'none') {
      // Fade out initial buttons before expanding
      Animated.timing(initialButtonsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setExpanded(true);
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: SCREEN_HEIGHT,
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(animatedBg, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        })
      ]).start(() => {
        setTimeout(() => {
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }, 200);
      });
    } else {
      // Fade out form content
      Animated.timing(formOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // 1. Animate background color from white to black at full height
        Animated.timing(animatedBg, {
          toValue: 0,
          duration: 250,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }).start(() => {
          // 2. Shrink black area from full height to initial size
          Animated.timing(animatedHeight, {
            toValue: 0.45 * SCREEN_HEIGHT,
            duration: 500,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false,
          }).start(() => {
            // 3. Fade in initial buttons
            Animated.timing(initialButtonsOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
            setExpanded(false);
          });
        });
      });
    }
  }, [showForm]);

  // Interpolate background color
  const animatedBgColor = animatedBg.interpolate({
    inputRange: [0, 1],
    outputRange: [BLACK, WHITE],
  });

  // Helper: clear password and error if email changes in login flow
  useEffect(() => {
    if (showForm === 'login' && loginStep === 'password') {
      setPassword('');
      setPasswordError('');
    }
    // eslint-disable-next-line
  }, [email]);

  // Debounce function for input validation
  const debounce = (func: Function, wait: number) => {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Validate email with debounce
  const validateEmail = useCallback(
    debounce((email: string) => {
      if (!email) return;
      if (!EMAIL_REGEX.test(email)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError('');
      }
    }, 500),
    []
  );

  // Enhanced password validation
  const validatePassword = useCallback(
    debounce((password: string) => {
      if (!password) {
        setPasswordHelperText('Password must be at least 8 characters long and include uppercase, lowercase, number and special character');
        setIsPasswordValid(false);
        setPasswordStrength(0);
        return;
      }

      let strength = 0;
      const hasLength = password.length >= 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[@$!%*?&]/.test(password);

      if (hasLength) strength += 20;
      if (hasUpperCase) strength += 20;
      if (hasLowerCase) strength += 20;
      if (hasNumber) strength += 20;
      if (hasSpecialChar) strength += 20;

      setPasswordStrength(Math.min(strength, 100));

      const missingRequirements = [];
      if (!hasLength) missingRequirements.push('at least 8 characters');
      if (!hasUpperCase) missingRequirements.push('uppercase letter');
      if (!hasLowerCase) missingRequirements.push('lowercase letter');
      if (!hasNumber) missingRequirements.push('number');
      if (!hasSpecialChar) missingRequirements.push('special character');

      if (missingRequirements.length > 0) {
        setPasswordHelperText(`Password must include ${missingRequirements.join(', ')}`);
        setIsPasswordValid(false);
      } else {
        setPasswordHelperText('Password is strong');
        setIsPasswordValid(true);
      }
    }, 300),
    []
  );

  // Get password strength color
  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 20) return '#EF4444';
    if (passwordStrength <= 40) return '#F59E0B';
    if (passwordStrength <= 60) return '#3B82F6';
    if (passwordStrength <= 80) return '#10B981';
    return '#059669';
  };

  // Get password strength text
  const getPasswordStrengthText = () => {
    if (passwordStrength <= 20) return 'Very Weak';
    if (passwordStrength <= 40) return 'Weak';
    if (passwordStrength <= 60) return 'Fair';
    if (passwordStrength <= 80) return 'Good';
    return 'Strong';
  };

  // Handle email change with validation
  const handleEmailChange = (val: string) => {
    setEmail(val);
    validateEmail(val);
  };

  // Handle password change with validation
  const handlePasswordChange = (val: string) => {
    setPassword(val);
    validatePassword(val);
  };

  // Reset form state
  const resetForm = useCallback(() => {
    setShowForm('none');
    setEmailError('');
    setPasswordError('');
    setSignupError('');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setLoginStep('email');
    setLoading(false);
    setPasswordHelperText('Password must be at least 8 characters long and include uppercase, lowercase, number and special character');
    setIsPasswordValid(false);
    setPasswordStrength(0);
  }, []);

  // Clear form fields when switching between login and signup
  const handleFormSwitch = (newForm: 'login' | 'signup') => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setEmailError('');
    setPasswordError('');
    setSignupError('');
    setLoginStep('email');
    setPasswordHelperText('Password must be at least 8 characters long and include uppercase, lowercase, number and special character');
    setIsPasswordValid(false);
    setPasswordStrength(0);
    setShowForm(newForm);
  };

  // Handle social login
  const handleSocialLogin = async (provider: string) => {
    try {
      setIsSocialLoading(true);
      setSocialProvider(provider);
      
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        Alert.alert('Coming Soon', `${provider} login will be available soon!`);
      }
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.message || 'An error occurred during social login. Please try again.'
      );
    } finally {
      setIsSocialLoading(false);
      setSocialProvider(null);
    }
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    if (!email) {
      setEmailError('Please enter your email address');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // TODO: Implement forgot password
    Alert.alert('Coming Soon', 'Password reset functionality will be available soon!');
  };

  // Enhanced auth handler
  const handleAuth = async () => {
    if (!loading) {
      setLoading(true);
      
      if (showForm === 'login') {
        if (loginStep === 'email') {
          if (!EMAIL_REGEX.test(email)) {
            setEmailError('Please enter a valid email address');
            setLoading(false);
            return;
          }
          setEmailError('');
          setLoginStep('password');
          setLoading(false);
          return;
        } else {
          try {
            await signIn(email, password);
            setPasswordError('');
          } catch (error: any) {
            if (error.message === 'Invalid email or password' || error.message === 'Invalid login credentials') {
              setPasswordError('Incorrect password. Please try again.');
              setPassword('');
            } else if (error.message === 'User not found') {
              setEmailError('No account found with this email');
              setLoginStep('email');
              setPassword('');
            } else if (error.message === 'No internet connection') {
              Alert.alert('Network Error', 'Please check your internet connection and try again.');
            } else if (error.message.includes('For security purposes')) {
              const seconds = error.message.match(/\d+/)?.[0] || '60';
              Alert.alert('Rate Limited', `Please wait ${seconds} seconds before trying again.`);
            } else {
              Alert.alert('Error', 'An error occurred during login. Please try again.');
            }
          }
        }
      } else if (showForm === 'signup') {
        // Sign up validation
        if (!firstName.trim() || !lastName.trim()) {
          setSignupError('Please enter both first and last name');
          setLoading(false);
          return;
        }

        if (!EMAIL_REGEX.test(email)) {
          setEmailError('Please enter a valid email address');
          setLoading(false);
          return;
        }

        if (!isPasswordValid) {
          setLoading(false);
          return;
        }

        setEmailError('');
        try {
          await signUp(email, password, firstName.trim(), lastName.trim());
          setSignupError('');
          Alert.alert(
            'Success', 
            'Account created successfully! Please check your email for verification.',
            [{ text: 'OK', onPress: () => resetForm() }]
          );
        } catch (error: any) {
          if (error.message === 'An account with this email already exists') {
            setEmailError('An account with this email already exists');
          } else if (error.message === 'No internet connection') {
            Alert.alert('Network Error', 'Please check your internet connection and try again.');
          } else if (error.message.includes('For security purposes')) {
            const seconds = error.message.match(/\d+/)?.[0] || '60';
            Alert.alert('Rate Limited', `Please wait ${seconds} seconds before trying again.`);
          } else {
            Alert.alert('Error', 'Failed to create account. Please try again.');
          }
        }
      }
      setLoading(false);
    }
  };

  // Update social buttons data
  const socialButtons = [
    {
      title: 'Continue with Google',
      icon: <Icon name="google" type="font-awesome" color="#EA4335" style={styles.leftIcon} />,
      onPress: () => handleSocialLogin('google'),
      loading: socialProvider === 'google',
    },
    {
      title: 'Continue with Microsoft Account',
      icon: <Icon name="windows" type="font-awesome" color="#0078D4" style={styles.leftIcon} />,
      onPress: () => handleSocialLogin('Microsoft'),
      loading: socialProvider === 'Microsoft',
    },
    {
      title: 'Continue with Apple',
      icon: <Icon name="apple" type="font-awesome" color="#000" style={styles.leftIcon} />,
      onPress: () => handleSocialLogin('Apple'),
      loading: socialProvider === 'Apple',
    },
    {
      title: 'Continue with phone',
      icon: <Icon name="phone" type="font-awesome" color="#000" style={styles.leftIcon} />,
      onPress: () => handleSocialLogin('Phone'),
      loading: socialProvider === 'Phone',
    },
  ];

  // Styles for side-by-side name fields
  const nameInputStyle = { flex: 1 };

  return (
    <KeyboardAvoidingView
      style={[styles.container, showForm !== 'none' && styles.containerWhite]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {showForm === 'none' && (
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>{logoText}</Text>
        </View>
      )}
      <Animated.View style={[styles.bottomContainer, expanded && styles.bottomContainerExpanded, { height: showForm === 'none' ? 0.35 * SCREEN_HEIGHT : animatedHeight, backgroundColor: animatedBgColor }]}> 
        <View style={styles.handleAbsoluteContainer}>
          <View style={styles.handle} />
        </View>
        {showForm === 'none' && (
          <Animated.View style={{ opacity: initialButtonsOpacity }}>
            <Button
              title="Continue with Google"
              icon={<Icon name="google" type="font-awesome" color="#fff" style={styles.leftIcon} />}
              buttonStyle={[styles.button, styles.googleButton]}
              titleStyle={[styles.buttonTitle, { color: '#fff' }]}
              containerStyle={styles.buttonContainer}
              onPress={() => handleSocialLogin('google')}
              loading={isSocialLoading && socialProvider === 'google'}
            />
            <View style={styles.initialDividerRow}>
              <View style={styles.initialDivider} />
            </View>
            <Button
              title="Sign up with email"
              icon={<Icon name="envelope" type="font-awesome" color="#fff" style={styles.leftIcon} />}
              buttonStyle={[styles.button, styles.emailButton]}
              titleStyle={[styles.buttonTitle, { color: '#fff' }]}
              containerStyle={styles.buttonContainer}
              onPress={() => setShowForm('signup')}
            />
            <Button
              title="Log in"
              buttonStyle={[styles.button, styles.loginButton]}
              titleStyle={[styles.buttonTitle, { color: '#fff' }]}
              containerStyle={styles.buttonContainer}
              onPress={() => setShowForm('login')}
            />
          </Animated.View>
        )}
        {showForm !== 'none' && (
          <Animated.View style={[styles.fullScreenFormAbsolute, { opacity: formOpacity }]}> 
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={resetForm}
            >
              <Icon name="close" type="material" color="#222" size={28} />
            </TouchableOpacity>
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formContentCentered}>
                <Text style={styles.formLogo}>StingerAI</Text>
                <Text style={styles.formTitle}>{showForm === 'login' ? (loginStep === 'email' ? 'Enter your email' : 'Enter your password') : 'Create account'}</Text>
                {showForm === 'signup' && (
                  <View style={styles.nameRow}>
                    <Input
                      placeholder="First Name"
                      value={firstName}
                      onChangeText={val => {
                        setFirstName(val);
                        // Optionally clear error here if you add error state
                      }}
                      inputStyle={[
                        styles.inputText,
                        { color: firstNameFocused ? BLUE : GREY }
                      ]}
                      inputContainerStyle={[
                        styles.inputContainerStyle,
                        styles.nameInputContainer,
                        { borderColor: firstNameFocused ? BLUE : '#ccc' }
                      ]}
                      containerStyle={[styles.inputContainer, nameInputStyle, { marginRight: 4 }]}
                      placeholderTextColor={GREY}
                      onFocus={() => setFirstNameFocused(true)}
                      onBlur={() => setFirstNameFocused(false)}
                    />
                    <Input
                      placeholder="Last Name"
                      value={lastName}
                      onChangeText={val => {
                        setLastName(val);
                        // Optionally clear error here if you add error state
                      }}
                      inputStyle={[
                        styles.inputText,
                        { color: lastNameFocused ? BLUE : GREY }
                      ]}
                      inputContainerStyle={[
                        styles.inputContainerStyle,
                        styles.nameInputContainer,
                        { borderColor: lastNameFocused ? BLUE : '#ccc' }
                      ]}
                      containerStyle={[styles.inputContainer, nameInputStyle]}
                      placeholderTextColor={GREY}
                      onFocus={() => setLastNameFocused(true)}
                      onBlur={() => setLastNameFocused(false)}
                    />
                  </View>
                )}
                <Input
                  placeholder="Email address"
                  value={email}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  inputStyle={[
                    styles.inputText,
                    { color: emailFocused ? BLUE : GREY }
                  ]}
                  inputContainerStyle={[
                    styles.inputContainerStyle,
                    { borderColor: emailError ? '#ff3b30' : emailFocused ? BLUE : '#ccc' }
                  ]}
                  containerStyle={styles.inputContainer}
                  placeholderTextColor={GREY}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  errorMessage={emailError}
                  errorStyle={styles.errorText}
                  renderErrorMessage={true}
                />
                {(showForm === 'signup' || (showForm === 'login' && loginStep === 'password')) && (
                  <>
                    <Input
                      placeholder="Password"
                      value={password}
                      onChangeText={handlePasswordChange}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      inputStyle={[
                        styles.inputText,
                        { color: passwordFocused ? BLUE : GREY }
                      ]}
                      inputContainerStyle={[
                        styles.inputContainerStyle,
                        { borderColor: passwordError ? '#ff3b30' : passwordFocused ? BLUE : '#ccc' }
                      ]}
                      containerStyle={styles.inputContainer}
                      placeholderTextColor={GREY}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      errorMessage={passwordError}
                      errorStyle={styles.errorText}
                      renderErrorMessage={true}
                      rightIcon={
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={styles.eyeIconContainer}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Icon
                            name={showPassword ? 'eye' : 'eye-slash'}
                            type="font-awesome-5"
                            size={18}
                            color={passwordFocused ? BLUE : GREY}
                            solid
                          />
                        </TouchableOpacity>
                      }
                    />
                    {showForm === 'signup' && passwordFocused && (
                      <>
                        <View style={styles.passwordStrengthContainer}>
                          <View style={styles.passwordStrengthBar}>
                            <View 
                              style={[
                                styles.passwordStrengthFill,
                                { 
                                  width: `${passwordStrength}%`,
                                  backgroundColor: getPasswordStrengthColor()
                                }
                              ]} 
                            />
                          </View>
                          <Text style={[
                            styles.passwordStrengthText,
                            { color: getPasswordStrengthColor() }
                          ]}>
                            {getPasswordStrengthText()}
                          </Text>
                        </View>
                        <Text style={[
                          styles.helperText,
                          !isPasswordValid && password && styles.errorText
                        ]}>
                          {passwordHelperText}
                        </Text>
                      </>
                    )}
                    {showForm === 'login' && loginStep === 'password' && (
                      <>
                        <View style={styles.forgotPasswordRow}>
                          <TouchableOpacity 
                            style={styles.forgotPasswordButton} 
                            onPress={handleForgotPassword}
                          >
                            <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </>
                )}
                <Button
                  title="Continue"
                  onPress={handleAuth}
                  loading={loading}
                  buttonStyle={styles.continueButton}
                  titleStyle={styles.continueButtonText}
                  containerStyle={styles.continueButtonContainer}
                />
                {showForm === 'signup' && signupError ? (
                  <Text style={styles.errorText}>{signupError}</Text>
                ) : null}
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>
                    {showForm === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  </Text>
                  <TouchableOpacity onPress={() => handleFormSwitch(showForm === 'login' ? 'signup' : 'login')}>
                    <Text style={styles.switchLink}>{showForm === 'login' ? 'Sign up' : 'Log in'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.divider} />
                </View>
                {socialButtons.map((btn, idx) => (
                  <Button
                    key={btn.title}
                    title={btn.title}
                    icon={btn.loading ? undefined : btn.icon}
                    buttonStyle={styles.socialButton}
                    titleStyle={styles.socialButtonText}
                    containerStyle={styles.socialButtonContainer}
                    onPress={btn.onPress}
                    loading={btn.loading}
                    loadingProps={{ color: BLACK }}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLUE,
    justifyContent: 'space-between',
  },
  containerWhite: {
    backgroundColor: WHITE,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: WHITE,
    letterSpacing: 1,
  },
  bottomContainer: {
    width: '100%',
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 36,
    backgroundColor: BLACK,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: BLACK,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bottomContainerExpanded: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 0,
    backgroundColor: WHITE,
    shadowOpacity: 0,
    elevation: 0,
    shadowRadius: 0,
    shadowColor: 'transparent',
  },
  handleAbsoluteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
    opacity: 0.18,
  },
  button: {
    borderRadius: 16,
    height: 54,
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: '#222',
  },
  emailButton: {
    backgroundColor: '#222',
  },
  loginButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 0,
  },
  leftIcon: {
    marginRight: 10,
  },
  fullScreenFormAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 36,
    right: 24,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 20,
    padding: 4,
  },
  formContentCentered: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  formLogo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BLACK,
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BLACK,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 0,
  },
  inputText: {
    fontSize: 14,
    color: BLACK,
    paddingVertical: 4,
  },
  inputContainerStyle: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderStyle: 'solid',
    shadowColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    height: 50,
    marginBottom: 0,
    paddingVertical: 0,
  },
  continueButton: {
    backgroundColor: BLACK,
    borderRadius: 28,
    height: 44,
    marginTop: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: WHITE,
  },
  continueButtonContainer: {
    width: '100%',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  switchText: {
    fontSize: 13,
    color: BLACK,
  },
  switchLink: {
    fontSize: 13,
    color: BLUE,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#eee',
    borderRadius: 1,
  },
  orText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#888',
    fontWeight: 'bold',
  },
  socialButton: {
    backgroundColor: WHITE,
    borderRadius: 28,
    height: 44,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#eee',
    justifyContent: 'flex-start',
    paddingLeft: 18,
  },
  socialButtonText: {
    color: BLACK,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  socialButtonContainer: {
    width: '100%',
    marginBottom: 0,
  },
  initialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  initialDivider: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#fff',
    opacity: 0.12,
    borderRadius: 1,
  },
  nameInputContainer: {
    marginRight: 0,
    marginLeft: 0,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 0,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 2,
    marginLeft: 4,
  },
  helperText: {
    color: GREY,
    fontSize: 12,
    marginTop: 2,
    marginLeft: 4,
    marginBottom: 4,
    lineHeight: 16,
  },
  eyeIconContainer: {
    padding: 6,
    marginRight: 4,
  },
  passwordStrengthContainer: {
    width: '80%',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: 'bold',
  },
  forgotPasswordRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  formScrollView: {
    flex: 1,
    width: '100%',
  },
  formScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

export default AuthScreen; 