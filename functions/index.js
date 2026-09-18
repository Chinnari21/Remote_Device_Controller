const {
  setGlobalOptions,
  logger,
} = require("firebase-functions");

const {
  onDocumentCreated,
} = require("firebase-functions/v2/firestore");

const {
  onSchedule,
} = require("firebase-functions/v2/scheduler");

const {
  initializeApp,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const {
  getMessaging,
} = require("firebase-admin/messaging");


initializeApp();

const db = getFirestore();
const messaging = getMessaging();


setGlobalOptions({
  maxInstances: 10,
});


// ============================================================
// 1. ALERT CREATED → SEND FCM PUSH
// ============================================================
//
// alerts/{alertId}
//
// Home screen creates this document when:
// DEVICE = ON + KILL
//
// ============================================================

exports.sendKillAlertNotification =
  onDocumentCreated(
    "alerts/{alertId}",
    async (event) => {
      try {
        const snapshot = event.data;

        if (!snapshot) {
          logger.error(
            "No alert document found."
          );
          return;
        }

        const alert = snapshot.data();
        const alertId =
          event.params.alertId;

        logger.info(
          "New alert created:",
          {
            alertId,
            alert,
          }
        );

        const uid = alert.uid;

        if (!uid) {
          logger.error(
            "Alert does not contain uid.",
            {
              alertId,
            }
          );

          return;
        }


        // ------------------------------------------------------
        // GET DEVICE
        // ------------------------------------------------------

        const deviceRef = db
          .collection("devices")
          .doc(uid);

        const deviceSnapshot =
          await deviceRef.get();

        if (!deviceSnapshot.exists) {
          logger.error(
            "Device document does not exist.",
            {
              uid,
              alertId,
            }
          );

          return;
        }

        const device =
          deviceSnapshot.data();

        const fcmToken =
          device.fcmToken;

        if (!fcmToken) {
          logger.error(
            "No FCM token found for device.",
            {
              uid,
              alertId,
            }
          );

          return;
        }


        // ------------------------------------------------------
        // FCM MESSAGE
        // ------------------------------------------------------

        const message = {
          token: fcmToken,

          notification: {
            title:
              "Remote Desktop Switch",

            body:
              "Device has been killed while it is ON.",
          },

          data: {
            type: "KILL",
            alertId: String(alertId),
            uid: String(uid),
            action: "STOP_ALARM",
          },

          android: {
            priority: "high",

            notification: {
              channelId: "alarm-v2",
              sound: "default",
              priority: "high",
            },
          },
        };


        // ------------------------------------------------------
        // SEND
        // ------------------------------------------------------

        const response =
          await messaging.send(message);

        logger.info(
          "FCM notification sent successfully.",
          {
            response,
            alertId,
            uid,
          }
        );


        // ------------------------------------------------------
        // SAVE STATUS
        // ------------------------------------------------------

        await snapshot.ref.set(
          {
            notificationSent: true,

            notificationSentAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

      } catch (error) {

        logger.error(
          "Error sending kill notification.",
          error
        );

        throw error;
      }
    }
  );


// ============================================================
// 2. DEVICE OFF + KILL → ONE-TIME PUSH
// ============================================================
//
// offlineKillEvents/{eventId}
//
// ============================================================

exports.sendOfflineKillNotification =
  onDocumentCreated(
    "offlineKillEvents/{eventId}",
    async (event) => {

      try {

        const snapshot =
          event.data;

        if (!snapshot) {
          logger.error(
            "No offline kill event data."
          );

          return;
        }


        const data =
          snapshot.data();

        const uid =
          data.uid;


        if (!uid) {
          logger.error(
            "Offline kill event has no uid."
          );

          return;
        }


        // ------------------------------------------------------
        // GET DEVICE
        // ------------------------------------------------------

        const deviceRef =
          db
            .collection("devices")
            .doc(uid);

        const deviceSnapshot =
          await deviceRef.get();


        if (!deviceSnapshot.exists) {
          logger.error(
            "Device does not exist.",
            {
              uid,
            }
          );

          return;
        }


        const device =
          deviceSnapshot.data();

        const fcmToken =
          device.fcmToken;


        if (!fcmToken) {
          logger.error(
            "No FCM token available.",
            {
              uid,
            }
          );

          return;
        }


        // ------------------------------------------------------
        // SEND OFFLINE KILL PUSH
        // ------------------------------------------------------

        const message = {

          token: fcmToken,

          notification: {

            title:
              "Remote Desktop Switch",

            body:
              "Device was killed while it was OFF.",
          },

          data: {

            type:
              "OFFLINE_KILL",

            uid:
              String(uid),

            action:
              "STOP_ALARM",
          },

          android: {

            priority:
              "high",

            notification: {

              channelId:
                "alarm-v2",

              sound:
                "default",

              priority:
                "high",
            },
          },
        };


        const response =
          await messaging.send(
            message
          );


        logger.info(
          "Offline kill notification sent.",
          {
            uid,
            response,
          }
        );


        // ------------------------------------------------------
        // MARK SENT
        // ------------------------------------------------------

        await snapshot.ref.set(
          {

            notificationSent:
              true,

            notificationSentAt:
              FieldValue.serverTimestamp(),

          },
          {
            merge: true,
          }
        );

      } catch (error) {

        logger.error(
          "Offline kill notification error.",
          error
        );

        throw error;
      }
    }
  );


// ============================================================
// 3. SCHEDULE PROCESSOR
// ============================================================
//
// Runs every minute.
//
// It checks:
//
// schedules/{scheduleId}
//
// and executes matching enabled schedules.
//
// ============================================================

exports.processSchedules =
  onSchedule(
    {
      schedule:
        "every 1 minutes",

      timeZone:
        "Asia/Kolkata",
    },

    async () => {

      try {

        // ======================================================
        // GET CURRENT INDIA TIME
        // ======================================================

        const now = new Date();


        const indiaParts =
          new Intl.DateTimeFormat(
            "en-GB",
            {
              timeZone:
                "Asia/Kolkata",

              year:
                "numeric",

              month:
                "2-digit",

              day:
                "2-digit",

              hour:
                "2-digit",

              minute:
                "2-digit",

              hour12:
                false,
            }
          ).formatToParts(now);


        const getPart = (type) => {

          const part =
            indiaParts.find(
              (item) =>
                item.type === type
            );

          return part
            ? part.value
            : "";
        };


        const currentHour =
          getPart("hour");

        const currentMinute =
          getPart("minute");

        const currentYear =
          getPart("year");

        const currentMonth =
          getPart("month");

        const currentDay =
          getPart("day");


        const currentTime =
          `${currentHour}:${currentMinute}`;


        const currentDate =
          `${currentYear}-${currentMonth}-${currentDay}`;


        logger.info(
          "Schedule check started.",
          {
            currentTime,
            currentDate,
          }
        );


        // ======================================================
        // GET ENABLED SCHEDULES
        // ======================================================

        const snapshot =
          await db
            .collection("schedules")
            .where(
              "enabled",
              "==",
              true
            )
            .get();


        if (snapshot.empty) {

          logger.info(
            "No enabled schedules."
          );

          return;
        }


        // ======================================================
        // PROCESS MATCHING SCHEDULES
        // ======================================================

        for (
          const scheduleDoc
          of snapshot.docs
        ) {

          const schedule =
            scheduleDoc.data();


          // ----------------------------------------------------
          // VALIDATE UID
          // ----------------------------------------------------

          const uid =
            schedule.uid;

          if (!uid) {

            logger.error(
              "Schedule has no uid.",
              {
                scheduleId:
                  scheduleDoc.id,
              }
            );

            continue;
          }


          // ----------------------------------------------------
          // VALIDATE TIME
          // ----------------------------------------------------

          const scheduleTime =
            schedule.time;


          if (!scheduleTime) {

            logger.error(
              "Schedule has no time.",
              {
                scheduleId:
                  scheduleDoc.id,
              }
            );

            continue;
          }


          // ----------------------------------------------------
          // ONLY EXECUTE WHEN TIME MATCHES
          // ----------------------------------------------------

          if (
            scheduleTime !==
            currentTime
          ) {
            continue;
          }


          // ----------------------------------------------------
          // PREVENT DUPLICATE EXECUTION
          // ----------------------------------------------------

          if (
            schedule.lastRunDate ===
            currentDate
          ) {

            logger.info(
              "Schedule already executed today.",
              {
                scheduleId:
                  scheduleDoc.id,

                uid,
              }
            );

            continue;
          }


          // ----------------------------------------------------
          // ACTION
          // ----------------------------------------------------

          const action =
            schedule.action;


          let newState;


          if (action === "ON") {

            newState = true;

          } else if (
            action === "OFF"
          ) {

            newState = false;

          } else {

            logger.error(
              "Invalid schedule action.",
              {
                scheduleId:
                  scheduleDoc.id,

                action,
              }
            );

            continue;
          }


          logger.info(
            "Executing schedule.",
            {
              scheduleId:
                scheduleDoc.id,

              uid,

              time:
                scheduleTime,

              action,

              repeat:
                schedule.repeat,
            }
          );


          // ====================================================
          // DEVICE
          // ====================================================

          const deviceRef =
            db
              .collection("devices")
              .doc(uid);


          await deviceRef.set(
            {

              state:
                newState,

              updatedAt:
                FieldValue.serverTimestamp(),

            },
            {
              merge: true,
            }
          );


          // ====================================================
          // CREATE LOG
          // ====================================================

          await db
            .collection("logs")
            .add(
              {

                uid:

                  uid,

                mode:
                  "schedule",

                action:
                  action,

                time:
                  scheduleTime,

                scheduleId:
                  scheduleDoc.id,

                repeat:
                  schedule.repeat,

                createdAt:
                  FieldValue.serverTimestamp(),
              }
            );


          // ====================================================
          // ONCE
          // ====================================================

          if (
            schedule.repeat ===
            "Once"
          ) {

            await scheduleDoc.ref.update(
              {

                enabled:
                  false,

                lastRunDate:
                  currentDate,

                lastRunAt:
                  FieldValue.serverTimestamp(),

              }
            );


            logger.info(
              "Once schedule disabled.",
              {
                scheduleId:
                  scheduleDoc.id,
              }
            );

          }


          // ====================================================
          // DAILY
          // ====================================================

          else if (
            schedule.repeat ===
            "Daily"
          ) {

            await scheduleDoc.ref.update(
              {

                lastRunDate:
                  currentDate,

                lastRunAt:
                  FieldValue.serverTimestamp(),

              }
            );


            logger.info(
              "Daily schedule completed.",
              {
                scheduleId:
                  scheduleDoc.id,
              }
            );
          }

        }


        logger.info(
          "Schedule processing finished.",
          {
            currentTime,
            currentDate,
          }
        );

      } catch (error) {

        logger.error(
          "Schedule processor error.",
          error
        );

        throw error;
      }
    }
  );