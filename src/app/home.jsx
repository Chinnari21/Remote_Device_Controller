import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  NativeModules,
  PermissionsAndroid,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  doc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import messaging from "@react-native-firebase/messaging";

import {
  setupAlarmNotificationHandler,
  startAlarm,
  stopAlarm,
  syncAlarmState,
} from "../services/alarmServices";

import {
  auth,
  db,
} from "../../firebaseConfig";


// ============================================================
// NATIVE DEVICE STATE MODULE
// ============================================================

const {
  DeviceStateModule,
} = NativeModules;


// ============================================================
// FCM REGISTRATION
// ============================================================

async function registerForFCM() {
  try {
    if (Platform.OS === "web") {
      return null;
    }

    const permission =
      await messaging().requestPermission();

    const enabled =
      permission ===
        messaging.AuthorizationStatus.AUTHORIZED ||
      permission ===
        messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log(
        "FCM permission denied."
      );

      return null;
    }

    const token =
      await messaging().getToken();

    console.log(
      "FCM TOKEN:",
      token
    );

    return token;

  } catch (error) {
    console.log(
      "FCM registration error:",
      error
    );

    return null;
  }
}


// ============================================================
 // SCHEDULED NOTIFICATION PERMISSION
 // ============================================================

 async function requestScheduledNotificationPermission() {
   if (Platform.OS !== "android") {
     return;
   }

   if (Platform.Version < 33) {
     return;
   }

   try {
     const result =
       await PermissionsAndroid.request(
         PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
         {
           title: "Notification Permission",
           message:
             "Allow notifications so you can be notified when a scheduled device ON/OFF action is completed.",
           buttonPositive: "Allow",
           buttonNegative: "Deny",
         }
       );

     console.log(
       "Scheduled notification permission:",
       result
     );
   } catch (error) {
     console.log(
       "Scheduled notification permission error:",
       error
     );
   }
 }


// ============================================================
// SYNC PENDING SCHEDULE LOGS
// ============================================================

// ScheduleAlarmReceiver can run while the React Native/Firebase
// JS context is unavailable. It stores scheduled ON/OFF events
// locally, and Home uploads them to Firestore when available.
async function syncPendingScheduleLogsForUser(user) {
  try {
    if (!user || !DeviceStateModule) {
      return;
    }

    if (!DeviceStateModule.getPendingScheduleLogs) {
      console.log(
        "getPendingScheduleLogs is not available."
      );
      return;
    }

    const pendingLogs =
      await DeviceStateModule.getPendingScheduleLogs();

    if (!pendingLogs || pendingLogs.length === 0) {
      return;
    }

    console.log(
      "PENDING SCHEDULE LOGS:",
      pendingLogs
    );

    for (const log of pendingLogs) {
      if (log.uid !== user.uid) {
        continue;
      }

      try {
        await addDoc(
          collection(db, "logs"),
          {
            uid: user.uid,
            state: log.state === "ON" ? "ON" : "OFF",
            mode: "Schedule",
            timestamp: new Date(Number(log.timestamp)),
          }
        );

        await DeviceStateModule.removePendingScheduleLog(
          log.logKey
        );

        console.log(
          "SCHEDULE LOG SYNCED:",
          log.state,
          log.scheduleId
        );
      } catch (error) {
        // Keep the pending log locally if Firestore fails.
        console.log(
          "Failed to sync schedule log:",
          error
        );
      }
    }
  } catch (error) {
    console.log(
      "Schedule log sync error:",
      error
    );
  }
}


// ============================================================
// HOME SCREEN
// ============================================================

export default function Home() {

  const router =
    useRouter();


  // ==========================================================
  // STATE
  // ==========================================================

  const [user, setUser] =
    useState(null);

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


  // ==========================================================
  // LOCAL DEVICE STATE HELPERS
  // ==========================================================

  const loadLocalDeviceState =
    useCallback(
      async () => {

        try {

          if (!DeviceStateModule) {

            console.log(
              "DeviceStateModule not available."
            );

            return null;
          }

          const localState =
            await DeviceStateModule.getDeviceState();

          console.log(
            "LOCAL DEVICE STATE:",
            localState
          );

          if (localState === null) {
            return null;
          }

          return localState === true;

        } catch (error) {

          console.log(
            "Local device state error:",
            error
          );

          return null;
        }
      },
      []
    );


  const saveLocalDeviceState =
    useCallback(
      async (state) => {

        try {

          if (!DeviceStateModule) {

            console.log(
              "DeviceStateModule not available."
            );

            return;
          }

          await DeviceStateModule.setDeviceState(
            state
          );

          console.log(
            "LOCAL DEVICE STATE SAVED:",
            state
          );

        } catch (error) {

          console.log(
            "Local device state save error:",
            error
          );
        }
      },
      []
    );


  // ==========================================================
  // AUTH LISTENER
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          console.log(
            "Current user:",
            currentUser?.uid
          );

          setUser(
            currentUser
          );

          if (!currentUser) {

            setLoading(false);

            router.replace("/");
          }
        }
      );

    return unsubscribe;

  }, [router]);


  // ==========================================================
  // NOTIFICATION SETUP
  // ==========================================================

  useEffect(() => {

    const setupNotifications =
      async () => {

        try {

          await requestScheduledNotificationPermission();

          setupAlarmNotificationHandler();

        } catch (error) {

          console.log(
            "Notification setup error:",
            error
          );
        }
      };

    setupNotifications();

  }, []);


  // ==========================================================
  // LOCAL SCHEDULED STATE INITIAL SYNC
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    const loadState =
      async () => {

        try {

          const localState =
            await loadLocalDeviceState();

          if (localState !== null) {

            console.log(
              "Applying local scheduled state:",
              localState
            );

            setDeviceState(
              localState
            );
          }

        } catch (error) {

          console.log(
            "Local scheduled state sync error:",
            error
          );
        }
      };

    loadState();

  }, [
    user,
    loadLocalDeviceState,
  ]);


  // ==========================================================
  // REFRESH LOCAL SCHEDULED STATE
  // ==========================================================
  //
  // ScheduleAlarmReceiver changes SharedPreferences in native
  // Android even when the React Native screen is already open.
  //
  // Check every 2 seconds so Home immediately reflects the
  // scheduled ON/OFF state.
  //
  // IMPORTANT:
  // This does NOT start AlarmService.
  // This does NOT play alarm sound.
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    let active = true;
    let syncingScheduleLogs = false;

    const refreshLocalState =
      async () => {

        try {

          if (!syncingScheduleLogs) {
            syncingScheduleLogs = true;

            try {
              await syncPendingScheduleLogsForUser(user);
            } finally {
              syncingScheduleLogs = false;
            }
          }

          const localState =
            await loadLocalDeviceState();

          console.log(
            "HOME → LOCAL DEVICE STATE:",
            localState
          );

          if (
            active &&
            localState !== null
          ) {

            setDeviceState(
              localState
            );
          }

        } catch (error) {

          console.log(
            "Home local state refresh error:",
            error
          );
        }
      };


    // Refresh immediately
    refreshLocalState();


    // Continue checking while Home is mounted
    const interval =
      setInterval(
        () => {
          refreshLocalState();
        },
        2000
      );


    return () => {

      active = false;

      clearInterval(
        interval
      );
    };

  }, [
    user,
    loadLocalDeviceState,
  ]);


  // ==========================================================
  // DEVICE LISTENER
  // ==========================================================
  //
  // Firestore listener updates:
  //   - isKilled
  //   - activeAlertId
  //
  // Device power state:
  //   - local scheduled state is checked first
  //   - Firestore is used when there is no local state
  //
  // NO startAlarm()
  // NO stopAlarm()
  //
  // syncAlarmState() handles the KILL alarm.
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    console.log(
      "Starting device listener:",
      user.uid
    );

    const deviceRef =
      doc(
        db,
        "devices",
        user.uid
      );

    const unsubscribe =
      onSnapshot(
        deviceRef,

        async (snapshot) => {

          try {

            // ==================================================
            // DEVICE DOCUMENT DOES NOT EXIST
            // ==================================================

            if (!snapshot.exists()) {

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

              setLoading(false);

              return;
            }


            // ==================================================
            // GET DEVICE DATA
            // ==================================================

            const data =
              snapshot.data();

            console.log(
              "Device data:",
              data
            );


            // ==================================================
            // FIRESTORE STATE
            // ==================================================

            const firestoreState =
              data.state === true;


            // ==================================================
            // LOCAL STATE
            // ==================================================

            const localState =
              await loadLocalDeviceState();

            let finalDeviceState;


            if (localState !== null) {

              finalDeviceState =
                localState;

              console.log(
                "Using LOCAL scheduled state:",
                finalDeviceState
              );

            } else {

              finalDeviceState =
                firestoreState;

              console.log(
                "Using FIRESTORE state:",
                finalDeviceState
              );
            }


            // ==================================================
            // KILL STATE
            // ==================================================

            const killed =
              data.isKilled === true;


            // ==================================================
            // ACTIVE ALERT
            // ==================================================

            const alertId =
              data.activeAlertId || null;


            // ==================================================
            // UPDATE UI ONLY
            // ==================================================

            setDeviceState(
              finalDeviceState
            );

            setIsKilled(
              killed
            );

            setActiveAlertId(
              alertId
            );


            /*
             * IMPORTANT:
             *
             * NO startAlarm() HERE
             * NO stopAlarm() HERE
             *
             * syncAlarmState() handles the KILL alarm.
             */

            setLoading(false);

          } catch (error) {

            console.log(
              "Device listener processing error:",
              error
            );

            setLoading(false);
          }
        },


        (error) => {

          console.log(
            "Device listener error:",
            error
          );

          setLoading(false);
        }
      );


    return unsubscribe;

  }, [
    user,
    loadLocalDeviceState,
  ]);


  // ==========================================================
  // ALARM STATE SYNC
  // ==========================================================
  //
  // This is ONLY for KILL alarm.
  //
  // Scheduled ON/OFF does NOT start an alarm.
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    const runAlarmSync =
      async () => {

        try {

          console.log(
            "Running alarm state sync..."
          );

          await syncAlarmState(
            user.uid
          );

        } catch (error) {

          console.log(
            "Alarm sync error:",
            error
          );
        }
      };

    runAlarmSync();

  }, [user]);


  // ==========================================================
  // FCM TOKEN
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    const setupFCM =
      async () => {

        try {

          const token =
            await registerForFCM();


          if (!token) {

            console.log(
              "FCM token was not generated."
            );

            return;
          }


          await setDoc(
            doc(
              db,
              "devices",
              user.uid
            ),
            {
              fcmToken:
                token,
            },
            {
              merge: true,
            }
          );


          console.log(
            "FCM token saved."
          );

        } catch (error) {

          console.log(
            "FCM setup error:",
            error
          );
        }
      };

    setupFCM();

  }, [user]);


  // ==========================================================
  // USER NAME
  // ==========================================================

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
          parts
            .slice(1)
            .join(" "),
      };
    }


    if (user.email) {

      return {
        firstName:
          user.email
            .split("@")[0],

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


  // ==========================================================
  // POWER ON / OFF
  // ==========================================================

  const togglePower =
    async () => {

      if (!user) {

        Alert.alert(
          "Login Required",
          "Please login first."
        );

        return;
      }


      if (savingPower) {
        return;
      }


      const oldState =
        deviceState;


      const newState =
        !oldState;


      // ========================================================
      // UPDATE UI IMMEDIATELY
      // ========================================================

      setDeviceState(
        newState
      );


      try {

        setSavingPower(true);


        // ======================================================
        // SAVE LOCAL STATE
        // ======================================================

        await saveLocalDeviceState(
          newState
        );


        // ======================================================
        // SAVE FIRESTORE STATE
        // ======================================================

        const deviceRef =
          doc(
            db,
            "devices",
            user.uid
          );


        await setDoc(
          deviceRef,
          {
            state:
              newState,

            lastUpdatedAt:
              serverTimestamp(),

            lastUpdatedBy:
              "manual",
          },
          {
            merge: true,
          }
        );


        // ======================================================
        // SAVE LOG
        // ======================================================

        await addDoc(
          collection(
            db,
            "logs"
          ),
          {
            uid:
              user.uid,

            state:
              newState
                ? "ON"
                : "OFF",

            mode:
              "Manual",

            timestamp:
              serverTimestamp(),
          }
        );


        console.log(
          "Power saved:",
          newState
        );


      } catch (error) {

        console.log(
          "Power save error:",
          error
        );


        setDeviceState(
          oldState
        );


        await saveLocalDeviceState(
          oldState
        );


        Alert.alert(
          "Power Error",
          error.message
        );


      } finally {

        setSavingPower(false);
      }
    };


  // ==========================================================
  // KILL / UNKILL
  // ==========================================================

  const toggleKill =
    async () => {

      if (!user) {

        Alert.alert(
          "Login Required",
          "Please login first."
        );

        return;
      }


      if (savingKill) {
        return;
      }


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


        // ======================================================
        // UNKILL
        // ======================================================

        if (!newKilledState) {

          console.log(
            "UNKILL pressed."
          );


          // ----------------------------------------------------
          // STOP NATIVE ALARM
          // ----------------------------------------------------

          await stopAlarm();


          // ----------------------------------------------------
          // STOP ACTIVE ALERT
          // ----------------------------------------------------

          if (activeAlertId) {

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


          // ----------------------------------------------------
          // CLEAR FIRESTORE KILL STATE
          // ----------------------------------------------------

          await setDoc(
            deviceRef,
            {
              isKilled:
                false,

              activeAlertId:
                null,
            },
            {
              merge: true,
            }
          );


          // ----------------------------------------------------
          // UPDATE UI
          // ----------------------------------------------------

          setIsKilled(false);

          setActiveAlertId(null);


          console.log(
            "Device UNKILLED."
          );


          return;
        }


        // ======================================================
        // KILL
        // ======================================================

        console.log(
          "KILL pressed."
        );


        // ------------------------------------------------------
        // SET KILLED FIRST
        // ------------------------------------------------------

        await setDoc(
          deviceRef,
          {
            isKilled:
              true,
          },
          {
            merge: true,
          }
        );


        setIsKilled(true);


        // ------------------------------------------------------
        // DEVICE OFF
        // ------------------------------------------------------

        if (!deviceState) {

          console.log(
            "DEVICE OFF → KILL WITHOUT ALARM"
          );


          return;
        }


        // ------------------------------------------------------
        // CREATE ALERT
        // ------------------------------------------------------

        const alertRef =
          await addDoc(
            collection(
              db,
              "alerts"
            ),
            {
              uid:
                user.uid,

              deviceId:
                user.uid,

              type:
                "KILL",

              message:
                "Device has been killed while ON.",

              deviceStateAtKill:
                true,

              status:
                "active",

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


        // ------------------------------------------------------
        // SAVE ACTIVE ALERT
        // ------------------------------------------------------

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


        // ------------------------------------------------------
        // START ALARM
        // ------------------------------------------------------

        await startAlarm();


        console.log(
          "ALARM STARTED"
        );


      } catch (error) {

        console.log(
          "KILL ERROR:",
          error
        );


        // ------------------------------------------------------
        // STOP ALARM ON ERROR
        // ------------------------------------------------------

        await stopAlarm();


        try {

          await setDoc(
            doc(
              db,
              "devices",
              user.uid
            ),
            {
              isKilled:
                false,

              activeAlertId:
                null,
            },
            {
              merge: true,
            }
          );


        } catch (revertError) {

          console.log(
            "Revert error:",
            revertError
          );
        }


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


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {

      try {

        await stopAlarm();


        await signOut(
          auth
        );


        router.replace("/");


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


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
      >

        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
          translucent={false}
        />


        <View
          style={styles.loading}
        >

          <ActivityIndicator
            size="large"
            color="#3478F6"
          />

        </View>

      </SafeAreaView>
    );
  }


  // ==========================================================
  // HOME UI
  // ==========================================================

  return (

    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />


      {/* ==================================================== */}
      {/* TOP BLUE NAVBAR */}
      {/* ==================================================== */}

      <View
        style={styles.header}
      >

        <View
          style={styles.headerTextContainer}
        >

          <Text
            style={styles.headerTitle}
            numberOfLines={0}
          >

            Hi, {firstName}
            {lastName
              ? ` ${lastName}`
              : ""}

          </Text>


          <Text
            style={styles.headerSubtitle}
          >
            Welcome back
          </Text>

        </View>


        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >

          <Text
            style={styles.logoutText}
          >
            ↪
          </Text>

        </TouchableOpacity>

      </View>


      {/* ==================================================== */}
      {/* BODY */}
      {/* ==================================================== */}

      <View
        style={styles.content}
      >


        {/* ================================================== */}
        {/* DEVICE CARD */}
        {/* ================================================== */}

        <View
          style={styles.deviceCard}
        >

          <View
            style={[
              styles.activePanel,

              deviceState
                ? styles.activePanelOn
                : styles.activePanelOff,
            ]}
          >

            <Text
              style={styles.activeTitle}
            >

              {deviceState
                ? "DEVICE ACTIVE"
                : "DEVICE INACTIVE"}

            </Text>


            <Text
              style={styles.activeSubtitle}
            >

              {deviceState
                ? "device online"
                : "device offline"}

            </Text>

          </View>


          {/* ================================================== */}
          {/* STATUS */}
          {/* ================================================== */}

          <View
            style={styles.statusRow}
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


        {/* ================================================== */}
        {/* ON/OFF + KILL BUTTONS */}
        {/* ================================================== */}

        <View
          style={styles.buttonsRow}
        >


          {/* ================================================== */}
          {/* ON/OFF */}
          {/* ================================================== */}

          <TouchableOpacity
            style={[
              styles.roundButton,
              styles.powerButton,
            ]}
            onPress={togglePower}
            disabled={savingPower}
            activeOpacity={0.8}
          >

            {savingPower ? (

              <ActivityIndicator
                color="#FFFFFF"
              />

            ) : (

              <Text
                style={styles.roundButtonText}
              >
                ON/OFF
              </Text>

            )}

          </TouchableOpacity>


          {/* ================================================== */}
          {/* KILL / UNKILL */}
          {/* ================================================== */}

          <TouchableOpacity
            style={[
              styles.roundButton,

              isKilled
                ? styles.unkillButton
                : styles.killButton,
            ]}
            onPress={toggleKill}
            disabled={savingKill}
            activeOpacity={0.8}
          >

            {savingKill ? (

              <ActivityIndicator
                color="#FFFFFF"
              />

            ) : (

              <Text
                style={styles.roundButtonText}
              >

                {isKilled
                  ? "UNKILL"
                  : "KILL"}

              </Text>

            )}

          </TouchableOpacity>

        </View>


        {/* ================================================== */}
        {/* INSTRUCTION */}
        {/* ================================================== */}

        <Text
          style={styles.instruction}
        >

          Tap power to switch device,{"\n"}
          tap kill to lock it down

        </Text>

      </View>

    </SafeAreaView>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    // ========================================================
    // SAFE AREA
    // ========================================================

    safeArea: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },


    // ========================================================
    // LOADING
    // ========================================================

    loading: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
    },


    // ========================================================
    // HEADER
    // ========================================================

    header: {
      height: 125,

      backgroundColor: "#3478F6",

      paddingHorizontal: 10,

      paddingTop: 7,

      paddingBottom: 1,

      flexDirection: "row",

      alignItems: "center",

      justifyContent: "space-between",
    },


    headerTextContainer: {
      flex: 1,

      paddingRight: 8,
    },


    headerTitle: {
      color: "#FFFFFF",

      fontSize: 27,

      fontWeight: "800",

      lineHeight: 33,
    },


    headerSubtitle: {
      color: "#E7EEFF",

      fontSize: 16,

      marginTop: 2,
    },


    // ========================================================
    // LOGOUT
    // ========================================================

    logoutButton: {
      width: 56,

      height: 56,

      borderRadius: 28,

      backgroundColor: "#1559BA",

      justifyContent: "center",

      alignItems: "center",

      marginLeft: 8,
    },


    logoutText: {
      color: "#FFFFFF",

      fontSize: 29,

      fontWeight: "700",
    },


    // ========================================================
    // BODY
    // ========================================================

    content: {
      flex: 1,

      backgroundColor: "#FFFFFF",

      alignItems: "center",

      paddingTop: 28,
    },


    // ========================================================
    // DEVICE CARD
    // ========================================================

    deviceCard: {
      width: "84%",

      backgroundColor: "#111827",

      borderRadius: 20,

      paddingHorizontal: 17,

      paddingTop: 17,

      paddingBottom: 16,

      elevation: 5,

      shadowColor: "#000",

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.18,

      shadowRadius: 6,
    },


    // ========================================================
    // DEVICE PANEL
    // ========================================================

    activePanel: {
      width: "100%",

      height: 175,

      borderRadius: 14,

      justifyContent: "center",

      alignItems: "center",
    },


    activePanelOn: {
      backgroundColor: "#148F87",
    },


    activePanelOff: {
      backgroundColor: "#6B7280",
    },


    activeTitle: {
      color: "#58E69A",

      fontSize: 21,

      fontWeight: "800",

      textAlign: "center",
    },


    activeSubtitle: {
      color: "#E5FFF4",

      fontSize: 14,

      marginTop: 6,
    },


    // ========================================================
    // STATUS
    // ========================================================

    statusRow: {
      flexDirection: "row",

      alignItems: "center",

      justifyContent: "center",

      marginTop: 14,
    },


    statusDot: {
      width: 20,

      height: 20,

      borderRadius: 10,

      marginRight: 8,
    },


    statusOn: {
      backgroundColor: "#20C76A",
    },


    statusOff: {
      backgroundColor: "#9CA3AF",
    },


    statusText: {
      color: "#FFFFFF",

      fontSize: 17,

      fontWeight: "600",
    },


    // ========================================================
    // BUTTONS
    // ========================================================

    buttonsRow: {
      width: "100%",

      flexDirection: "row",

      justifyContent: "center",

      alignItems: "center",

      gap: 35,

      marginTop: 30,
    },


    roundButton: {
      width: 105,

      height: 105,

      borderRadius: 53,

      justifyContent: "center",

      alignItems: "center",

      elevation: 5,

      shadowColor: "#000",

      shadowOffset: {
        width: 0,

        height: 3,
      },

      shadowOpacity: 0.20,

      shadowRadius: 5,
    },


    powerButton: {
      backgroundColor: "#20C76A",
    },


    killButton: {
      backgroundColor: "#F0444A",
    },


    unkillButton: {
      backgroundColor: "#20C76A",
    },


    roundButtonText: {
      color: "#FFFFFF",

      fontSize: 15,

      fontWeight: "800",

      textAlign: "center",

      lineHeight: 19,

      paddingHorizontal: 4,
    },


    // ========================================================
    // INSTRUCTION
    // ========================================================

    instruction: {
      textAlign: "center",

      color: "#9CA3AF",

      fontSize: 14,

      lineHeight: 21,

      marginTop: 22,
    },

  });