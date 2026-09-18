import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { auth, db } from "../../firebaseConfig";


// ============================================================
// LOGS & ANALYTICS
// ============================================================

export default function LogsScreen() {

  // ==========================================================
  // USER
  // ==========================================================

  const [user, setUser] = useState(null);

  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState("Daily");


  // ==========================================================
  // AUTH
  // ==========================================================

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


  // ==========================================================
  // FIRESTORE LOG LISTENER
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }


    console.log(
      "Starting Logs listener:",
      user.uid
    );


    const logsRef =
      collection(
        db,
        "logs"
      );


    const logsQuery =
      query(
        logsRef,
        where(
          "uid",
          "==",
          user.uid
        )
      );


    const unsubscribe =
      onSnapshot(

        logsQuery,

        (snapshot) => {

          const list =
            snapshot.docs
              .map(
                (item) => ({
                  id: item.id,
                  ...item.data(),
                })
              )
              .sort(
                (a, b) => {

                  const aTime =
                    getTimestampValue(
                      a.timestamp ||
                      a.createdAt
                    );


                  const bTime =
                    getTimestampValue(
                      b.timestamp ||
                      b.createdAt
                    );


                  return (
                    bTime - aTime
                  );
                }
              );


          console.log(
            "Logs received:",
            list.length
          );


          setLogs(list);

          setLoading(false);
        },


        (error) => {

          console.log(
            "Logs listener error:",
            error
          );

          setLoading(false);
        }
      );


    return unsubscribe;

  }, [user]);


  // ==========================================================
  // TIMESTAMP VALUE
  // ==========================================================

  const getTimestampValue =
    (timestamp) => {

      if (!timestamp) {
        return 0;
      }


      try {

        if (
          typeof timestamp.toMillis ===
          "function"
        ) {

          return timestamp.toMillis();
        }


        if (
          typeof timestamp.toDate ===
          "function"
        ) {

          return timestamp
            .toDate()
            .getTime();
        }


        return new Date(
          timestamp
        ).getTime();

      } catch {

        return 0;
      }
    };


  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate =
    (timestamp) => {

      if (!timestamp) {
        return "Unknown time";
      }


      try {

        const date =
          typeof timestamp.toDate ===
          "function"
            ? timestamp.toDate()
            : new Date(timestamp);


        return date.toLocaleString(
          [],
          {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }
        );

      } catch {

        return "Unknown time";
      }
    };


  // ==========================================================
  // PERIOD START
  // ==========================================================

  const getStartDate =
    (selectedPeriod) => {

      const now = new Date();

      const start =
        new Date(now);


      if (
        selectedPeriod ===
        "Daily"
      ) {

        start.setHours(
          0,
          0,
          0,
          0
        );

      } else if (
        selectedPeriod ===
        "Weekly"
      ) {

        const day =
          start.getDay();


        const difference =
          day === 0
            ? 6
            : day - 1;


        start.setDate(
          start.getDate() -
          difference
        );


        start.setHours(
          0,
          0,
          0,
          0
        );

      } else if (
        selectedPeriod ===
        "Monthly"
      ) {

        start.setDate(1);

        start.setHours(
          0,
          0,
          0,
          0
        );

      } else if (
        selectedPeriod ===
        "Yearly"
      ) {

        start.setMonth(0);

        start.setDate(1);

        start.setHours(
          0,
          0,
          0,
          0
        );
      }


      return start;
    };


  // ==========================================================
  // FILTERED LOGS
  // ==========================================================

  const filteredLogs =
    useMemo(() => {

      const start =
        getStartDate(period)
          .getTime();


      return logs.filter(
        (item) => {

          const time =
            getTimestampValue(
              item.timestamp ||
              item.createdAt
            );


          return time >= start;
        }
      );

    }, [logs, period]);


  // ==========================================================
  // CALCULATE ON TIME
  // ==========================================================

  const calculateOnTime =
    (items) => {

      if (!items.length) {
        return 0;
      }


      const sorted =
        [...items].sort(
          (a, b) =>
            getTimestampValue(
              a.timestamp ||
              a.createdAt
            ) -
            getTimestampValue(
              b.timestamp ||
              b.createdAt
            )
        );


      let total = 0;

      let onStart = null;


      sorted.forEach(
        (item) => {

          const state =
            String(
              item.state ||
              item.status ||
              ""
            ).toUpperCase();


          const time =
            getTimestampValue(
              item.timestamp ||
              item.createdAt
            );


          if (
            state === "ON"
          ) {

            if (
              onStart === null
            ) {

              onStart = time;
            }

          } else if (
            state === "OFF"
          ) {

            if (
              onStart !== null
            ) {

              total +=
                Math.max(
                  0,
                  time - onStart
                );

              onStart = null;
            }
          }
        }
      );


      // If currently ON,
      // count until now.

      if (
        onStart !== null
      ) {

        total +=
          Math.max(
            0,
            Date.now() - onStart
          );
      }


      return total;
    };


  // ==========================================================
  // TOTAL ON TIME
  // ==========================================================

  const totalOnTime =
    calculateOnTime(
      filteredLogs
    );


  // ==========================================================
  // FORMAT DURATION
  // ==========================================================

  const formatDuration =
    (milliseconds) => {

      const totalMinutes =
        Math.floor(
          milliseconds /
          60000
        );


      const hours =
        Math.floor(
          totalMinutes / 60
        );


      const minutes =
        totalMinutes % 60;


      if (
        hours === 0
      ) {

        return `${minutes} min`;
      }


      return `${hours}h ${minutes}m`;
    };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    async () => {

      try {

        await signOut(auth);

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
  // LOG CARD
  // ==========================================================

  const renderLog =
    ({ item }) => {

      const state =
        String(
          item.state ||
          item.status ||
          "UNKNOWN"
        ).toUpperCase();


      const mode =
        item.mode ||
        "Manual";


      const isOn =
        state === "ON";


      return (

        <View
          style={styles.logCard}
        >

          {/* STATE ICON */}

          <View
            style={[
              styles.stateCircle,

              isOn
                ? styles.stateOn
                : styles.stateOff,
            ]}
          >

            <Text
              style={styles.stateIcon}
            >
              {isOn
                ? "✓"
                : "×"}
            </Text>

          </View>


          {/* CONTENT */}

          <View
            style={styles.logContent}
          >

            <Text
              style={styles.logState}
            >
              Device {state}
            </Text>


            <Text
              style={styles.logTime}
            >
              {formatDate(
                item.timestamp ||
                item.createdAt
              )}
            </Text>

          </View>


          {/* MODE */}

          <View
            style={[
              styles.modeChip,

              mode
                .toLowerCase()
                .includes("schedule")
                ? styles.scheduleChip
                : styles.manualChip,
            ]}
          >

            <Text
              style={[
                styles.modeText,

                mode
                  .toLowerCase()
                  .includes("schedule")
                  ? styles.scheduleText
                  : styles.manualText,
              ]}
            >
              {mode}
            </Text>

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
            Loading logs...
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
              Logs & Analytics
            </Text>


            <Text
              style={styles.headerSubtitle}
            >
              Device usage history
            </Text>

          </View>


          {/* LOGOUT */}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >

           

          </TouchableOpacity>

        </View>


        {/* ================================================== */}
        {/* CONTENT */}
        {/* ================================================== */}

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >

          {/* ================================================= */}
          {/* FILTER CHIPS */}
          {/* ================================================= */}

          <View
            style={styles.filterContainer}
          >

            {[
              "Daily",
              "Weekly",
              "Monthly",
              "Yearly",
            ].map(
              (item) => (

                <TouchableOpacity
                  key={item}
                  style={[
                    styles.filterChip,

                    period === item &&
                      styles.filterChipActive,
                  ]}
                  onPress={() =>
                    setPeriod(item)
                  }
                  activeOpacity={0.8}
                >

                  <Text
                    style={[
                      styles.filterText,

                      period === item &&
                        styles.filterTextActive,
                    ]}
                  >
                    {item}
                  </Text>

                </TouchableOpacity>

              )
            )}

          </View>


          {/* ================================================= */}
          {/* ANALYTICS CARD */}
          {/* ================================================= */}

          <View
            style={styles.analyticsCard}
          >

            <Text
              style={styles.analyticsTitle}
            >
              Total ON-time
            </Text>


            <Text
              style={styles.totalTime}
            >
              {formatDuration(
                totalOnTime
              )}
            </Text>


            <Text
              style={styles.analyticsSubtitle}
            >
              {period} usage
            </Text>


            {/* SIMPLE BAR VISUAL */}

            <View
              style={styles.chart}
            >

              {[20, 38, 30, 55, 42, 70, 48].map(
                (height, index) => (

                  <View
                    key={index}
                    style={styles.barContainer}
                  >

                    <View
                      style={[
                        styles.bar,

                        {
                          height:
                            height,
                        },
                      ]}
                    />

                  </View>

                )
              )}

            </View>

          </View>


          {/* ================================================= */}
          {/* RAW LOGS TITLE */}
          {/* ================================================= */}

          <View
            style={styles.logsHeader}
          >

            <Text
              style={styles.logsTitle}
            >
              Activity History
            </Text>


            <Text
              style={styles.logsCount}
            >
              {filteredLogs.length} entries
            </Text>

          </View>


          {/* ================================================= */}
          {/* LOGS */}
          {/* ================================================= */}

          {filteredLogs.length === 0 ? (

            <View
              style={styles.empty}
            >

              <Text
                style={styles.emptyIcon}
              >
                ≡
              </Text>


              <Text
                style={styles.emptyTitle}
              >
                No logs yet
              </Text>


              <Text
                style={styles.emptyText}
              >
                Device ON/OFF activity
                {"\n"}
                will appear here.
              </Text>

            </View>

          ) : (

            filteredLogs.map(
              (item) => (
                <View
                  key={item.id}
                >
                  {renderLog({
                    item,
                  })}
                </View>
              )
            )

          )}

        </ScrollView>


        {/* ================================================== */}
        {/* NO BOTTOM NAVIGATION HERE */}
        {/* _layout.jsx HANDLES IT */}
        {/* ================================================== */}

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
    backgroundColor: "#F5F7FB",
  },


  // ==========================================================
  // LOADING
  // ==========================================================

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


  // ==========================================================
  // HEADER
  // ==========================================================

  header: {
    backgroundColor: "#3478F6",

    minHeight: 110,

    paddingHorizontal: 28,

    paddingTop: 20,

    paddingBottom: 25,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },


  headerTitle: {
    color: "#FFFFFF",

    fontSize: 28,

    fontWeight: "800",
  },


  headerSubtitle: {
    color: "#DCE8FF",

    fontSize: 15,

    marginTop: 5,
  },


  logoutButton: {
    width: 50,

    height: 50,

    borderRadius: 25,

    backgroundColor: "#1556B8",

    justifyContent: "center",

    alignItems: "center",
  },


  logoutIcon: {
    color: "#FFFFFF",

    fontSize: 29,

    fontWeight: "700",
  },


  // ==========================================================
  // SCROLL
  // ==========================================================

  scroll: {
    flex: 1,
  },


  scrollContent: {
    paddingHorizontal: 22,

    paddingTop: 20,

    paddingBottom: 35,
  },


  // ==========================================================
  // FILTERS
  // ==========================================================

  filterContainer: {
    flexDirection: "row",

    backgroundColor: "#FFFFFF",

    borderRadius: 15,

    padding: 5,

    marginBottom: 18,

    elevation: 2,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.05,

    shadowRadius: 4,
  },


  filterChip: {
    flex: 1,

    height: 42,

    borderRadius: 11,

    justifyContent: "center",

    alignItems: "center",
  },


  filterChipActive: {
    backgroundColor: "#3478F6",
  },


  filterText: {
    color: "#7A8495",

    fontSize: 12,

    fontWeight: "700",
  },


  filterTextActive: {
    color: "#FFFFFF",
  },


  // ==========================================================
  // ANALYTICS
  // ==========================================================

  analyticsCard: {
    backgroundColor: "#FFFFFF",

    borderRadius: 20,

    padding: 22,

    marginBottom: 22,

    elevation: 3,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.07,

    shadowRadius: 6,
  },


  analyticsTitle: {
    color: "#566174",

    fontSize: 15,

    fontWeight: "600",
  },


  totalTime: {
    color: "#182033",

    fontSize: 34,

    fontWeight: "800",

    marginTop: 4,
  },


  analyticsSubtitle: {
    color: "#9AA2AF",

    fontSize: 12,

    marginTop: 2,
  },


  // ==========================================================
  // CHART
  // ==========================================================

  chart: {
    height: 115,

    marginTop: 22,

    flexDirection: "row",

    alignItems: "flex-end",

    justifyContent: "space-around",

    borderBottomWidth: 1,

    borderBottomColor: "#E9EDF3",
  },


  barContainer: {
    height: 100,

    width: 25,

    justifyContent: "flex-end",

    alignItems: "center",
  },


  bar: {
    width: 17,

    backgroundColor: "#3478F6",

    borderTopLeftRadius: 5,

    borderTopRightRadius: 5,
  },


  // ==========================================================
  // LOG HEADER
  // ==========================================================

  logsHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 12,
  },


  logsTitle: {
    color: "#182033",

    fontSize: 20,

    fontWeight: "800",
  },


  logsCount: {
    color: "#8993A5",

    fontSize: 12,

    fontWeight: "600",
  },


  // ==========================================================
  // LOG CARD
  // ==========================================================

  logCard: {
    backgroundColor: "#FFFFFF",

    borderRadius: 16,

    padding: 15,

    marginBottom: 11,

    flexDirection: "row",

    alignItems: "center",

    borderWidth: 1,

    borderColor: "#E7EAF0",

    elevation: 2,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.05,

    shadowRadius: 4,
  },


  stateCircle: {
    width: 40,

    height: 40,

    borderRadius: 20,

    justifyContent: "center",

    alignItems: "center",

    marginRight: 12,
  },


  stateOn: {
    backgroundColor: "#D7F8E7",
  },


  stateOff: {
    backgroundColor: "#FFE0E0",
  },


  stateIcon: {
    fontSize: 19,

    fontWeight: "900",
  },


  logContent: {
    flex: 1,
  },


  logState: {
    color: "#202124",

    fontSize: 14,

    fontWeight: "800",
  },


  logTime: {
    color: "#8A8F98",

    fontSize: 11,

    marginTop: 5,
  },


  // ==========================================================
  // MODE CHIP
  // ==========================================================

  modeChip: {
    paddingHorizontal: 11,

    paddingVertical: 6,

    borderRadius: 14,
  },


  manualChip: {
    backgroundColor: "#E7F0FF",
  },


  scheduleChip: {
    backgroundColor: "#E7F8F4",
  },


  modeText: {
    fontSize: 11,

    fontWeight: "800",
  },


  manualText: {
    color: "#3478F6",
  },


  scheduleText: {
    color: "#008C78",
  },


  // ==========================================================
  // EMPTY
  // ==========================================================

  empty: {
    alignItems: "center",

    paddingTop: 50,

    paddingBottom: 30,
  },


  emptyIcon: {
    color: "#AAB3C1",

    fontSize: 42,

    fontWeight: "700",
  },


  emptyTitle: {
    color: "#455066",

    fontSize: 19,

    fontWeight: "700",

    marginTop: 12,
  },


  emptyText: {
    color: "#8A94A6",

    fontSize: 13,

    textAlign: "center",

    lineHeight: 19,

    marginTop: 6,
  },

});