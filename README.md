# StingerAI - Your Intelligent Personal Assistant

StingerAI is a powerful, versatile mobile application that combines advanced AI capabilities with an intuitive interface to help you tackle various aspects of your life - from academic pursuits to professional tasks and personal projects.

## 🌟 Key Features

### 💡 Intelligent Assistance
- Powered by DeepSeek's 70B language model
- Context-aware responses
- Multi-domain expertise (academic, professional, personal)
- Real-time, natural conversation flow

### 🎯 Task Management
- Quick action shortcuts for common tasks
- Project planning and organization
- Note-taking and documentation
- Goal setting and tracking

### 🎤 Multi-Modal Input
- Text-based chat interface
- Voice input with speech-to-text
- Image upload capability
- Seamless switching between input methods

### 💾 Smart Session Management
- Automatic conversation saving
- Organized chat history
- Easy access to previous discussions
- Session categorization

### 🎨 Modern User Interface
- Clean, dark-themed design
- Responsive layout
- Real-time typing indicators
- Smooth animations
- Keyboard-aware design

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- Expo CLI
- React Native development environment
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stinger-ai.git
cd stinger-ai
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a .env file in the root directory:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

4. Start the development server:
```bash
expo start
```

## 🎯 Use Cases

### Academic
- Study planning and organization
- Research assistance
- Essay writing and editing
- Exam preparation
- Concept explanation

### Professional
- Business planning
- Content creation
- Project management
- Meeting preparation
- Professional development

### Personal
- Goal setting and tracking
- Creative project planning
- Lifestyle organization
- Travel planning
- Personal finance management

### Creative
- Brainstorming sessions
- Writing assistance
- Project ideation
- Design concept exploration
- Creative problem-solving

## 🛠 Technical Stack

- **Frontend**: React Native, Expo
- **State Management**: React Context
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **AI Integration**: OpenRouter API (DeepSeek 70B model)
- **Storage**: AsyncStorage for local data
- **UI Components**: Custom components + React Native Elements

## 📱 App Structure

```
src/
  ├── components/     # Reusable UI components
  ├── config/         # Configuration files
  ├── context/        # React Context providers
  ├── navigation/     # Navigation configuration
  ├── screens/        # App screens
  ├── services/       # API and business logic
  └── types/          # TypeScript type definitions
```

## 🔐 Security Features

- Secure authentication via Supabase
- API key protection
- Secure data storage
- Session management
- Input validation

## 🎨 Design Philosophy

StingerAI follows these core design principles:
- **Simplicity**: Clean, intuitive interface
- **Efficiency**: Quick access to common actions
- **Flexibility**: Multiple input methods
- **Reliability**: Robust error handling
- **Responsiveness**: Smooth, natural interactions

## 📈 Future Enhancements

- [ ] Enhanced image processing capabilities
- [ ] Custom AI model fine-tuning
- [ ] Collaborative features
- [ ] Advanced data analytics
- [ ] Offline mode support
- [ ] Cross-platform sync
- [ ] Extended template library

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- DeepSeek for the AI model
- Supabase for backend services
- Expo team for the development framework
- Our contributors and supporters

## 📞 Support

For support, please:
- Open an issue in the repository
- Contact our support team at support@stingerai.app
- Join our Discord community

## Notifications

The app supports both local and push notifications to keep users informed about their tasks and app updates.

### Local Notifications

Local notifications are scheduled on the device itself and don't require a server. They are used for:

- Task reminders (scheduled 1 hour before due date)
- Task creation confirmations
- Status updates

To send a notification from anywhere in the app:

```javascript
import { notificationService } from '../services/notificationService';

// Send immediate notification
notificationService.sendLocalNotification(
  "Notification Title", 
  "This is the notification body text",
  { optional: "data" } // Optional data to pass with the notification
);

// Schedule a future notification
const dueDate = new Date("2023-12-31T12:00:00");
notificationService.scheduleTaskReminder(
  "task-123", 
  "Complete project report", 
  dueDate
);
```

### Push Notifications

The app also supports server-initiated push notifications using Supabase Edge Functions and Expo's Push Notification service. This enables:

- Sending notifications to users from the server
- Notifying users when they're not actively using the app
- Cross-device notification synchronization

To set up push notifications:

1. Deploy the Supabase Edge Function (see `supabase/functions/send-push-notification/README.md`)
2. Ensure the `device_push_tokens` table is created in your database
3. Register devices using the `pushNotificationService`

To send a push notification to a user:

```javascript
import { pushNotificationService } from '../services/pushNotificationService';

// Send a push notification to a specific user
await pushNotificationService.sendPushNotification(
  "user-123", // User ID
  {
    title: "New Message", 
    body: "You have received a new message",
    data: { screen: "Chat", chatId: "chat-456" } // Optional navigation data
  }
);
```

The push notification system automatically handles:
- Device token registration
- Token updates when they change
- Sending to multiple devices for the same user
- Authentication and security

## Application Maintenance Guide

Maintaining your StingerAI application ensures it remains performant, secure, and up-to-date. Here's a comprehensive guide to maintaining your React Native app.

### Administrator Tools

StingerAI includes a set of administrative tools in the `admin-tools/` directory:

- **Push Notification Testing**: Tools for testing and managing push notifications
- **Database Management**: SQL queries for database setup and maintenance
- **Deployment Scripts**: Instructions and utilities for deployment

These tools are intended for developers and administrators only and should not be included in production builds. See the `admin-tools/README.md` file for more information on using these utilities.

### Routine Maintenance Tasks

#### 1. Keep Dependencies Updated

```bash
# Check outdated packages
npm outdated

# Update packages (careful with major version changes)
npm update

# For Expo-specific updates
npx expo-cli upgrade
```

#### 2. Testing and Quality Assurance

- **Run automated tests** regularly to catch regressions
- **Perform manual testing** on critical user flows after updates
- **Test on multiple device sizes** to ensure responsive design works

#### 3. Performance Monitoring

- Monitor app launch time and interaction responsiveness
- Watch for memory leaks using React DevTools
- Run regular performance audits
- Monitor API response times

#### 4. Error Tracking

- Implement error boundary components
- Set up crash reporting (e.g., Sentry)
- Monitor console logs in production

### Code Maintenance

#### 1. Code Refactoring

- Periodically review and refactor complex components
- Extract reusable hooks and components
- Maintain proper type definitions
- Follow consistent naming conventions

#### 2. Documentation

- Keep API documentation updated
- Document complex business logic
- Add comments for non-obvious code
- Update README with new features

#### 3. Version Control

- Use feature branches for development
- Perform code reviews before merging
- Maintain a clear commit history
- Tag releases with version numbers

### Release Process

#### 1. Pre-Release Checklist

- [ ] Run all tests
- [ ] Check for console warnings/errors
- [ ] Verify all API endpoints work
- [ ] Test on multiple devices
- [ ] Verify notifications and background tasks
- [ ] Check app performance metrics

#### 2. Publishing Updates

For Expo projects:
```bash
# Build a new Expo update
npx expo publish

# Create standalone builds
npx expo build:android
npx expo build:ios
```

#### 3. Post-Release Monitoring

- Monitor crash reports after deployment
- Watch user feedback and ratings
- Check analytics for unexpected behavior
- Be prepared for hotfixes if needed

### Security Maintenance

#### 1. Regular Security Audits

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

#### 2. Data Protection

- Regularly review data storage practices
- Ensure proper encryption for sensitive data
- Maintain secure API communication
- Follow platform security best practices

### Scaling Considerations

As your user base grows:

- Consider implementing server-side caching
- Optimize database queries
- Use pagination for large data sets
- Implement proper indexing
- Consider CDN for static assets

### Troubleshooting Common Issues

#### Notification Issues
- Verify notification permissions
- Check notification token registration
- Test notification delivery on actual devices

#### Performance Problems
- Use React.memo for expensive components
- Remove unnecessary re-renders
- Optimize list rendering with proper keys
- Use proper image caching

#### Device Compatibility
- Test on various Android/iOS versions
- Check for platform-specific APIs
- Use responsive layouts

---

By following these maintenance practices, you'll ensure your StingerAI application remains stable, secure, and performant for your users.

---

Built with ❤️ by the StingerAI Team 

 
