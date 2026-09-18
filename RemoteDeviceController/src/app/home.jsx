import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";

import { router } from "expo-router";

import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import * as Notifications from "expo-notifications";

import {
  useAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";

import { auth, db } from "../../firebaseConfig";


const NOTIFICATION_CATEGORY = "KILL_ALARM";
const STOP_ACTION_ID = "STOP_ALARM";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


export default function Home() {

  const [user, setUser] = useState(null);

  const [deviceState, setDeviceState] =
    useState(false);

  const [isKilled, setIsKilled] =
    useState(false);

  const [activeAlertId, setActiveAlertId] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [savingPower, setSavingPower] =
    useState(false);

  const [savingKill, setSavingKill] =
    useState(false);


  // ============================================================
  // AUDIO
  // ============================================================

  const alarmPlayer = useAudioPlayer(
    require("../../assets/alarm.wav")
  );


  // ============================================================
  // AUTH
  // ============================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          console.log(
            "Current user:",
            currentUser?.uid
          );

          setUser(currentUser);

          if (!currentUser) {
            setLoading(false);
            router.replace("/");
          }
        }
      );

    return unsubscribe;

  }, []);


  // ============================================================
  // START ALARM
  // ============================================================

  const startAlarm = async () => {

    try {

      console.log(
        "Starting continuous alarm..."
      );

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      });

      alarmPlayer.loop = true;
      alarmPlayer.volume = 1;

      alarmPlayer.seekTo(0);
      alarmPlayer.play();

      console.log("ALARM STARTED");

    } catch (error) {

      console.log(
        "Alarm start error:",
        error
      );
    }
  };


  // ============================================================
  // STOP ALARM
  // ============================================================

  const stopAlarm = async () => {

    try {

      console.log(
        "Stopping alarm..."
      );

      alarmPlayer.pause();
      alarmPlayer.seekTo(0);

      console.log(
        "ALARM STOPPED"
      );

    } catch (error) {

      console.log(
        "Alarm stop error:",
        error
      );
    }
  };


  // ============================================================
  // DEVICE LISTENER
  // ============================================================

  useEffect(() => {

    if (!user) return;

    const deviceRef = doc(
      db,
      "devices",
      user.uid
    );

    const unsubscribe = onSnapshot(
      deviceRef,

      async (snapshot) => {

        try {

          if (snapshot.exists()) {

            const data =
              snapshot.data();

            console.log(
              "Device data:",
              data
            );

            const nextState =
              data.state === true;

            const nextKilled =
              data.isKilled === true;

            const nextAlertId =
              data.activeAlertId || null;


            setDeviceState(nextState);
            setIsKilled(nextKilled);
            setActiveAlertId(nextAlertId);


            if (
              !nextKilled &&
              !nextAlertId
            ) {
              await stopAlarm();
            }

          } else {

            await setDoc(
              deviceRef,
              {
                state: false,
                isKilled: false,
                activeAlertId: null,
              },
              {
                merge: true,
              }
            );

            setDeviceState(false);
            setIsKilled(false);
            setActiveAlertId(null);
          }

          setLoading(false);

        } catch (error) {

          console.log(
            "Device snapshot error:",
            error
          );

          setLoading(false);
        }
      },

      (error) => {

        console.log(
          "Firestore listener error:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Firestore Error",
          error.message
        );
      }
    );

    return unsubscribe;

  }, [user]);


  // ============================================================
  // NOTIFICATION CATEGORY
  // ============================================================

  useEffect(() => {

    const setup = async () => {

      try {

        await Notifications.setNotificationCategoryAsync(
          NOTIFICATION_CATEGORY,
          [
            {
              identifier:
                STOP_ACTION_ID,

              buttonTitle:
                "STOP",

              options: {
                opensAppToForeground: true,
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
    };

    setup();

  }, []);


  // ============================================================
  // NOTIFICATION STOP BUTTON
  // ============================================================

  useEffect(() => {

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {

          const action =
            response.actionIdentifier;

          if (
            action !== STOP_ACTION_ID
          ) {
            return;
          }

          console.log(
            "STOP button pressed."
          );

          await stopAlarm();

          const alertId =
            response.notification
              ?.request
              ?.content
              ?.data
              ?.alertId;


          if (user && alertId) {

            try {

              await updateDoc(
                doc(
                  db,
                  "alerts",
                  alertId
                ),
                {
                  status: "stopped",
                  stoppedAt:
                    serverTimestamp(),
                }
              );

            } catch (error) {

              console.log(
                "Alert update error:",
                error
              );
            }
          }


          if (user) {

            await setDoc(
              doc(
                db,
                "devices",
                user.uid
              ),
              {
                isKilled: false,
                activeAlertId: null,
              },
              {
                merge: true,
              }
            );
          }


          setIsKilled(false);
          setActiveAlertId(null);


          try {
            await Notifications.dismissAllNotificationsAsync();
          } catch {}
        }
      );


    return () => {
      subscription.remove();
    };

  }, [user]);


  // ============================================================
  // POWER
  // ============================================================

  const togglePower = async () => {

    if (!user) {

      Alert.alert(
        "Login Required",
        "Please login first."
      );

      return;
    }

    if (savingPower) return;


    const newState =
      !deviceState;

    const oldState =
      deviceState;


    setDeviceState(newState);


    try {

      setSavingPower(true);

      await setDoc(
        doc(
          db,
          "devices",
          user.uid
        ),
        {
          state: newState,
        },
        {
          merge: true,
        }
      );

      console.log(
        "Device state saved:",
        newState
      );

    } catch (error) {

      console.log(
        "Power error:",
        error
      );

      setDeviceState(oldState);

      Alert.alert(
        "Power Error",
        error.message
      );

    } finally {

      setSavingPower(false);
    }
  };


  // ============================================================
  // KILL / UNKILL
  // ============================================================

  const toggleKill = async () => {

    if (!user) {

      Alert.alert(
        "Login Required",
        "Please login first."
      );

      return;
    }

    if (savingKill) return;


    const newKilledState =
      !isKilled;


    setSavingKill(true);


    try {

      const deviceRef =
        doc(
          db,
          "devices",
          user.uid
        );


      // ========================================================
      // UNKILL
      // ========================================================

      if (!newKilledState) {

        console.log(
          "UNKILL pressed."
        );

        await stopAlarm();


        if (activeAlertId) {

          try {

            await updateDoc(
              doc(
                db,
                "alerts",
                activeAlertId
              ),
              {
                status: "stopped",
                stoppedAt:
                  serverTimestamp(),
              }
            );

          } catch (error) {

            console.log(
              "Alert update error:",
              error
            );
          }
        }


        await setDoc(
          deviceRef,
          {
            isKilled: false,
            activeAlertId: null,
          },
          {
            merge: true,
          }
        );


        setIsKilled(false);
        setActiveAlertId(null);


        try {
          await Notifications.dismissAllNotificationsAsync();
        } catch {}


        console.log(
          "Device UNKILLED."
        );

        return;
      }


      // ========================================================
      // KILL
      // ========================================================

      await setDoc(
        deviceRef,
        {
          isKilled: true,
        },
        {
          merge: true,
        }
      );


      setIsKilled(true);


      // ========================================================
      // CREATE ALERT
      // ========================================================

      const alertMessage =
        deviceState
          ? "Device has been killed while ON."
          : "Device has been killed while OFF.";


      const alertRef =
        await addDoc(
          collection(
            db,
            "alerts"
          ),
          {
            uid: user.uid,

            deviceId: user.uid,

            type: "KILL",

            message:
              alertMessage,

            deviceStateAtKill:
              deviceState,

            status:
              deviceState
                ? "active"
                : "stopped",

            notificationSent:
              false,

            createdAt:
              serverTimestamp(),
          }
        );


      const alertId =
        alertRef.id;


      console.log(
        "Alert created:",
        alertId
      );


      // ========================================================
      // OFF + KILL
      // ========================================================

      if (!deviceState) {

        console.log(
          "DEVICE OFF → ONE-TIME NOTIFICATION"
        );


        await setDoc(
          deviceRef,
          {
            activeAlertId: null,
          },
          {
            merge: true,
          }
        );


        try {

          await Notifications.scheduleNotificationAsync(
            {
              content: {

                title:
                  "⚠️ Device Killed",

                body:
                  "The device was killed while it was OFF.",

                sound: "default",

                data: {
                  type:
                    "OFFLINE_KILL",

                  alertId:
                    alertId,
                },
              },

              trigger: null,
            }
          );

        } catch (error) {

          console.log(
            "OFF notification error:",
            error
          );
        }

        return;
      }


      // ========================================================
      // ON + KILL
      // ========================================================

      console.log(
        "DEVICE ON → ALERT + ALARM"
      );


      await setDoc(
        deviceRef,
        {
          activeAlertId:
            alertId,
        },
        {
          merge: true,
        }
      );


      setActiveAlertId(
        alertId
      );


      // CONTINUOUS ALARM

      await startAlarm();


      // PUSH / LOCAL NOTIFICATION

      try {

        await Notifications.scheduleNotificationAsync(
          {
            content: {

              title:
                "⚠️ Device Killed",

              body:
                "The device is ON and has been killed. Press STOP to stop the alarm.",

              sound: "default",

              categoryIdentifier:
                NOTIFICATION_CATEGORY,

              data: {
                type:
                  "KILL",

                alertId:
                  alertId,
              },
            },

            trigger: null,
          }
        );

      } catch (error) {

        console.log(
          "Notification error:",
          error
        );
      }


    } catch (error) {

      console.log(
        "KILL error:",
        error
      );


      await stopAlarm();


      try {

        await setDoc(
          doc(
            db,
            "devices",
            user.uid
          ),
          {
            isKilled: false,
            activeAlertId: null,
          },
          {
            merge: true,
          }
        );

      } catch {}


      setIsKilled(false);
      setActiveAlertId(null);


      Alert.alert(
        "Kill Error",
        error.message
      );

    } finally {

      setSavingKill(false);
    }
  };


  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {

    try {

      await stopAlarm();

      await signOut(auth);

      router.replace("/");

      console.log(
        "User logged out."
      );

    } catch (error) {

      console.log(
        "Logout error:",
        error
      );

      Alert.alert(
        "Logout Error",
        error.message
      );
    }
  };


  // ============================================================
  // USER NAME
  // ============================================================

  const getUserName = () => {

    if (!user) {

      return {
        firstName: "User",
        lastName: "",
      };
    }


    if (user.displayName) {

      const parts =
        user.displayName
          .trim()
          .split(/\s+/);


      return {
        firstName:
          parts[0] || "User",

        lastName:
          parts.slice(1).join(" "),
      };
    }


    if (user.email) {

      return {
        firstName:
          user.email.split("@")[0],

        lastName: "",
      };
    }


    return {
      firstName: "User",
      lastName: "",
    };
  };


  const {
    firstName,
    lastName,
  } = getUserName();


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (
      <SafeAreaView
        style={styles.loadingScreen}
      >

        <ActivityIndicator
          size="large"
          color="#3478F6"
        />

        <Text
          style={styles.loadingText}
        >
          Loading device...
        </Text>

      </SafeAreaView>
    );
  }


  // ============================================================
  // UI
  // ============================================================

  return (

    <SafeAreaView
      style={styles.container}
    >

      {/* HEADER */}

      <View
        style={styles.header}
      >

        <View>

          <Text
            style={styles.greeting}
          >
            Hi, {firstName}
            {lastName
              ? ` ${lastName}`
              : ""}
          </Text>

          <Text
            style={styles.welcome}
          >
            Welcome back
          </Text>

        </View>


        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >

          <Text
            style={styles.logoutIcon}
          >
            ↪
          </Text>

        </TouchableOpacity>

      </View>


      {/* DEVICE */}

      <View
        style={styles.deviceCard}
      >

        <View
          style={[
            styles.deviceScreen,
            deviceState
              ? styles.deviceScreenOn
              : styles.deviceScreenOff,
          ]}
        >

          {deviceState ? (

            <>
              <Text
                style={styles.activeText}
              >
                DEVICE ACTIVE
              </Text>

              <Text
                style={styles.onlineText}
              >
                device online
              </Text>
            </>

          ) : (

            <Text
              style={styles.offText}
            >
              DEVICE OFF
            </Text>

          )}

        </View>


        <View
          style={styles.statusContainer}
        >

          <View
            style={[
              styles.statusDot,
              deviceState
                ? styles.statusOn
                : styles.statusOff,
            ]}
          />

          <Text
            style={styles.statusText}
          >
            Status:{" "}
            {deviceState
              ? "ON"
              : "OFF"}
          </Text>

        </View>

      </View>


      {/* BUTTONS */}

      <View
        style={styles.buttonsContainer}
      >

        <TouchableOpacity
          style={[
            styles.actionButton,
            deviceState
              ? styles.powerOn
              : styles.powerOff,
          ]}
          onPress={togglePower}
          disabled={savingPower}
        >

          {savingPower ? (

            <ActivityIndicator
              color="#FFFFFF"
            />

          ) : (

            <Text
              style={styles.actionText}
            >
              ON/OFF
            </Text>

          )}

        </TouchableOpacity>


        <TouchableOpacity
          style={[
            styles.actionButton,
            isKilled
              ? styles.unkillButton
              : styles.killButton,
          ]}
          onPress={toggleKill}
          disabled={savingKill}
        >

          {savingKill ? (

            <ActivityIndicator
              color="#FFFFFF"
            />

          ) : (

            <Text
              style={styles.actionText}
            >
              {isKilled
                ? "UNKILL"
                : "KILL"}
            </Text>

          )}

        </TouchableOpacity>

      </View>


      <Text
        style={styles.instruction}
      >
        Tap power to switch device,
        tap kill to lock it down
      </Text>


      {/* BOTTOM NAV */}

      <View
        style={styles.bottomNavigation}
      >

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.replace("/home")
          }
        >
          <View
            style={styles.navCircleActive}
          >
            <View
              style={styles.navCircleInside}
            />
          </View>

          <Text
            style={styles.navActiveText}
          >
            Home
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push("/schedule")
          }
        >
          <View
            style={styles.navCircle}
          >
            <View
              style={
                styles.navCircleInsideGray
              }
            />
          </View>

          <Text
            style={styles.navText}
          >
            Schedule
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push("/alert")
          }
        >
          <View
            style={styles.navCircle}
          >
            <View
              style={
                styles.navCircleInsideGray
              }
            />
          </View>

          <Text
            style={styles.navText}
          >
            Alerts
          </Text>
        </TouchableOpacity>


        <TouchableOpacity
          style={styles.navItem}
        >
          <View
            style={styles.navCircle}
          >
            <View
              style={
                styles.navCircleInsideGray
              }
            />
          </View>

          <Text
            style={styles.navText}
          >
            Logs
          </Text>
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#777777",
    fontSize: 14,
  },

  header: {
    height: 66,
    backgroundColor: "#3478F6",
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  greeting: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  welcome: {
    color: "#DCE8FF",
    fontSize: 12,
    marginTop: 3,
  },

  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#164087",
    justifyContent: "center",
    alignItems: "center",
  },

  logoutIcon: {
    color: "#FFFFFF",
    fontSize: 25,
  },

  deviceCard: {
    marginHorizontal: 25,
    marginTop: 18,
    backgroundColor: "#101827",
    borderRadius: 15,
    padding: 18,
    minHeight: 255,
  },

  deviceScreen: {
    height: 172,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },

  deviceScreenOn: {
    backgroundColor: "#108278",
  },

  deviceScreenOff: {
    backgroundColor: "#050B13",
  },

  activeText: {
    color: "#54DFA5",
    fontSize: 16,
    fontWeight: "700",
  },

  onlineText: {
    color: "#B7C9C5",
    fontSize: 10,
    marginTop: 6,
  },

  offText: {
    color: "#6E0909",
    fontSize: 15,
    fontWeight: "700",
  },

  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 9,
  },

  statusOn: {
    backgroundColor: "#20C968",
  },

  statusOff: {
    backgroundColor: "#C21111",
  },

  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
  },

  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 35,
    marginTop: 23,
  },

  actionButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },

  powerOn: {
    backgroundColor: "#20C968",
  },

  powerOff: {
    backgroundColor: "#B41616",
  },

  killButton: {
    backgroundColor: "#EF4444",
  },

  unkillButton: {
    backgroundColor: "#20C968",
  },

  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  instruction: {
    textAlign: "center",
    color: "#999999",
    fontSize: 11,
    marginTop: 18,
    paddingHorizontal: 20,
  },

  bottomNavigation: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },

  navCircleActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#3478F6",
    justifyContent: "center",
    alignItems: "center",
  },

  navCircleInside: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3478F6",
  },

  navCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#B5B8BD",
    justifyContent: "center",
    alignItems: "center",
  },

  navCircleInsideGray: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#B5B8BD",
  },

  navActiveText: {
    color: "#3478F6",
    fontSize: 10,
    marginTop: 3,
  },

  navText: {
    color: "#AAAAAA",
    fontSize: 10,
    marginTop: 3,
  },

});