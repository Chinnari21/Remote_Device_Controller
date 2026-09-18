import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";

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

import { auth, db } from "../../firebaseConfig";


export default function Alerts() {

  const [user, setUser] = useState(null);

  const [alerts, setAlerts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [stoppingId, setStoppingId] =
    useState(null);


  // ============================================================
  // AUTH
  // ============================================================

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {

          setUser(currentUser);

          if (!currentUser) {
            router.replace("/");
          }
        }
      );

    return unsubscribe;

  }, []);


  // ============================================================
  // FIRESTORE ALERT LISTENER
  // ============================================================

  useEffect(() => {

    if (!user) return;


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

        (snapshot) => {

          const list =
            snapshot.docs

              .map((item) => ({
                id: item.id,
                ...item.data(),
              }))

              .sort((a, b) => {

                const aTime =
                  a.createdAt?.toMillis
                    ? a.createdAt.toMillis()
                    : 0;

                const bTime =
                  b.createdAt?.toMillis
                    ? b.createdAt.toMillis()
                    : 0;

                return bTime - aTime;
              });


          console.log(
            "Alerts received:",
            list.length
          );


          setAlerts(list);
          setLoading(false);
        },

        (error) => {

          console.log(
            "Alerts listener error:",
            error
          );

          setLoading(false);
        }
      );


    return unsubscribe;

  }, [user]);


  // ============================================================
  // STOP ALARM
  // ============================================================

  const stopAlarm =
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
          "Stopping alarm from Alerts:",
          alertItem.id
        );


        // UPDATE ALERT

        await updateDoc(
          doc(
            db,
            "alerts",
            alertItem.id
          ),
          {
            status: "stopped",

            stoppedAt:
              serverTimestamp(),
          }
        );


        // UPDATE DEVICE

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


        // REMOVE NOTIFICATION

        try {

          await Notifications.dismissAllNotificationsAsync();

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
          "Stop alarm error:",
          error
        );


        Alert.alert(
          "Stop Alarm Error",
          error.message
        );


      } finally {

        setStoppingId(null);
      }
    };


  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout =
    async () => {

      try {

        // Stop active kill state before logout

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


        try {

          await Notifications.dismissAllNotificationsAsync();

        } catch {}


        await signOut(auth);

        router.replace("/");


        console.log(
          "User logged out from Alerts."
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
  // FORMAT TIME
  // ============================================================

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
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }
        );


      } catch {

        return "";
      }
    };


  // ============================================================
  // ALERT TITLE
  // ============================================================

  const getTitle =
    (item) => {

      if (
        item.deviceStateAtKill === true
      ) {

        return "KILL triggered - Device ON";
      }


      return "KILL triggered - Device OFF";
    };


  // ============================================================
  // ALERT CARD
  // ============================================================

  const renderAlert =
    ({ item }) => {

      const deviceWasOn =
        item.deviceStateAtKill === true;


      const isActive =
        item.status === "active";


      return (

        <View
          style={[
            styles.alertCard,

            deviceWasOn &&
              isActive &&
              styles.activeCard,
          ]}
        >

          {/* RED ALERT ICON */}

          <View
            style={styles.alertIcon}
          >

            <Text
              style={styles.alertIconText}
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


            {/* ACTIVE ON ALARM */}

            {deviceWasOn &&
            isActive ? (

              <View
                style={styles.activeAlarmRow}
              >

                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={() =>
                    stopAlarm(item)
                  }
                  disabled={
                    stoppingId === item.id
                  }
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
                style={styles.offMessage}
              >
                {item.message ||
                  "The device was OFF when Kill was pressed."}
              </Text>

            )}

          </View>

        </View>
      );
    };


  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {

    return (

      <SafeAreaView
        style={styles.loading}
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
    );
  }


  // ============================================================
  // SCREEN
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


        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.headerCircle}
          onPress={handleLogout}
        >

          <Text
            style={styles.logoutIcon}
          >
            ↪
          </Text>

        </TouchableOpacity>

      </View>


      {/* ALERT LIST */}

      {alerts.length === 0 ? (

        <View
          style={styles.empty}
        >

          <View
            style={styles.emptyIcon}
          >

            <Text
              style={styles.emptyIconText}
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
          renderItem={renderAlert}
          contentContainerStyle={
            styles.list
          }
          showsVerticalScrollIndicator={
            false
          }
        />

      )}


      {/* BOTTOM NAVIGATION */}

      <View
        style={styles.bottomNavigation}
      >

        {/* HOME */}

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.replace("/home")
          }
        >

          <Text
            style={styles.navIcon}
          >
            ●
          </Text>

          <Text
            style={styles.navText}
          >
            Home
          </Text>

        </TouchableOpacity>


        {/* SCHEDULE */}

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push("/schedule")
          }
        >

          <Text
            style={styles.navIcon}
          >
            ◷
          </Text>

          <Text
            style={styles.navText}
          >
            Schedule
          </Text>

        </TouchableOpacity>


        {/* ALERTS */}

        <TouchableOpacity
          style={styles.navItem}
        >

          <Text
            style={styles.navIconActive}
          >
            !
          </Text>

          <Text
            style={styles.navActiveText}
          >
            Alerts
          </Text>

        </TouchableOpacity>


        {/* LOGS */}

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push("/logs")
          }
        >

          <Text
            style={styles.navIcon}
          >
            ≡
          </Text>

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


const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor: "#FFFFFF",
    },

    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
    },

    loadingText: {
      marginTop: 10,
      color: "#777777",
      fontSize: 14,
    },


    // HEADER

    header: {
      height: 88,
      backgroundColor: "#3478F6",
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    headerTitle: {
      color: "#FFFFFF",
      fontSize: 27,
      fontWeight: "800",
    },

    headerSubtitle: {
      color: "#DCE8FF",
      fontSize: 13,
      marginTop: 3,
    },

    headerCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#164FB5",
      justifyContent: "center",
      alignItems: "center",
    },

    logoutIcon: {
      color: "#FFFFFF",
      fontSize: 26,
      fontWeight: "700",
    },


    // LIST

    list: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 90,
    },


    // CARD

    alertCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E4E7EC",
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      flexDirection: "row",
      minHeight: 82,

      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 5,

      elevation: 2,
    },

    activeCard: {
      backgroundColor: "#FFF1F1",
      borderColor: "#F2A0A0",
      borderWidth: 1.5,
    },


    // ICON

    alertIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#EF4444",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      marginTop: 2,
    },

    alertIconText: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "900",
    },


    // CONTENT

    cardContent: {
      flex: 1,
    },

    alertTitle: {
      color: "#202124",
      fontSize: 14,
      fontWeight: "700",
    },

    alertTime: {
      color: "#8A8F98",
      fontSize: 11,
      marginTop: 5,
    },


    // ACTIVE ALARM

    activeAlarmRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },

    stopButton: {
      height: 34,
      paddingHorizontal: 20,
      borderRadius: 18,
      backgroundColor: "#EF4444",
      justifyContent: "center",
      alignItems: "center",
    },

    stopButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },

    ringingText: {
      marginLeft: 12,
      color: "#B45353",
      fontSize: 10,
    },


    // OFF MESSAGE

    offMessage: {
      color: "#6B7280",
      fontSize: 12,
      lineHeight: 17,
      marginTop: 9,
    },


    // EMPTY

    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 70,
      paddingHorizontal: 30,
    },

    emptyIcon: {
      width: 55,
      height: 55,
      borderRadius: 28,
      backgroundColor: "#EF4444",
      justifyContent: "center",
      alignItems: "center",
    },

    emptyIconText: {
      color: "#FFFFFF",
      fontSize: 28,
      fontWeight: "900",
    },

    emptyTitle: {
      marginTop: 15,
      fontSize: 20,
      fontWeight: "700",
      color: "#202124",
    },

    emptyText: {
      marginTop: 7,
      color: "#8A8F98",
      fontSize: 13,
      textAlign: "center",
    },


    // BOTTOM NAV

    bottomNavigation: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 70,
      backgroundColor: "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: "#EEEEEE",
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
    },

    navItem: {
      alignItems: "center",
      justifyContent: "center",
      minWidth: 60,
    },

    navIcon: {
      color: "#B5B8BD",
      fontSize: 20,
      height: 25,
    },

    navIconActive: {
      color: "#3478F6",
      fontSize: 22,
      fontWeight: "900",
      height: 25,
    },

    navText: {
      color: "#AAAAAA",
      fontSize: 10,
      marginTop: 3,
    },

    navActiveText: {
      color: "#3478F6",
      fontSize: 10,
      marginTop: 3,
      fontWeight: "700",
    },

  });