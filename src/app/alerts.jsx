import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import * as Notifications from "expo-notifications";

import {
  setupAlarmNotificationHandler,
  startAlarm,
  stopAlarm,
}  from "../services/alarmServices";

import { auth, db } from "../../firebaseConfig";


// ============================================================
// ALERTS
// ============================================================

export default function Alerts() {

  const [user, setUser] =
    useState(null);

  const [alerts, setAlerts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [stoppingId, setStoppingId] =
    useState(null);


  // ==========================================================
  // AUTH
  // ==========================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          setUser(
            currentUser
          );


          if (!currentUser) {

            router.replace("/");
          }
        }
      );


    return unsubscribe;

  }, []);


  // ==========================================================
  // NOTIFICATION SETUP
  // ==========================================================

  useEffect(() => {

    setupAlarmNotificationHandler();

  }, []);


  // ==========================================================
  // ALERT LISTENER
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }


    console.log(
      "Starting Alerts listener:",
      user.uid
    );


    const alertsRef =
      collection(
        db,
        "alerts"
      );


    const alertsQuery =
      query(

        alertsRef,

        where(
          "uid",
          "==",
          user.uid
        )
      );


    const unsubscribe =
      onSnapshot(

        alertsQuery,

        async (snapshot) => {

          const list =
            snapshot.docs

              .map(
                (item) => ({
                  id:
                    item.id,

                  ...item.data(),
                })
              )

              .sort(
                (a, b) => {

                  const aTime =
                    a.createdAt?.toMillis
                      ? a.createdAt.toMillis()
                      : 0;


                  const bTime =
                    b.createdAt?.toMillis
                      ? b.createdAt.toMillis()
                      : 0;


                  return (
                    bTime -
                    aTime
                  );
                }
              );


          console.log(
            "Alerts received:",
            list.length
          );


          setAlerts(
            list
          );


          setLoading(
            false
          );


          /*
           * IMPORTANT:
           *
           * Opening Alerts does NOT stop
           * the alarm.
           *
           * If there is an active alert,
           * make sure global alarm is running.
           */

          const activeAlert =
            list.find(
              (item) =>
                item.status ===
                  "active" &&
                item.deviceStateAtKill ===
                  true
            );


          if (activeAlert) {

            console.log(
              "Active alert found → alarm continues."
            );


            await startAlarm();

          }

        },


        (error) => {

          console.log(
            "Alerts listener error:",
            error
          );


          setLoading(
            false
          );
        }
      );


    return unsubscribe;

  }, [user]);


  // ==========================================================
  // STOP ALARM
  // ==========================================================

  const stopAlertAlarm =
    async (alertItem) => {

      if (
        !user ||
        stoppingId
      ) {
        return;
      }


      try {

        setStoppingId(
          alertItem.id
        );


        console.log(
          "STOP ALARM pressed:",
          alertItem.id
        );


        // ======================================================
        // 1. STOP ACTUAL SOUND
        // ======================================================

        await stopAlarm();


        // ======================================================
        // 2. MARK ALERT STOPPED
        // ======================================================

        await updateDoc(

          doc(
            db,
            "alerts",
            alertItem.id
          ),

          {
            status:
              "stopped",

            stoppedAt:
              serverTimestamp(),
          }
        );


        // ======================================================
        // 3. RESET DEVICE
        // ======================================================

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


        // ======================================================
        // 4. REMOVE NOTIFICATION
        // ======================================================

        try {

          if (
            Platform.OS !==
            "web"
          ) {

            await Notifications
              .dismissAllNotificationsAsync();
          }

        } catch (error) {

          console.log(
            "Notification dismiss error:",
            error
          );
        }


        console.log(
          "Alarm stopped successfully."
        );


      } catch (error) {

        console.log(
          "Stop Alarm error:",
          error
        );


        Alert.alert(
          "Stop Alarm Error",
          error.message
        );


      } finally {

        setStoppingId(
          null
        );
      }
    };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {

      try {

        // Logout is an intentional
        // alarm-stop action.

        await stopAlarm();


        if (user) {

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
        }


        if (
          Platform.OS !==
          "web"
        ) {

          try {

            await Notifications
              .dismissAllNotificationsAsync();

          } catch {}
        }


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
  // FORMAT TIME
  // ==========================================================

  const formatTime =
    (timestamp) => {

      if (!timestamp) {
        return "";
      }


      try {

        const date =
          timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);


        return date.toLocaleString(
          [],
          {
            month:
              "short",

            day:
              "numeric",

            hour:
              "numeric",

            minute:
              "2-digit",
          }
        );


      } catch {

        return "";
      }
    };


  // ==========================================================
  // TITLE
  // ==========================================================

  const getTitle =
    (item) => {

      if (
        item.deviceStateAtKill ===
        true
      ) {

        return (
          "KILL triggered - Device ON"
        );
      }


      return (
        "KILL triggered - Device OFF"
      );
    };


  // ==========================================================
  // ALERT CARD
  // ==========================================================

  const renderAlert =
    ({ item }) => {

      const deviceWasOn =
        item.deviceStateAtKill ===
        true;


      const isActive =
        item.status ===
        "active";


      return (

        <View
          style={[
            styles.alertCard,

            deviceWasOn &&
              isActive &&
              styles.activeCard,
          ]}
        >

          {/* ICON */}

          <View
            style={styles.alertIcon}
          >

            <Text
              style={
                styles.alertIconText
              }
            >
              !
            </Text>

          </View>


          {/* CONTENT */}

          <View
            style={styles.cardContent}
          >

            <Text
              style={styles.alertTitle}
            >
              {getTitle(item)}
            </Text>


            <Text
              style={styles.alertTime}
            >
              {formatTime(
                item.createdAt
              )}
            </Text>


            {/* ACTIVE ALARM */}

            {deviceWasOn &&
            isActive ? (

              <View
                style={
                  styles.activeAlarmRow
                }
              >

                <TouchableOpacity
                  style={
                    styles.stopButton
                  }
                  onPress={() =>
                    stopAlertAlarm(
                      item
                    )
                  }
                  disabled={
                    stoppingId ===
                    item.id
                  }
                  activeOpacity={0.8}
                >

                  {stoppingId ===
                  item.id ? (

                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />

                  ) : (

                    <Text
                      style={
                        styles.stopButtonText
                      }
                    >
                      Stop Alarm
                    </Text>

                  )}

                </TouchableOpacity>


                <Text
                  style={
                    styles.ringingText
                  }
                >
                  alarm ringing...
                </Text>

              </View>

            ) : (

              <Text
                style={
                  styles.offMessage
                }
              >
                {item.status ===
                "stopped"
                  ? "Alarm stopped."
                  : item.message ||
                    "The device was OFF when Kill was pressed."}
              </Text>

            )}

          </View>

        </View>
      );
    };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (

      <>
        <StatusBar
          backgroundColor="#FFFFFF"
          barStyle="dark-content"
          translucent={false}
        />


        <SafeAreaView
          style={styles.loading}
          edges={[
            "top",
            "bottom",
          ]}
        >

          <ActivityIndicator
            size="large"
            color="#3478F6"
          />


          <Text
            style={styles.loadingText}
          >
            Loading alerts...
          </Text>

        </SafeAreaView>

      </>

    );
  }


  // ==========================================================
  // SCREEN
  // ==========================================================

  return (

    <>
      <StatusBar
        backgroundColor="#3478F6"
        barStyle="light-content"
        translucent={false}
      />


      <SafeAreaView
        style={styles.container}
        edges={[
          "top",
          "bottom",
        ]}
      >

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <View
          style={styles.header}
        >

          <View>

            <Text
              style={styles.headerTitle}
            >
              Alerts
            </Text>


            <Text
              style={styles.headerSubtitle}
            >
              Kill-switch notifications
            </Text>

          </View>


          <TouchableOpacity
            style={styles.headerCircle}
            onPress={
              handleLogout
            }
            activeOpacity={0.8}
          >

           

          </TouchableOpacity>

        </View>


        {/* ================================================== */}
        {/* LIST */}
        {/* ================================================== */}

        {alerts.length === 0 ? (

          <View
            style={styles.empty}
          >

            <View
              style={styles.emptyIcon}
            >

              <Text
                style={
                  styles.emptyIconText
                }
              >
                !
              </Text>

            </View>


            <Text
              style={styles.emptyTitle}
            >
              No alerts
            </Text>


            <Text
              style={styles.emptyText}
            >
              Kill-switch notifications
              {"\n"}
              will appear here.
            </Text>

          </View>

        ) : (

          <FlatList
            data={alerts}
            keyExtractor={(item) =>
              item.id
            }
            renderItem={
              renderAlert
            }
            contentContainerStyle={
              styles.list
            }
            showsVerticalScrollIndicator={
              false
            }
          />

        )}

      </SafeAreaView>
    </>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,

    backgroundColor:
      "#F5F7FB",
  },


  loading: {
    flex: 1,

    justifyContent:
      "center",

    alignItems:
      "center",

    backgroundColor:
      "#FFFFFF",
  },


  loadingText: {
    marginTop:
      10,

    color:
      "#777777",

    fontSize:
      14,
  },


  // ==========================================================
  // HEADER
  // ==========================================================

  header: {
    backgroundColor:
      "#3478F6",

    paddingHorizontal:
      28,

    paddingTop:
      20,

    paddingBottom:
      25,

    minHeight:
      110,

    flexDirection:
      "row",

    alignItems:
      "center",

    justifyContent:
      "space-between",
  },


  headerTitle: {
    color:
      "#FFFFFF",

    fontSize:
      30,

    fontWeight:
      "800",
  },


  headerSubtitle: {
    color:
      "#DCE8FF",

    fontSize:
      15,

    marginTop:
      5,
  },


  headerCircle: {
    width:
      50,

    height:
      50,

    borderRadius:
      25,

    backgroundColor:
      "#1556B8",

    justifyContent:
      "center",

    alignItems:
      "center",
  },


  logoutIcon: {
    color:
      "#FFFFFF",

    fontSize:
      29,

    fontWeight:
      "700",
  },


  // ==========================================================
  // LIST
  // ==========================================================

  list: {
    paddingHorizontal:
      22,

    paddingTop:
      20,

    paddingBottom:
      30,
  },


  // ==========================================================
  // CARD
  // ==========================================================

  alertCard: {
    backgroundColor:
      "#FFFFFF",

    borderRadius:
      18,

    padding:
      16,

    marginBottom:
      15,

    flexDirection:
      "row",

    minHeight:
      95,

    borderWidth:
      1,

    borderColor:
      "#E4E7EC",

    elevation:
      3,

    shadowColor:
      "#000",

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity:
      0.07,

    shadowRadius:
      5,
  },


  activeCard: {
    backgroundColor:
      "#FFF1F1",

    borderColor:
      "#F2A0A0",

    borderWidth:
      1.5,
  },


  alertIcon: {
    width:
      34,

    height:
      34,

    borderRadius:
      17,

    backgroundColor:
      "#EF4444",

    justifyContent:
      "center",

    alignItems:
      "center",

    marginRight:
      13,

    marginTop:
      2,
  },


  alertIconText: {
    color:
      "#FFFFFF",

    fontSize:
      20,

    fontWeight:
      "900",
  },


  cardContent: {
    flex: 1,
  },


  alertTitle: {
    color:
      "#202124",

    fontSize:
      15,

    fontWeight:
      "800",
  },


  alertTime: {
    color:
      "#8A8F98",

    fontSize:
      12,

    marginTop:
      5,
  },


  activeAlarmRow: {
    flexDirection:
      "row",

    alignItems:
      "center",

    marginTop:
      11,
  },


  stopButton: {
    height:
      36,

    paddingHorizontal:
      20,

    borderRadius:
      18,

    backgroundColor:
      "#EF4444",

    justifyContent:
      "center",

    alignItems:
      "center",
  },


  stopButtonText: {
    color:
      "#FFFFFF",

    fontSize:
      12,

    fontWeight:
      "800",
  },


  ringingText: {
    marginLeft:
      12,

    color:
      "#B45353",

    fontSize:
      11,
  },


  offMessage: {
    color:
      "#6B7280",

    fontSize:
      12,

    lineHeight:
      17,

    marginTop:
      9,
  },


  // ==========================================================
  // EMPTY
  // ==========================================================

  empty: {
    flex: 1,

    justifyContent:
      "center",

    alignItems:
      "center",

    paddingHorizontal:
      30,

    paddingBottom:
      70,
  },


  emptyIcon: {
    width:
      58,

    height:
      58,

    borderRadius:
      29,

    backgroundColor:
      "#EF4444",

    justifyContent:
      "center",

    alignItems:
      "center",
  },


  emptyIconText: {
    color:
      "#FFFFFF",

    fontSize:
      30,

    fontWeight:
      "900",
  },


  emptyTitle: {
    marginTop:
      15,

    fontSize:
      21,

    fontWeight:
      "700",

    color:
      "#202124",
  },


  emptyText: {
    marginTop:
      7,

    color:
      "#8A8F98",

    fontSize:
      13,

    textAlign:
      "center",

    lineHeight:
      19,
  },

});