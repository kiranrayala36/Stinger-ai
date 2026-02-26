import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  Switch, 
  SafeAreaView, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar,
  ActivityIndicator,
  Dimensions,
  AlertButton
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Icon } from 'react-native-elements';
import { LinearGradient } from 'expo-linear-gradient';
import { supabaseService } from '../services/supabaseService';
import { imageUploadService } from '../services/imageUploadService';
import { Picker } from '@react-native-picker/picker';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import CustomAlert from '../components/CustomAlert';
import { showAlert } from '../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    width: '100%',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) - 10 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  signOutButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  profileSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
    width: '100%',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 20,
    alignSelf: 'center',
    width: 120,
    height: 120,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 25,
    right: '38%',
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#181A20',
    zIndex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  userEmail: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  userBio: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 20,
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  settingsSectionContainer: {
    backgroundColor: '#23262B',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#181A20',
    marginTop: Platform.OS === 'ios' ? 50 : 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalProfileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  modalProfileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  modalEditIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#181A20',
  },
  changePhotoText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#23262B',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2D35',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  bioInput: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2A2D35',
    backgroundColor: '#181A20',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#2A2D35',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    backgroundColor: '#23262B',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalText: {
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  passwordInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  passwordInfoText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  passwordStrengthContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  passwordStrengthLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#2A2D35',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  settingsInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  settingsInfoText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  modalSettingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  settingToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D35',
  },
  settingToggleContent: {
    flex: 1,
    marginRight: 16,
  },
  settingToggleLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  settingToggleDescription: {
    fontSize: 12,
    color: '#666',
  },
  comingSoonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  comingSoonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  dangerZoneItem: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
  },
  deleteModalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#23262B',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  warningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteWarningContainer: {
    padding: 24,
    alignItems: 'center',
  },
  deleteWarningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  deleteWarningText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    opacity: 0.8,
  },
  deleteConfirmationLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  deleteConfirmationInput: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    marginBottom: 24,
    width: '100%',
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  deleteActionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelDeleteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 15,
    paddingHorizontal: 0,
    borderRadius: 14,
    flex: 0.48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cancelDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  confirmDeleteButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 15,
    paddingHorizontal: 0,
    borderRadius: 14,
    flex: 0.48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmDeleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 14,
    marginTop: 24,
    marginBottom: 32,
    marginHorizontal: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteAccountButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackModal: {
    flex: 1,
    backgroundColor: '#181A20',
    marginTop: Platform.OS === 'ios' ? 50 : 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  starContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  ratingLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  feedbackTextArea: {
    height: 150,
    borderWidth: 1,
    borderColor: '#2A2D35',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    textAlignVertical: 'top',
    backgroundColor: '#23262B',
    marginBottom: 6,
  },
  characterCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 16,
  },
  characterCountWarning: {
    color: '#F59E0B',
  },
  characterCountError: {
    color: '#EF4444',
  },
  categoryPicker: {
    backgroundColor: '#23262B',
    borderRadius: 10,
    marginBottom: 16,
    color: '#fff',
  },
  pickerItemStyle: {
    fontSize: 16,
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackSent: {
    backgroundColor: '#2F9E44',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  feedbackSentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  attachScreenshotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23262B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2D35',
    marginBottom: 16,
  },
  attachScreenshotText: {
    color: '#3B82F6',
    marginLeft: 8,
    fontSize: 14,
  },
  screenshotPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#23262B',
  },
  removeScreenshotButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  feedbackInfoText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  feedbackStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 10,
  },
  feedbackStatItem: {
    alignItems: 'center',
  },
  feedbackStatNumber: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  feedbackStatLabel: {
    color: '#666',
    fontSize: 12,
  },
  loadingContainer: {
    backgroundColor: '#23262B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

type AlertButtonType = {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

const ProfileScreen: React.FC = () => {
  const { user, signOut, updateUserProfile, changePassword, deleteAccount, updateUserMetadata } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const defaultAvatar = require('../assets/stingerLogo.png');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [notificationsModal, setNotificationsModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{[key: string]: string}>({});
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [signOutAlertVisible, setSignOutAlertVisible] = useState(false);
  
  // Enhanced feedback state
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [maxFeedbackLength] = useState(500);
  
  // Feedback category options
  const feedbackCategories = [
    { label: 'General Feedback', value: 'general' },
    { label: 'Bug Report', value: 'bug' },
    { label: 'Feature Request', value: 'feature' },
    { label: 'Performance Issue', value: 'performance' },
    { label: 'UI/UX Feedback', value: 'ui_ux' },
    { label: 'Accessibility Issue', value: 'accessibility' },
    { label: 'Login/Authentication', value: 'auth' },
    { label: 'Tasks & Reminders', value: 'tasks' },
    { label: 'AI Chat Experience', value: 'ai_chat' },
  ];
  
  // Rating labels
  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSignOut = () => {
    setSignOutAlertVisible(true);
  };

  const handleSignOutConfirm = async () => {
    try {
      await signOut();
    } catch (error) {
      showAlert('Error', 'Failed to sign out');
    }
    setSignOutAlertVisible(false);
  };

  const handlePasswordChange = async () => {
    try {
      await changePassword(currentPassword, newPassword);
      showAlert('Success', 'Password changed successfully');
      setChangePasswordModal(false);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to change password');
    }
  };

  const handleProfileUpdate = async () => {
    try {
      await updateUserProfile({
        firstName,
        lastName,
        email,
        phone,
        bio,
      });
      showAlert('Success', 'Profile updated successfully');
      setEditProfileModal(false);
      setFormErrors({});
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update profile');
    }
  };

  const handleHelpPress = () => {
    showAlert(
      'Help & Support', 
      'Contact support at support@stingerai.com',
      [{ text: 'OK', onPress: () => {}, style: 'default' }]
    );
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'delete') {
      showAlert('Error', 'Please type "delete" to confirm account deletion');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteAccount();
      setDeleteAccountModal(false);
      showAlert(
        'Account Deleted',
        'Your account has been successfully deleted. You will be signed out now.',
        [
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              // The user will be automatically signed out by the deleteAccount function
              setDeleteAccountModal(false);
            }
          }
        ]
      );
    } catch (error: any) {
      showAlert(
        'Error',
        error.message || 'Failed to delete account. Please try again or contact support.'
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation('');
    }
  };

  const getDeviceInfo = () => {
    const deviceInfo = {
      brand: Device.brand,
      manufacturer: Device.manufacturer,
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      deviceYearClass: Device.deviceYearClass,
      appVersion: Constants.expoConfig?.version || 'unknown',
      screenWidth: Dimensions.get('window').width,
      screenHeight: Dimensions.get('window').height,
      deviceType: Device.deviceType === Device.DeviceType.PHONE ? 'Phone' : 
                 Device.deviceType === Device.DeviceType.TABLET ? 'Tablet' : 'Unknown'
    };
    
    return deviceInfo;
  };
  
  const captureScreenshot = async () => {
    // This is a placeholder for screenshot capture functionality
    // In a real implementation, you would use something like react-native-view-shot
    // or the Expo captureRef API to capture a screenshot
    
    try {
      // Simulate a delay that would happen in real screenshot capture
      setIsSubmittingFeedback(true);
      
      // Simulate screenshot capture
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // For demonstration purposes, we'll use a placeholder image
      setScreenshotUri('https://via.placeholder.com/350x200/23262B/666666?text=Screenshot+Preview');
      
      showAlert(
        'Screenshot Captured',
        'A screenshot has been attached to your feedback. You can remove it if needed.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      showAlert(
        'Screenshot Failed',
        'Unable to capture screenshot. Please try again or continue without a screenshot.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  
  const removeScreenshot = () => {
    setScreenshotUri(null);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) {
      showAlert('Error', 'Please provide some feedback content', [{ text: 'OK', onPress: () => {} }]);
      return;
    }

    if (feedbackRating === 0) {
      showAlert('Error', 'Please select a rating', [{ text: 'OK', onPress: () => {} }]);
      return;
    }
    
    showAlert(
      'Submit Feedback',
      'Are you sure you want to submit this feedback?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        { 
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setIsSubmittingFeedback(true);
            try {
              if (user?.id) {
                // Collect device information
                const deviceInfo = getDeviceInfo();
                
                // Prepare any extra data, including screenshot if available
                const extraData = {
                  device_info: deviceInfo,
                  ...(screenshotUri ? { screenshot: screenshotUri } : {})
                };
                
                const { error } = await supabaseService.submitFeedback(
                  user.id,
                  feedbackContent,
                  feedbackCategory,
                  feedbackRating,
                  extraData
                );

                if (error) {
                  showAlert('Error', error.message || 'Failed to submit feedback', [{ text: 'OK', onPress: () => {} }]);
                  return;
                }

                setFeedbackSent(true);
                setTimeout(() => {
                  setFeedbackModal(false);
                  setFeedbackContent('');
                  setFeedbackRating(0);
                  setFeedbackCategory('general');
                  setScreenshotUri(null);
                  setFeedbackSent(false);
                }, 2000);
              }
            } catch (error: any) {
              showAlert('Error', error.message || 'Failed to submit feedback', [{ text: 'OK', onPress: () => {} }]);
            } finally {
              setIsSubmittingFeedback(false);
            }
          }
        }
      ]
    );
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          style={styles.starContainer}
          onPress={() => setFeedbackRating(i)}
        >
          <Icon 
            name={i <= feedbackRating ? "star" : "star-o"}
            type="font-awesome"
            color={i <= feedbackRating ? "#FFD700" : "#666"}
            size={32}
          />
          <Text style={[
            styles.ratingLabel,
            i === feedbackRating ? { color: '#FFD700' } : {}
          ]}>
            {ratingLabels[i-1]}
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const handleChangePhoto = () => {
    const buttons: AlertButtonType[] = [
      { text: 'Choose from Library', onPress: () => handleChoosePhoto(), style: 'default' },
      { text: 'Take Photo', onPress: () => handleTakePhoto(), style: 'default' },
      { text: 'Cancel', style: 'cancel', onPress: () => {} }
    ];

    showAlert('Change Profile Photo', 'How would you like to update your profile photo?', buttons);
  };

  const handleRemovePhoto = () => {
    const buttons: AlertButtonType[] = [
      { text: 'Cancel', style: 'cancel', onPress: () => {} },
      { 
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePhoto();
          } catch (error: any) {
            showAlert('Error', error.message || 'Failed to remove photo');
          }
        }
      }
    ];

    showAlert('Remove Photo', 'Are you sure you want to remove your profile photo?', buttons);
  };

  const handleTakePhoto = async () => {
    try {
      await imageUploadService.requestPermissions();
      const result = await imageUploadService.pickImage();
      if (!result.canceled && result.assets[0]?.uri) {
        await updatePhoto(result.assets[0].uri);
      }
    } catch (error) {
      handleErrorMessage(error);
    }
  };

  const handleChoosePhoto = async () => {
    try {
      await imageUploadService.requestPermissions();
      const result = await imageUploadService.pickImage();
      if (!result.canceled && result.assets[0]?.uri) {
        await updatePhoto(result.assets[0].uri);
      }
    } catch (error) {
      handleErrorMessage(error);
    }
  };

  const removePhoto = async () => {
    // Implementation of removePhoto
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    return strength;
  };

  const getPasswordStrengthColor = (password: string) => {
    const strength = getPasswordStrength(password);
    if (strength <= 25) return '#EF4444';
    if (strength <= 50) return '#F59E0B';
    if (strength <= 75) return '#3B82F6';
    return '#10B981';
  };

  const getPasswordStrengthText = (password: string) => {
    const strength = getPasswordStrength(password);
    if (strength <= 25) return 'Weak';
    if (strength <= 50) return 'Fair';
    if (strength <= 75) return 'Good';
    return 'Strong';
  };

  const handleSuccessMessage = (message: string) => {
    showAlert('Success', message, [{ text: 'OK', onPress: () => {} }]);
  };

  const handleErrorMessage = (error: any) => {
    showAlert('Error', error.message || 'An error occurred', [{ text: 'OK', onPress: () => {} }]);
  };

  const updatePhoto = async (photoUri?: string) => {
    try {
      setIsUploading(true);
      if (!user?.id) throw new Error('User not found');

      if (!photoUri) {
        // If no URI provided, it means we're removing the photo
        await imageUploadService.deleteProfilePhoto(user.id);
        // Update both user metadata and profiles table
        await updateUserMetadata({ avatar_url: undefined });
        await supabaseService.updateUserProfile({ photoURL: undefined });
        const updatedUser = { ...user, photoURL: undefined };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        // Upload the new photo
        const photoURL = await imageUploadService.uploadProfilePhoto(user.id, photoUri);
        // Update both user metadata and profiles table
        await updateUserMetadata({ avatar_url: photoURL });
        await supabaseService.updateUserProfile({ photoURL });
        const updatedUser = { ...user, photoURL };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      }

      handleSuccessMessage('Profile photo updated successfully');
    } catch (error) {
      handleErrorMessage(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleScreenshotCapture = async () => {
    try {
      setIsSubmittingFeedback(true);
      // TODO: Implement actual screenshot capture
      setScreenshotUri('https://via.placeholder.com/350x200/23262B/666666?text=Screenshot+Preview');
      showAlert(
        'Screenshot Captured',
        'A screenshot has been attached to your feedback. You can remove it if needed.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      showAlert(
        'Screenshot Failed',
        'Unable to capture screenshot. Please try again or continue without a screenshot.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handlePhotoUpdate = async () => {
    try {
      await updatePhoto();
      handleSuccessMessage('Profile photo updated successfully');
    } catch (error) {
      handleErrorMessage(error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#181A20" />
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        <LinearGradient
          colors={['#181A20', '#23262B']}
          style={styles.headerGradient}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.title}>Profile</Text>
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                <Icon name="sign-out" type="font-awesome" color="#fff" size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileSection}>
              {isUploading ? (
                <View style={[styles.profileImage, styles.loadingContainer]}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                </View>
              ) : (
                <Image
                  source={
                    user?.photoURL
                      ? { uri: user.photoURL }
                      : require('../../assets/default-avatar.png')
                  }
                  style={styles.profileImage}
                />
              )}
              <TouchableOpacity
                style={styles.editIconContainer}
                onPress={handleChangePhoto}
              >
                <Icon
                  name="camera"
                  type="font-awesome-5"
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>
              {user?.firstName || ''} {user?.lastName || ''}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {user?.bio && (
              <Text style={styles.userBio} numberOfLines={2}>{user.bio}</Text>
            )}
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.settingsContainer}>
          {/* Settings sections */}
          <View style={styles.settingsSectionContainer}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            
            <TouchableOpacity style={styles.settingItem} onPress={() => {
              setFirstName(user?.firstName || '');
              setLastName(user?.lastName || '');
              setEditProfileModal(true);
            }}>
              <View style={styles.settingIconContainer}>
                <Icon name="user" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Edit Profile</Text>
                <Text style={styles.settingDescription}>Update your personal information</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => setChangePasswordModal(true)}>
              <View style={styles.settingIconContainer}>
                <Icon name="lock" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Change Password</Text>
                <Text style={styles.settingDescription}>Update your password</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => setNotificationsModal(true)}>
              <View style={styles.settingIconContainer}>
                <Icon name="bell" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Notifications</Text>
                <Text style={styles.settingDescription}>Manage your notifications</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => setPrivacyModal(true)}>
              <View style={styles.settingIconContainer}>
                <Icon name="shield" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Privacy & Security</Text>
                <Text style={styles.settingDescription}>Manage your privacy settings</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingsSectionContainer}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            <TouchableOpacity style={styles.settingItem} onPress={handleHelpPress}>
              <View style={styles.settingIconContainer}>
                <Icon name="question-circle" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Help & Support</Text>
                <Text style={styles.settingDescription}>Get help and contact support</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => setFeedbackModal(true)}>
              <View style={styles.settingIconContainer}>
                <Icon name="comment" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>Beta Feedback</Text>
                <Text style={styles.settingDescription}>Share your experience with the beta version</Text>
              </View>
              <Icon name="chevron-right" type="font-awesome" color="#666" size={16} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingIconContainer}>
                <Icon name="info-circle" type="font-awesome" color="#3B82F6" size={20} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingText}>About</Text>
                <Text style={styles.settingDescription}>App version and information</Text>
              </View>
              <Text style={styles.versionText}>v1.0.0</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.deleteAccountButton} 
            onPress={() => setDeleteAccountModal(true)}
          >
            <Icon 
              name="trash" 
              type="font-awesome" 
              color="#EF4444" 
              size={20} 
              style={{ marginRight: 8 }}
            />
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CustomAlert
        visible={signOutAlertVisible}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        buttons={[
          {
            text: 'Cancel',
            onPress: () => setSignOutAlertVisible(false),
            style: 'cancel'
          },
          {
            text: 'Sign Out',
            onPress: handleSignOutConfirm,
            style: 'destructive'
          }
        ]}
        onDismiss={() => setSignOutAlertVisible(false)}
      />

      {/* Modals */}
      <Modal
        visible={editProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setEditProfileModal(false);
          setFormErrors({});
        }}
      >
        {/* Edit Profile Modal Content */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setEditProfileModal(false);
                  setFormErrors({});
                }}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome-5" color="#666" size={20} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.profileImageSection}>
                {isUploading ? (
                  <View style={[styles.profileImage, styles.loadingContainer]}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                  </View>
                ) : (
                  <Image
                    source={
                      user?.photoURL
                        ? { uri: user.photoURL }
                        : require('../../assets/default-avatar.png')
                    }
                    style={styles.profileImage}
                  />
                )}
                <TouchableOpacity onPress={handleChangePhoto}>
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={[styles.input, formErrors.firstName && styles.inputError, { color: '#fff' }]}
                  placeholder="First Name"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    if (formErrors.firstName) {
                      setFormErrors({...formErrors, firstName: ''});
                    }
                  }}
                  placeholderTextColor="#666"
                />
                {formErrors.firstName && (
                  <Text style={styles.errorText}>{formErrors.firstName}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={[styles.input, formErrors.lastName && styles.inputError, { color: '#fff' }]}
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text);
                    if (formErrors.lastName) {
                      setFormErrors({...formErrors, lastName: ''});
                    }
                  }}
                  placeholderTextColor="#666"
                />
                {formErrors.lastName && (
                  <Text style={styles.errorText}>{formErrors.lastName}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, formErrors.email && styles.inputError]}
                  placeholder="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (formErrors.email) {
                      setFormErrors({...formErrors, email: ''});
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#666"
                />
                {formErrors.email && (
                  <Text style={styles.errorText}>{formErrors.email}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={[styles.input, formErrors.phone && styles.inputError]}
                  placeholder="Phone Number"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (formErrors.phone) {
                      setFormErrors({...formErrors, phone: ''});
                    }
                  }}
                  keyboardType="phone-pad"
                  placeholderTextColor="#666"
                />
                {formErrors.phone && (
                  <Text style={styles.errorText}>{formErrors.phone}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput, formErrors.bio && styles.inputError]}
                  placeholder="Tell us about yourself"
                  value={bio}
                  onChangeText={(text) => {
                    setBio(text);
                    if (formErrors.bio) {
                      setFormErrors({...formErrors, bio: ''});
                    }
                  }}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor="#666"
                />
                <Text style={styles.charCount}>{bio.length}/200</Text>
                {formErrors.bio && (
                  <Text style={styles.errorText}>{formErrors.bio}</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditProfileModal(false);
                  setFormErrors({});
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleProfileUpdate}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={changePasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setChangePasswordModal(false);
          setPasswordErrors({});
        }}
      >
        {/* Change Password Modal Content */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setChangePasswordModal(false);
                  setPasswordErrors({});
                }}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome-5" color="#666" size={20} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Change Password</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.passwordInfoContainer}>
                <Icon name="lock" type="font-awesome" color="#3B82F6" size={24} />
                <Text style={styles.passwordInfoText}>
                  Your password must be at least 8 characters long and include a mix of letters, numbers, and special characters.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordErrors.currentPassword && styles.inputError]}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChangeText={(text) => {
                      setCurrentPassword(text);
                      if (passwordErrors.currentPassword) {
                        setPasswordErrors({...passwordErrors, currentPassword: ''});
                      }
                    }}
                    secureTextEntry={!showCurrentPassword}
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity 
                    style={styles.passwordToggle}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Icon 
                      name={showCurrentPassword ? "eye-slash" : "eye"} 
                      type="font-awesome" 
                      color="#666" 
                      size={20} 
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.currentPassword && (
                  <Text style={styles.errorText}>{passwordErrors.currentPassword}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordErrors.newPassword && styles.inputError]}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (passwordErrors.newPassword) {
                        setPasswordErrors({...passwordErrors, newPassword: ''});
                      }
                    }}
                    secureTextEntry={!showNewPassword}
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity 
                    style={styles.passwordToggle}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Icon 
                      name={showNewPassword ? "eye-slash" : "eye"} 
                      type="font-awesome" 
                      color="#666" 
                      size={20} 
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.newPassword && (
                  <Text style={styles.errorText}>{passwordErrors.newPassword}</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordErrors.confirmPassword && styles.inputError]}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (passwordErrors.confirmPassword) {
                        setPasswordErrors({...passwordErrors, confirmPassword: ''});
                      }
                    }}
                    secureTextEntry={!showConfirmPassword}
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity 
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Icon 
                      name={showConfirmPassword ? "eye-slash" : "eye"} 
                      type="font-awesome" 
                      color="#666" 
                      size={20} 
                    />
                  </TouchableOpacity>
                </View>
                {passwordErrors.confirmPassword && (
                  <Text style={styles.errorText}>{passwordErrors.confirmPassword}</Text>
                )}
              </View>

              <View style={styles.passwordStrengthContainer}>
                <Text style={styles.passwordStrengthLabel}>Password Strength:</Text>
                <View style={styles.passwordStrengthBar}>
                  <View 
                    style={[
                      styles.passwordStrengthFill,
                      { 
                        width: `${getPasswordStrength(currentPassword)}%`,
                        backgroundColor: getPasswordStrengthColor(currentPassword)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.passwordStrengthText}>{getPasswordStrengthText(currentPassword)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setChangePasswordModal(false);
                  setPasswordErrors({});
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handlePasswordChange}
              >
                <Text style={styles.buttonText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={notificationsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNotificationsModal(false)}
      >
        {/* Notifications Modal Content */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setNotificationsModal(false)}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome-5" color="#666" size={20} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Notification Settings</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.settingsInfoContainer}>
                <Icon name="bell" type="font-awesome" color="#3B82F6" size={24} />
                <Text style={styles.settingsInfoText}>
                  Customize how you receive notifications from StingerAI.
                </Text>
              </View>

              <View style={styles.modalSettingsSection}>
                <Text style={styles.settingsSectionTitle}>Push Notifications</Text>
                
                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Enable Push Notifications</Text>
                    <Text style={styles.settingToggleDescription}>Receive notifications on your device</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Sound</Text>
                    <Text style={styles.settingToggleDescription}>Play sound for notifications</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Vibration</Text>
                    <Text style={styles.settingToggleDescription}>Vibrate for notifications</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <View style={styles.modalSettingsSection}>
                <Text style={styles.settingsSectionTitle}>Email Notifications</Text>
                
                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Security Alerts</Text>
                    <Text style={styles.settingToggleDescription}>Get notified about security updates</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Updates & News</Text>
                    <Text style={styles.settingToggleDescription}>Receive updates about new features</Text>
                  </View>
                  <Switch
                    value={false}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <View style={styles.comingSoonContainer}>
                <Icon name="rocket" type="font-awesome" color="#3B82F6" size={20} />
                <Text style={styles.comingSoonText}>
                  More notification settings coming soon!
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setNotificationsModal(false)}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={privacyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModal(false)}
      >
        {/* Privacy Modal Content */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setPrivacyModal(false)}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome-5" color="#666" size={20} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Privacy & Security</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.settingsInfoContainer}>
                <Icon name="shield" type="font-awesome" color="#3B82F6" size={24} />
                <Text style={styles.settingsInfoText}>
                  Manage your privacy settings and security preferences.
                </Text>
              </View>

              <View style={styles.modalSettingsSection}>
                <Text style={styles.settingsSectionTitle}>Account Security</Text>
                
                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Two-Factor Authentication</Text>
                    <Text style={styles.settingToggleDescription}>Add an extra layer of security</Text>
                  </View>
                  <Switch
                    value={false}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Login Notifications</Text>
                    <Text style={styles.settingToggleDescription}>Get notified of new logins</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <View style={styles.modalSettingsSection}>
                <Text style={styles.settingsSectionTitle}>Privacy</Text>
                
                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Profile Visibility</Text>
                    <Text style={styles.settingToggleDescription}>Control who can see your profile</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.settingToggleItem}>
                  <View style={styles.settingToggleContent}>
                    <Text style={styles.settingToggleLabel}>Activity Status</Text>
                    <Text style={styles.settingToggleDescription}>Show when you're active</Text>
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => {}}
                    trackColor={{ false: '#767577', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              <View style={styles.comingSoonContainer}>
                <Icon name="rocket" type="font-awesome" color="#3B82F6" size={20} />
                <Text style={styles.comingSoonText}>
                  More privacy settings coming soon!
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setPrivacyModal(false)}
              >
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={deleteAccountModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Delete Account</Text>
              <TouchableOpacity
                onPress={() => setDeleteAccountModal(false)}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome" color="#fff" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteWarningContainer}>
              <View style={styles.warningIconContainer}>
                <Icon name="exclamation-triangle" type="font-awesome" color="#EF4444" size={36} />
              </View>
              <Text style={styles.deleteWarningTitle}>Are you sure?</Text>
              <Text style={styles.deleteWarningText}>
                This action cannot be undone. All your data including your profile, preferences, and activity will be permanently deleted.
              </Text>
              <Text style={styles.deleteConfirmationLabel}>
                Type "delete" to confirm:
              </Text>
              <TextInput
                style={[styles.input, styles.deleteConfirmationInput]}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder="Type 'delete'"
                placeholderTextColor="#666"
              />
            
              <View style={styles.deleteActionContainer}>
                <TouchableOpacity
                  style={styles.cancelDeleteButton}
                  onPress={() => setDeleteAccountModal(false)}
                >
                  <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.confirmDeleteButton,
                    { opacity: deleteConfirmation.toLowerCase() === 'delete' && !isDeleting ? 1 : 0.5 }
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={deleteConfirmation.toLowerCase() !== 'delete' || isDeleting}
                >
                  {isDeleting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmDeleteButtonText}>Deleting...</Text>
                    </View>
                  ) : (
                    <Text style={styles.confirmDeleteButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={feedbackModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setFeedbackModal(false);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.feedbackModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setFeedbackModal(false)}
                style={styles.closeButton}
              >
                <Icon name="times" type="font-awesome-5" color="#666" size={20} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Beta Feedback</Text>
              <View style={styles.closeButton} />
            </View>

            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.feedbackInfoContainer}>
                <Icon name="info-circle" type="font-awesome" color="#3B82F6" size={24} />
                <Text style={styles.feedbackInfoText}>
                  Your feedback helps us improve StingerAI. Thank you for taking the time to share your thoughts!
                </Text>
              </View>
              
              <View style={styles.feedbackStatsContainer}>
                <View style={styles.feedbackStatItem}>
                  <Text style={styles.feedbackStatNumber}>142</Text>
                  <Text style={styles.feedbackStatLabel}>Issues Fixed</Text>
                </View>
                <View style={styles.feedbackStatItem}>
                  <Text style={styles.feedbackStatNumber}>37</Text>
                  <Text style={styles.feedbackStatLabel}>Features Added</Text>
                </View>
                <View style={styles.feedbackStatItem}>
                  <Text style={styles.feedbackStatNumber}>91%</Text>
                  <Text style={styles.feedbackStatLabel}>Response Rate</Text>
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryPicker}>
                <Picker
                  selectedValue={feedbackCategory}
                  onValueChange={(itemValue: string) => setFeedbackCategory(itemValue)}
                  dropdownIconColor="#fff"
                  style={{color: '#fff'}}
                  itemStyle={styles.pickerItemStyle}
                >
                  {feedbackCategories.map(category => (
                    <Picker.Item 
                      key={category.value} 
                      label={category.label} 
                      value={category.value} 
                    />
                  ))}
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Rating</Text>
              <View style={styles.ratingContainer}>
                {renderStars()}
              </View>

              <Text style={styles.inputLabel}>Your Feedback</Text>
              <TextInput
                style={styles.feedbackTextArea}
                placeholder="Please describe your experience with StingerAI. What did you like? What could be improved? Any specific features or bugs you'd like to mention?"
                placeholderTextColor="#666"
                multiline
                numberOfLines={6}
                value={feedbackContent}
                onChangeText={setFeedbackContent}
                maxLength={maxFeedbackLength}
              />
              <Text 
                style={[
                  styles.characterCount,
                  feedbackContent.length > maxFeedbackLength * 0.8 && styles.characterCountWarning,
                  feedbackContent.length > maxFeedbackLength * 0.95 && styles.characterCountError
                ]}
              >
                {feedbackContent.length}/{maxFeedbackLength} characters
              </Text>
              
              {!screenshotUri ? (
                <TouchableOpacity 
                  style={styles.attachScreenshotButton}
                  onPress={handleScreenshotCapture}
                  disabled={isSubmittingFeedback}
                >
                  {isSubmittingFeedback ? (
                    <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
                  ) : (
                    <Icon name="camera" type="font-awesome" color="#3B82F6" size={16} />
                  )}
                  <Text style={styles.attachScreenshotText}>
                    {isSubmittingFeedback ? 'Capturing...' : 'Attach Screenshot'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ position: 'relative' }}>
                  <Image 
                    source={{ uri: screenshotUri }} 
                    style={styles.screenshotPreview} 
                    resizeMode="contain"
                  />
                  <TouchableOpacity 
                    style={styles.removeScreenshotButton}
                    onPress={removeScreenshot}
                  >
                    <Icon name="times" type="font-awesome" color="#fff" size={16} />
                  </TouchableOpacity>
                </View>
              )}

              {!feedbackSent ? (
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={handleSubmitFeedback}
                  disabled={isSubmittingFeedback}
                >
                  {isSubmittingFeedback ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Feedback</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.feedbackSent}>
                  <Text style={styles.feedbackSentText}>Thank you for your feedback!</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default ProfileScreen; 