# Feedback System Documentation

This document outlines the feedback collection system implemented in StingerAI.

## Overview

The feedback system allows users to provide structured feedback about the application, including ratings, categorized feedback, and screenshots. The system collects device information automatically to help with debugging and improving user experience.

## Features

- **Categorized Feedback**: Users can select from predefined categories (UI/UX, Bug Reports, Feature Requests, etc.)
- **Rating System**: 5-star rating system with descriptive labels
- **Text Feedback**: Text area with character limit and counter
- **Screenshot Attachment**: Users can attach screenshots to illustrate issues
- **Device Information**: Automatic collection of device details to aid debugging
- **Feedback Tracking**: Statistics about feedback response and implementation

## Implementation Details

### Frontend Components

- **ProfileScreen**: Contains the feedback form modal accessible via the "Beta Feedback" option
- **FeedbackModal**: Collects and submits user feedback with a user-friendly interface

### Backend Storage

- **user_feedback** table in Supabase with the following structure:
  - `id`: UUID primary key
  - `user_id`: References auth.users(id)
  - `content`: Text feedback content
  - `category`: Feedback category (general, bug, feature, etc.)
  - `rating`: Integer rating (1-5)
  - `created_at`: Timestamp
  - `extra_data`: JSONB field storing screenshots and device information

### Data Structure

The `extra_data` field stores a JSON object with:

```json
{
  "device_info": {
    "brand": "Device brand",
    "manufacturer": "Device manufacturer",
    "modelName": "Device model",
    "osName": "Operating system",
    "osVersion": "OS version",
    "deviceYearClass": "Device year class",
    "appVersion": "App version",
    "screenWidth": "Screen width in pixels",
    "screenHeight": "Screen height in pixels",
    "deviceType": "Phone/Tablet/Unknown"
  },
  "screenshot": "Screenshot URI or URL"
}
```

## Row-Level Security

The table implements the following security policies:

- Users can view only their own feedback
- Users can insert their own feedback
- Users can update their own feedback
- Admin users can view all feedback

## Usage Examples

### Submitting Feedback

```javascript
// In ProfileScreen.tsx
const handleSubmitFeedback = async () => {
  // Collect feedback data
  const { error } = await supabaseService.submitFeedback(
    userId,
    feedbackContent,
    feedbackCategory,
    feedbackRating,
    {
      device_info: getDeviceInfo(),
      screenshot: screenshotUri
    }
  );
};
```

### Viewing Feedback (Admin)

Use the SQL queries in `supabase/queries/view_feedback.sql` to view and analyze feedback data.

## Analytics and Reporting

The feedback system supports basic analytics through SQL queries that provide:

- Average ratings by category
- Feedback with screenshots
- Feedback with device information
- Priority feedback (low ratings)

## Future Improvements

Potential improvements for the feedback system:

1. Real screenshot capture integration using react-native-view-shot
2. Automatic feedback categorization using NLP
3. In-app notification when feedback is addressed
4. User follow-up system for critical issues
5. Integration with issue tracking systems
6. Advanced analytics dashboard for feedback trends 