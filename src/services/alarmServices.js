import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

import * as Notifications from "expo-notifications";

import { NativeModules } from "react-native";

import { db } from "../../firebaseConfig";


// ============================================================
// NATIVE ALARM MODULE
// ============================================================

const { AlarmModule } = NativeModules;


// ============================================================
// NATIVE MODULE CHECK
// ============================================================

function isNativeAlarmAvailable() {
  if (!AlarmModule) {
    console.log("AlarmModule is not available.");
    return false;
  }

  return true;
}


// ============================================================
// CHECK WHETHER USER STOPPED ALARM
// ============================================================

async function wasAlarmStoppedByUser() {
  if (!isNativeAlarmAvailable()) {
    return false;
  }

  try {
    const stopped =
      await AlarmModule.wasStoppedByUser();

    console.log(
      "Alarm stopped by user:",
      stopped
    );

    return stopped === true;

  } catch (error) {
    console.log(
      "Stopped-state check error:",
      error
    );

    return false;
  }
}


// ============================================================
// CLEAR USER STOP STATE
// ============================================================

async function clearAlarmStoppedState() {
  if (!isNativeAlarmAvailable()) {
    return;
  }

  try {
    await AlarmModule.clearStoppedState();

    console.log(
      "Alarm stopped state cleared."
    );

  } catch (error) {
    console.log(
      "Clear stopped-state error:",
      error
    );
  }
}


// ============================================================
// NOTIFICATION CONFIGURATION
// ============================================================

let notificationHandlerReady = false;

let notificationResponseSubscription = null;


// ============================================================
// SETUP NOTIFICATION HANDLER
// ============================================================

export async function setupAlarmNotificationHandler() {

  if (notificationHandlerReady) {
    return;
  }

  notificationHandlerReady = true;


  // ==========================================================
  // NOTIFICATION CATEGORY
  // ==========================================================

  if (
    typeof Notifications.setNotificationCategoryAsync ===
    "function"
  ) {

    try {

      await Notifications.setNotificationCategoryAsync(
        "KILL_ALARM",
        [
          {
            identifier:
              "STOP_ALARM",

            buttonTitle:
              "Stop",

            options: {
              opensAppToForeground:
                true,
            },
          },
        ]
      );

      console.log(
        "Notification category ready."
      );

    } catch (error) {

      console.log(
        "Notification category error:",
        error
      );
    }
  }


  // ==========================================================
  // NOTIFICATION RESPONSE LISTENER
  // ==========================================================

  try {

    notificationResponseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {

          try {

            console.log(
              "Notification response received:",
              response?.actionIdentifier
            );


            const action =
              response?.actionIdentifier;


            // ==================================================
            // STOP BUTTON
            // ==================================================

            if (
              action === "STOP_ALARM"
            ) {

              console.log(
                "STOP ALARM button pressed."
              );


              // ----------------------------------------------
              // IMPORTANT
              // ----------------------------------------------
              // Native module records that user intentionally
              // stopped the alarm.
              //
              // This flag is checked by syncAlarmState()
              // when Home opens.
              // ----------------------------------------------

              if (
                isNativeAlarmAvailable()
              ) {

                try {

                  await AlarmModule.markStoppedByUser();

                  console.log(
                    "Native stopped-by-user state saved."
                  );

                } catch (error) {

                  console.log(
                    "Unable to save stopped-by-user state:",
                    error
                  );
                }
              }


              // ----------------------------------------------
              // Stop native alarm immediately
              // ----------------------------------------------

              await stopAlarm();


              // ----------------------------------------------
              // Dismiss notification
              // ----------------------------------------------

              try {

                await Notifications.dismissAllNotificationsAsync();

              } catch (error) {

                console.log(
                  "Notification dismiss error:",
                  error
                );
              }
            }

          } catch (error) {

            console.log(
              "Notification response handling error:",
              error
            );
          }
        }
      );


    console.log(
      "Notification response listener ready."
    );

  } catch (error) {

    console.log(
      "Notification response listener error:",
      error
    );
  }
}


// ============================================================
// START ALARM
// ============================================================

export async function startAlarm() {

  try {

    console.log(
      "Starting native foreground alarm..."
    );


    if (
      !isNativeAlarmAvailable()
    ) {
      return;
    }


    // ========================================================
    // NEW KILL
    // ========================================================
    // A new KILL must always be allowed to start.
    //
    // Therefore old STOP state is cleared.
    // ========================================================

    await clearAlarmStoppedState();


    // ========================================================
    // START NATIVE ALARM
    // ========================================================

    AlarmModule.startAlarm();


    console.log(
      "ALARM START COMMAND SENT"
    );

  } catch (error) {

    console.log(
      "Alarm start error:",
      error
    );
  }
}


// ============================================================
// STOP ALARM
// ============================================================

export async function stopAlarm() {

  try {

    console.log(
      "Stopping native foreground alarm..."
    );


    if (
      !isNativeAlarmAvailable()
    ) {
      return;
    }


    AlarmModule.stopAlarm();


    console.log(
      "ALARM STOP COMMAND SENT"
    );

  } catch (error) {

    console.log(
      "Alarm stop error:",
      error
    );
  }
}


// ============================================================
// RESOLVE ACTIVE FIREBASE ALARM
// ============================================================

export async function resolveActiveAlarm(
  uid
) {

  if (!uid) {
    return;
  }


  try {

    console.log(
      "Resolving active alarm for:",
      uid
    );


    const deviceRef =
      doc(
        db,
        "devices",
        uid
      );


    const deviceSnapshot =
      await getDoc(
        deviceRef
      );


    // ========================================================
    // DEVICE DOES NOT EXIST
    // ========================================================

    if (
      !deviceSnapshot.exists()
    ) {

      await stopAlarm();

      await clearAlarmStoppedState();

      console.log(
        "Device document does not exist."
      );

      return;
    }


    const device =
      deviceSnapshot.data();


    const activeAlertId =
      device.activeAlertId || null;


    // ========================================================
    // STOP NATIVE ALARM
    // ========================================================

    await stopAlarm();


    // ========================================================
    // STOP ACTIVE ALERT
    // ========================================================

    if (
      activeAlertId
    ) {

      try {

        await updateDoc(

          doc(
            db,
            "alerts",
            activeAlertId
          ),

          {
            status:
              "stopped",

            stoppedAt:
              new Date(),
          }
        );


        console.log(
          "Alert marked as stopped:",
          activeAlertId
        );

      } catch (error) {

        console.log(
          "Alert resolve error:",
          error
        );
      }
    }


    // ========================================================
    // CLEAR FIRESTORE KILL STATE
    // ========================================================

    await updateDoc(

      deviceRef,

      {
        isKilled:
          false,

        activeAlertId:
          null,
      }
    );


    console.log(
      "Firestore kill state cleared."
    );


    // ========================================================
    // CLEAR LOCAL STOP FLAG
    // ========================================================
    //
    // This is important.
    //
    // STOP notification has now been completely processed.
    //
    // If the user presses KILL again later,
    // startAlarm() will also clear the flag.
    // ========================================================

    await clearAlarmStoppedState();


    console.log(
      "Device UNKILLED from alarm STOP."
    );

  } catch (error) {

    console.log(
      "Resolve alarm error:",
      error
    );

    throw error;
  }
}


// ============================================================
// SYNC ALARM STATE
// ============================================================

export async function syncAlarmState(
  uid
) {

  if (!uid) {
    return;
  }


  try {

    console.log(
      "================================"
    );

    console.log(
      "SYNC ALARM STATE"
    );

    console.log(
      "UID:",
      uid
    );


    // ========================================================
    // STEP 1
    // CHECK USER STOP FLAG
    // ========================================================

    const stoppedByUser =
      await wasAlarmStoppedByUser();


    console.log(
      "STOPPED BY USER:",
      stoppedByUser
    );


    // ========================================================
    // USER PRESSED STOP
    // ========================================================

    if (
      stoppedByUser
    ) {

      console.log(
        "USER STOP DETECTED"
      );


      /*
       * Notification STOP means:
       *
       * 1. Stop native alarm
       * 2. Stop active Firebase alert
       * 3. isKilled = false
       * 4. activeAlertId = null
       */

      await resolveActiveAlarm(
        uid
      );


      console.log(
        "STOP REQUEST COMPLETED."
      );


      return;
    }


    // ========================================================
    // STEP 2
    // GET FIREBASE DEVICE
    // ========================================================

    const deviceRef =
      doc(
        db,
        "devices",
        uid
      );


    const snapshot =
      await getDoc(
        deviceRef
      );


    // ========================================================
    // DEVICE DOES NOT EXIST
    // ========================================================

    if (
      !snapshot.exists()
    ) {

      console.log(
        "Device document not found."
      );


      await stopAlarm();


      return;
    }


    const data =
      snapshot.data();


    console.log(
      "Alarm sync device:",
      data
    );


    // ========================================================
    // STEP 3
    // KILL CONDITION
    // ========================================================

    if (
      data.isKilled === true &&
      data.activeAlertId
    ) {

      console.log(
        "SYNC → KILLED + ACTIVE ALERT → START ALARM"
      );


      await startAlarm();


    } else {

      console.log(
        "SYNC → NOT KILLED → STOP ALARM"
      );


      await stopAlarm();
    }


    console.log(
      "================================"
    );

  } catch (error) {

    console.log(
      "Alarm sync error:",
      error
    );
  }
}


// ============================================================
// CLEANUP NOTIFICATION LISTENER
// ============================================================

export function cleanupAlarmNotificationHandler() {

  try {

    if (
      notificationResponseSubscription
    ) {

      notificationResponseSubscription.remove();

      notificationResponseSubscription =
        null;
    }


    notificationHandlerReady =
      false;


    console.log(
      "Notification response listener cleaned."
    );

  } catch (error) {

    console.log(
      "Notification listener cleanup error:",
      error
    );
  }
}