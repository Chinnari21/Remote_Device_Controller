# RemoteSwitch – Remote Device Controller

A mobile application built using **React Native, Expo, and Firebase** to remotely control a paired device, schedule automatic ON/OFF operations, receive alerts and notifications, and monitor device usage through logs and analytics.

##  Project Overview

**RemoteSwitch** is a remote device control application designed as an internship training project.

The application allows authenticated users to:

* Remotely turn a paired device **ON/OFF**
* **Kill/Unkill** the device
* Schedule automatic ON/OFF operations
* Receive **push notifications** for important device events
* Trigger a continuous alarm when a kill attempt occurs while the device is ON
* View alerts and resolve active alarms
* View device usage history
* Analyze daily, weekly, monthly, and yearly device ON-time

##  Tech Stack

* **Frontend:** React Native + Expo
* **Navigation:** React Navigation
* **Authentication:** Firebase Authentication
* **Database:** Cloud Firestore
* **Push Notifications:** Firebase Cloud Messaging (FCM) + Expo Notifications
* **Backend Automation:** Firebase Cloud Functions
* **Charts & Analytics:** React Native Chart Kit / Victory Native
* **Local Alarm:** Expo Audio
* **State Management:** React Context API / Redux Toolkit

##  Main Screens

### 1. Login

* Email and password authentication
* Input validation
* Firebase Authentication
* Navigation to Signup screen

### 2. Signup

* First Name
* Last Name
* Email
* Password
* Confirm Password
* Firebase user registration
* User profile creation in Firestore

### 3. Home

* Displays logged-in user's information
* Shows paired device status
* Power ON/OFF control
* Kill/Unkill control
* Real-time device state updates

The device `state` and `isKilled` values are maintained as separate fields to keep device power status and lock-down status independent.

### 4. Schedule

Users can create automated device schedules.

Supported options:

* ON / OFF action
* Once / Daily repetition
* Enable / Disable schedule
* Edit and delete schedules

Firebase Cloud Functions evaluate schedules and update the device state automatically.

### 5. Alerts

The Alerts screen displays kill-related events.

Two main alert types are supported:

* `kill_while_off`
* `kill_while_on`

When a kill action occurs while the device is ON, a continuous alarm can be triggered along with a push notification.

The alarm can be stopped from:

* Home → Unkill
* Alerts → Stop Alarm
* Push Notification → Stop

### 6. Logs & Analytics

The Logs screen provides:

* Device ON/OFF history
* Manual and scheduled activity logs
* Daily analytics
* Weekly analytics
* Monthly analytics
* Yearly analytics
* Device ON-time charts

##  Firebase Data Model

```text
users/{uid}
    firstName
    lastName
    email
    fcmToken
    createdAt

devices/{uid}
    state
    isKilled
    lastUpdatedAt
    lastUpdatedBy

schedules/{uid}/items/{scheduleId}
    time
    action
    repeat
    enabled
    createdAt

logs/{uid}/items/{logId}
    state
    mode
    timestamp

alerts/{uid}/items/{alertId}
    type
    resolved
    timestamp
```

### Collection Responsibilities

| Collection  | Purpose                      |
| ----------- | ---------------------------- |
| `users`     | User profile and FCM token   |
| `devices`   | Current device state         |
| `schedules` | Automatic ON/OFF schedules   |
| `logs`      | Device activity history      |
| `alerts`    | Kill events and alert status |

The documented data model uses Firestore as the source of truth for device state, schedules, logs, and alerts.

##  Notification & Alarm Flow

```text
User taps Kill
       ↓
Alert document created
       ↓
Cloud Function triggered
       ↓
FCM Push Notification
       ↓
Device ON?
   ↙           ↘
 YES            NO
 ↓              ↓
Alarm + Push    Push only
 ↓
User resolves alert
       ↓
Alarm stopped
       ↓
Alert marked resolved
```

The documented design uses a continuous local alarm for a kill event while the device is ON, with three supported ways to stop it.

##  Application Flow

```text
Splash
   ↓
Login
   ↓
Signup (New User)
   ↓
Home
   ↓
--------------------------------
| Home | Schedule | Alerts | Logs |
--------------------------------
```

##  Key Features

*  Firebase Email/Password Authentication
*  React Native mobile application
*  Firebase Firestore integration
*  Real-time device state updates
*  Remote ON/OFF control
*  Kill/Unkill functionality
*  Automated device scheduling
*  Push notifications
*  Continuous alarm system
*  Device activity logs
*  Usage analytics
*  Firebase Cloud Functions

##  Project Structure

```text
RemoteSwitch/
│
├── src/
│   ├── screens/
│   │   ├── Login
│   │   ├── Signup
│   │   ├── Home
│   │   ├── Schedule
│   │   ├── Alerts
│   │   └── Logs
│   │
│   ├── components/
│   ├── services/
│   ├── firebase/
│   └── utils/
│
├── assets/
├── functions/
├── package.json
└── README.md
```

> Folder names may vary depending on the final implementation.

##  Testing Checklist

The application should be tested for:

* Authentication validation
* Real-time device state updates
* Once vs Daily schedules
* Kill while device is ON
* Kill while device is OFF
* Alarm stopping from all supported entry points
* Manual vs Schedule logs
* Analytics calculations
* Firestore security rules
* Loading, empty, and error states

These are also the major evaluation areas listed in the project documentation.

##  Development Plan

The project can be developed in the following stages:

1. **Setup & Authentication**
2. **Navigation & Home**
3. **Scheduling**
4. **Alerts & Notifications**
5. **Logs & Analytics**
6. **Testing, Polish & Demo**

This follows the six-week training structure described in the project documentation.

##  Learning Objectives

Through this project, developers can gain practical experience with:

* React Native
* Expo
* Firebase Authentication
* Firestore
* Real-time listeners
* Cloud Functions
* FCM notifications
* Local notifications and alarms
* CRUD operations
* Scheduling
* Analytics
* Mobile application architecture

##  Project Purpose

RemoteSwitch was created as an internship training project to provide hands-on experience with the same architectural patterns used in a production remote-device-control application.

##  Future Improvements

Possible future enhancements include:

* Server-side analytics aggregation
* Improved error handling
* Advanced device monitoring
* Multiple device support
* Improved notification actions
* Automated testing
* Production deployment

---

**RemoteSwitch – Remote Device Controller**
Built with  using React Native, Expo & Firebase.
