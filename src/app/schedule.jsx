import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Switch,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
  NativeModules,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { auth, db } from "../../firebaseConfig";

import { router } from "expo-router";


// ============================================================
// SCREEN
// ============================================================

export default function ScheduleScreen() {

  // ==========================================================
  // NATIVE ALARM MODULE
  // ==========================================================

  const { AlarmModule } = NativeModules;


  // ==========================================================
  // USER
  // ==========================================================

  const [user, setUser] = useState(null);

  const [schedules, setSchedules] = useState([]);


  // ==========================================================
  // MODALS
  // ==========================================================

  const [addModal, setAddModal] = useState(false);

  const [timeModal, setTimeModal] = useState(false);


  // ==========================================================
  // TIME
  // ==========================================================

  const [hour, setHour] = useState(12);

  const [minute, setMinute] = useState(0);

  const [period, setPeriod] = useState("PM");


  // ==========================================================
  // ACTION / REPEAT
  // ==========================================================

  const [action, setAction] = useState("ON");

  const [repeat, setRepeat] = useState("Daily");


  // ==========================================================
  // SAVING
  // ==========================================================

  const [saving, setSaving] = useState(false);


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
  // LOAD SCHEDULES
  // ==========================================================

  useEffect(() => {

    if (!user) {
      setSchedules([]);
      return;
    }

    const schedulesRef =
      collection(
        db,
        "devices",
        user.uid,
        "schedules"
      );


    const unsubscribe =
      onSnapshot(
        schedulesRef,

        (snapshot) => {

          const data =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );


          data.sort(
            (a, b) => {

              const aMinutes =
                Number(a.hour || 0) * 60 +
                Number(a.minute || 0);

              const bMinutes =
                Number(b.hour || 0) * 60 +
                Number(b.minute || 0);

              return (
                aMinutes - bMinutes
              );

            }
          );


          setSchedules(data);

        },

        (error) => {

          console.log(
            "Schedule listener error:",
            error
          );

        }
      );


    return unsubscribe;

  }, [user]);


  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const getTimeText = () => {

    return `${hour}:${String(
      minute
    ).padStart(2, "0")} ${period}`;

  };


  // ==========================================================
  // CONVERT 12 HOUR → 24 HOUR
  // ==========================================================

  const convertTo24Hour = (
    selectedHour,
    selectedPeriod
  ) => {

    let hour24 =
      Number(selectedHour);


    if (selectedPeriod === "AM") {

      if (hour24 === 12) {
        hour24 = 0;
      }

    } else {

      if (hour24 !== 12) {
        hour24 += 12;
      }

    }


    return hour24;

  };


  // ==========================================================
  // CALCULATE NEXT ALARM TIME
  // ==========================================================

  const getNextAlarmTime = (
    hour24,
    selectedMinute
  ) => {

    const now =
      new Date();


    const alarmTime =
      new Date();


    alarmTime.setHours(
      Number(hour24),
      Number(selectedMinute),
      0,
      0
    );


    // If today's time already passed,
    // schedule for tomorrow.

    if (
      alarmTime.getTime() <=
      now.getTime()
    ) {

      alarmTime.setDate(
        alarmTime.getDate() + 1
      );

    }


    return alarmTime;

  };


  // ==========================================================
  // OPEN ADD SCHEDULE
  // ==========================================================

  const openAddSchedule = () => {

    const now =
      new Date();


    let currentHour =
      now.getHours();


    const currentMinute =
      now.getMinutes();


    const currentPeriod =
      currentHour >= 12
        ? "PM"
        : "AM";


    currentHour =
      currentHour % 12;


    if (currentHour === 0) {
      currentHour = 12;
    }


    setHour(currentHour);

    setMinute(currentMinute);

    setPeriod(currentPeriod);

    setAction("ON");

    setRepeat("Daily");

    setAddModal(true);

  };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = async () => {

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
        error?.message ||
          "Unable to logout."
      );

    }

  };


  // ==========================================================
  // SAVE SCHEDULE
  // ==========================================================

  const saveSchedule = async () => {

    if (!user) {

      Alert.alert(
        "Login Required",
        "Please login first."
      );

      return;

    }


    if (
      Platform.OS === "android" &&
      !AlarmModule
    ) {

      Alert.alert(
        "Error",
        "AlarmModule is not available."
      );

      console.log(
        "AlarmModule is not available"
      );

      return;

    }


    try {

      setSaving(true);


      // ======================================================
      // CONVERT TIME
      // ======================================================

      const hour24 =
        convertTo24Hour(
          hour,
          period
        );


      // ======================================================
      // CALCULATE NEXT TRIGGER
      // ======================================================

      const alarmTime =
        getNextAlarmTime(
          hour24,
          minute
        );


      console.log(
        "================================="
      );

      console.log(
        "CREATING SCHEDULE"
      );

      console.log(
        "Display time:",
        getTimeText()
      );

      console.log(
        "Hour 24:",
        hour24
      );

      console.log(
        "Minute:",
        minute
      );

      console.log(
        "Action:",
        action
      );

      console.log(
        "Repeat:",
        repeat
      );

      console.log(
        "Alarm time:",
        alarmTime
      );

      console.log(
        "Alarm millis:",
        alarmTime.getTime()
      );

      console.log(
        "================================="
      );


      // ======================================================
      // SAVE FIRESTORE FIRST
      // ======================================================

      const scheduleRef =
        await addDoc(
          collection(
            db,
            "devices",
            user.uid,
            "schedules"
          ),
          {
            uid: user.uid,

            time: getTimeText(),

            hour: hour24,

            minute: minute,

            action: action,

            repeat: repeat,

            enabled: true,

            createdAt: new Date(),
          }
        );


      console.log(
        "Schedule Firestore ID:",
        scheduleRef.id
      );


      // ======================================================
      // REGISTER ANDROID ALARM
      // ======================================================

      if (
        Platform.OS === "android"
      ) {

        try {

          await AlarmModule.scheduleAlarm(

            scheduleRef.id,

            alarmTime.getTime(),

            repeat,

            user.uid,

            action,

            hour24,

            minute

          );


          console.log(
            "ANDROID ALARM REGISTERED"
          );


        } catch (alarmError) {

          console.log(
            "Android alarm registration failed:",
            alarmError
          );


          // Remove Firestore schedule
          // because Android alarm could not
          // actually be registered.

          try {

            await deleteDoc(
              doc(
                db,
                "devices",
                user.uid,
                "schedules",
                scheduleRef.id
              )
            );

          } catch (deleteError) {

            console.log(
              "Rollback delete error:",
              deleteError
            );

          }


          throw alarmError;

        }

      }


      // ======================================================
      // CLOSE MODAL
      // ======================================================

      setAddModal(false);


      Alert.alert(
        "Schedule Saved",
        `${getTimeText()} — ${action} — ${repeat}`
      );


    } catch (error) {

      console.log(
        "Save schedule error:",
        error
      );


      Alert.alert(
        "Schedule Error",
        error?.message ||
          "Unable to create schedule."
      );


    } finally {

      setSaving(false);

    }

  };


  // ==========================================================
  // TOGGLE SCHEDULE
  // ==========================================================

  const toggleSchedule =
    async (item) => {

      if (!user) {
        return;
      }


      if (
        Platform.OS === "android" &&
        !AlarmModule
      ) {

        Alert.alert(
          "Error",
          "AlarmModule is not available."
        );

        return;

      }


      const newEnabled =
        !item.enabled;


      try {

        // ====================================================
        // ENABLE
        // ====================================================

        if (newEnabled) {

          const alarmTime =
            getNextAlarmTime(
              Number(item.hour),
              Number(item.minute)
            );


          console.log(
            "Enabling schedule:",
            item.id
          );

          console.log(
            "Next alarm:",
            alarmTime
          );


          // Register Android alarm FIRST.

          if (
            Platform.OS === "android"
          ) {

            await AlarmModule.scheduleAlarm(

              item.id,

              alarmTime.getTime(),

              item.repeat ||
                "Once",

              user.uid,

              item.action,

              Number(item.hour),

              Number(item.minute)

            );

          }


          // Then update Firestore.

          await updateDoc(
            doc(
              db,
              "devices",
              user.uid,
              "schedules",
              item.id
            ),
            {
              enabled: true,
            }
          );


          console.log(
            "Schedule enabled:",
            item.id
          );


        } else {

          // ==================================================
          // DISABLE
          // ==================================================

          // Cancel Android alarm FIRST.

          if (
            Platform.OS === "android"
          ) {

            await AlarmModule.cancelAlarm(
              item.id
            );

          }


          // Then update Firestore.

          await updateDoc(
            doc(
              db,
              "devices",
              user.uid,
              "schedules",
              item.id
            ),
            {
              enabled: false,
            }
          );


          console.log(
            "Schedule disabled:",
            item.id
          );

        }


      } catch (error) {

        console.log(
          "Toggle error:",
          error
        );


        Alert.alert(
          "Schedule Error",
          error?.message ||
            "Unable to update schedule."
        );

      }

    };


  // ==========================================================
  // DELETE SCHEDULE
  // ==========================================================

  const deleteSchedule =
    (item) => {

      Alert.alert(

        "Delete Schedule",

        `Delete ${item.time}?`,

        [

          {
            text: "Cancel",

            style: "cancel",
          },


          {

            text: "Delete",

            style: "destructive",

            onPress:
              async () => {

                try {

                  // ==========================================
                  // CANCEL ANDROID ALARM FIRST
                  // ==========================================

                  if (
                    Platform.OS === "android"
                  ) {

                    if (!AlarmModule) {

                      Alert.alert(
                        "Error",
                        "AlarmModule is not available."
                      );

                      return;

                    }


                    await AlarmModule.cancelAlarm(
                      item.id
                    );

                  }


                  // ==========================================
                  // DELETE FIRESTORE SCHEDULE
                  // ==========================================

                  await deleteDoc(
                    doc(
                      db,
                      "devices",
                      user.uid,
                      "schedules",
                      item.id
                    )
                  );


                  console.log(
                    "Schedule deleted:",
                    item.id
                  );


                } catch (error) {

                  console.log(
                    "Delete error:",
                    error
                  );


                  Alert.alert(
                    "Delete Error",
                    error?.message ||
                      "Unable to delete schedule."
                  );

                }

              },

          },

        ]

      );

    };


  // ==========================================================
  // TIME DATA
  // ==========================================================

  const hours = [

    1, 2, 3, 4,

    5, 6, 7, 8,

    9, 10, 11, 12,

  ];

const minutes = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
];


  // ==========================================================
  // MAIN
  // ==========================================================

  return (

    <>

      <StatusBar
        backgroundColor="#FFFFFF"
        barStyle="dark-content"
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

          <View
            style={styles.headerTextContainer}
          >

            <Text
              style={styles.headerTitle}
            >
              Schedules
            </Text>


            <Text
              style={styles.headerSubtitle}
            >
              Automate on/off timing
            </Text>

          </View>


          {/* HEADER BUTTONS */}

          <View
            style={styles.headerButtons}
          >


            {/* ADD */}

            <TouchableOpacity
              style={styles.addButton}
              onPress={openAddSchedule}
              activeOpacity={0.8}
            >

              <Text
                style={styles.plus}
              >
                +
              </Text>

            </TouchableOpacity>


            {/* LOGOUT */}

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >

            </TouchableOpacity>


          </View>

        </View>


        {/* ================================================== */}
        {/* LIST */}
        {/* ================================================== */}

        <ScrollView
          style={styles.list}
          contentContainerStyle={{
            paddingBottom: 30,
          }}
          showsVerticalScrollIndicator={false}
        >

          {schedules.length === 0 ? (

            <View
              style={styles.empty}
            >

              <Text
                style={styles.emptyIcon}
              >
                ◷
              </Text>


              <Text
                style={styles.emptyTitle}
              >
                No schedules yet
              </Text>


              <Text
                style={styles.emptyText}
              >
                Tap + to create a schedule
              </Text>

            </View>

          ) : (

            schedules.map(
              (item) => (

                <Pressable
                  key={item.id}
                  onLongPress={() =>
                    deleteSchedule(item)
                  }
                  delayLongPress={500}
                  style={[
                    styles.card,

                    item.enabled === false &&
                      styles.disabledCard,
                  ]}
                >


                  <View
                    style={styles.cardLeft}
                  >

                    <Text
                      style={[
                        styles.cardTime,

                        item.enabled === false &&
                          styles.disabledText,
                      ]}
                    >
                      {item.time}
                    </Text>


                    <View
                      style={styles.chips}
                    >

                      {/* ACTION */}

                      <View
                        style={[
                          styles.chip,

                          item.action === "ON"
                            ? styles.onChip
                            : styles.offChip,
                        ]}
                      >

                        <Text
                          style={[
                            styles.chipText,

                            item.action === "ON"
                              ? styles.onText
                              : styles.offText,
                          ]}
                        >
                          {item.action}
                        </Text>

                      </View>


                      {/* REPEAT */}

                      <View
                        style={styles.repeatChip}
                      >

                        <Text
                          style={styles.repeatText}
                        >
                          {item.repeat}
                        </Text>

                      </View>

                    </View>

                  </View>


                  {/* SWITCH */}

                  <Switch
                    value={
                      item.enabled === true
                    }
                    onValueChange={() =>
                      toggleSchedule(item)
                    }

                    trackColor={{
                      false: "#D5D9DF",
                      true: "#9ADBD5",
                    }}

                    thumbColor={
                      item.enabled
                        ? "#009688"
                        : "#FFFFFF"
                    }
                  />

                </Pressable>

              )
            )

          )}

        </ScrollView>


        {/* ================================================== */}
        {/* ADD SCHEDULE MODAL */}
        {/* ================================================== */}

        <Modal
          visible={addModal}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setAddModal(false)
          }
        >

          <View
            style={styles.overlay}
          >

            <View
              style={styles.modal}
            >


              {/* MODAL HEADER */}

              <View
                style={styles.modalHeader}
              >

                <Text
                  style={styles.modalTitle}
                >
                  Add Schedule
                </Text>


                <TouchableOpacity
                  onPress={() =>
                    setAddModal(false)
                  }
                >

                  <Text
                    style={styles.close}
                  >
                    ×
                  </Text>

                </TouchableOpacity>

              </View>


              {/* TIME */}

              <Text
                style={styles.label}
              >
                Time
              </Text>


              <TouchableOpacity
                style={styles.timeBox}
                activeOpacity={0.7}
                onPress={() =>
                  setTimeModal(true)
                }
              >

                <Text
                  style={styles.timeText}
                >
                  {getTimeText()}
                </Text>


                <View
                  style={styles.clockButton}
                >

                  <Text
                    style={styles.clockIcon}
                  >
                    ◷
                  </Text>

                </View>

              </TouchableOpacity>


              {/* ACTION */}

              <Text
                style={styles.label}
              >
                Action
              </Text>


              <View
                style={styles.row}
              >

                <TouchableOpacity
                  style={[
                    styles.option,

                    action === "ON" &&
                      styles.green,
                  ]}
                  onPress={() =>
                    setAction("ON")
                  }
                >

                  <Text
                    style={[
                      styles.optionText,

                      action === "ON" &&
                        styles.white,
                    ]}
                  >
                    ON
                  </Text>

                </TouchableOpacity>


                <TouchableOpacity
                  style={[
                    styles.option,

                    action === "OFF" &&
                      styles.red,
                  ]}
                  onPress={() =>
                    setAction("OFF")
                  }
                >

                  <Text
                    style={[
                      styles.optionText,

                      action === "OFF" &&
                        styles.white,
                    ]}
                  >
                    OFF
                  </Text>

                </TouchableOpacity>

              </View>


              {/* REPEAT */}

              <Text
                style={styles.label}
              >
                Repeat
              </Text>


              <View
                style={styles.row}
              >

                <TouchableOpacity
                  style={[
                    styles.option,

                    repeat === "Once" &&
                      styles.blue,
                  ]}
                  onPress={() =>
                    setRepeat("Once")
                  }
                >

                  <Text
                    style={[
                      styles.optionText,

                      repeat === "Once" &&
                        styles.white,
                    ]}
                  >
                    Once
                  </Text>

                </TouchableOpacity>


                <TouchableOpacity
                  style={[
                    styles.option,

                    repeat === "Daily" &&
                      styles.blue,
                  ]}
                  onPress={() =>
                    setRepeat("Daily")
                  }
                >

                  <Text
                    style={[
                      styles.optionText,

                      repeat === "Daily" &&
                        styles.white,
                    ]}
                  >
                    Daily
                  </Text>

                </TouchableOpacity>

              </View>


              {/* SAVE */}

              <TouchableOpacity
                style={[
                  styles.save,

                  saving &&
                    styles.saveDisabled,
                ]}
                onPress={saveSchedule}
                disabled={saving}
              >

                <Text
                  style={styles.saveText}
                >
                  {saving
                    ? "Saving..."
                    : "Save Schedule"}
                </Text>

              </TouchableOpacity>


            </View>

          </View>

        </Modal>


        {/* ================================================== */}
        {/* TIME PICKER */}
        {/* ================================================== */}

        <Modal
          visible={timeModal}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setTimeModal(false)
          }
        >

          <View
            style={styles.timeOverlay}
          >

            <View
              style={styles.timePicker}
            >

              <Text
                style={styles.pickerTitle}
              >
                Select Time
              </Text>


              <Text
                style={styles.bigTime}
              >
                {getTimeText()}
              </Text>


              {/* HOUR */}

              <Text
                style={styles.pickerLabel}
              >
                Hour
              </Text>


              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >

                {hours.map(
                  (item) => (

                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.circleButton,

                        hour === item &&
                          styles.selectedCircle,
                      ]}
                      onPress={() =>
                        setHour(item)
                      }
                    >

                      <Text
                        style={[
                          styles.circleText,

                          hour === item &&
                            styles.selectedCircleText,
                        ]}
                      >
                        {item}
                      </Text>

                    </TouchableOpacity>

                  )
                )}

              </ScrollView>


              {/* MINUTES */}

              <Text
                style={styles.pickerLabel}
              >
                Minutes
              </Text>


              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >

                {minutes.map(
                  (item) => (

                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.circleButton,

                        minute === item &&
                          styles.selectedCircle,
                      ]}
                      onPress={() =>
                        setMinute(item)
                      }
                    >

                      <Text
                        style={[
                          styles.circleText,

                          minute === item &&
                            styles.selectedCircleText,
                        ]}
                      >
                        {String(
                          item
                        ).padStart(2, "0")}
                      </Text>

                    </TouchableOpacity>

                  )
                )}

              </ScrollView>


              {/* AM / PM */}

              <View
                style={styles.periodRow}
              >

                <TouchableOpacity
                  style={[
                    styles.periodButton,

                    period === "AM" &&
                      styles.selectedPeriod,
                  ]}
                  onPress={() =>
                    setPeriod("AM")
                  }
                >

                  <Text
                    style={[
                      styles.periodText,

                      period === "AM" &&
                        styles.white,
                    ]}
                  >
                    AM
                  </Text>

                </TouchableOpacity>


                <TouchableOpacity
                  style={[
                    styles.periodButton,

                    period === "PM" &&
                      styles.selectedPeriod,
                  ]}
                  onPress={() =>
                    setPeriod("PM")
                  }
                >

                  <Text
                    style={[
                      styles.periodText,

                      period === "PM" &&
                        styles.white,
                    ]}
                  >
                    PM
                  </Text>

                </TouchableOpacity>

              </View>


              {/* DONE */}

              <TouchableOpacity
                style={styles.doneButton}
                onPress={() =>
                  setTimeModal(false)
                }
              >

                <Text
                  style={styles.doneText}
                >
                  Done
                </Text>

              </TouchableOpacity>


            </View>

          </View>

        </Modal>


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
  // HEADER
  // ==========================================================

  header: {
    backgroundColor: "#3478F6",

    paddingHorizontal: 28,

    paddingTop: 20,

    paddingBottom: 25,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },


  headerTextContainer: {
    flex: 1,
    paddingRight: 10,
  },


  headerTitle: {
    color: "#FFFFFF",

    fontSize: 30,

    fontWeight: "800",
  },


  headerSubtitle: {
    color: "#E4ECFF",

    fontSize: 15,

    marginTop: 5,
  },


  // ==========================================================
  // HEADER BUTTONS
  // ==========================================================

  headerButtons: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },


  logoutButton: {
    width: 52,

    height: 52,

    borderRadius: 26,

    backgroundColor: "#1556B8",

    justifyContent: "center",

    alignItems: "center",
  },


  logoutText: {
    color: "#FFFFFF",

    fontSize: 29,

    fontWeight: "700",
  },


  addButton: {
    width: 52,

    height: 52,

    borderRadius: 26,

    backgroundColor: "#1556B8",

    justifyContent: "center",

    alignItems: "center",
  },


  plus: {
    color: "#FFFFFF",

    fontSize: 34,

    lineHeight: 38,

    fontWeight: "400",
  },


  // ==========================================================
  // LIST
  // ==========================================================

  list: {
    flex: 1,

    paddingHorizontal: 22,

    paddingTop: 20,
  },


  // ==========================================================
  // CARD
  // ==========================================================

  card: {
    backgroundColor: "#FFFFFF",

    minHeight: 95,

    borderRadius: 18,

    marginBottom: 15,

    paddingHorizontal: 22,

    paddingVertical: 18,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    elevation: 3,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.08,

    shadowRadius: 5,
  },


  disabledCard: {
    opacity: 0.55,
  },


  cardLeft: {
    flex: 1,

    paddingRight: 10,
  },


  cardTime: {
    fontSize: 23,

    fontWeight: "800",

    color: "#182033",

    marginBottom: 8,
  },


  disabledText: {
    color: "#8A909A",
  },


  chips: {
    flexDirection: "row",
  },


  chip: {
    paddingHorizontal: 13,

    paddingVertical: 6,

    borderRadius: 15,

    marginRight: 8,
  },


  onChip: {
    backgroundColor: "#D7F8E7",
  },


  offChip: {
    backgroundColor: "#FFE0E0",
  },


  chipText: {
    fontWeight: "800",

    fontSize: 13,
  },


  onText: {
    color: "#0DA957",
  },


  offText: {
    color: "#E53935",
  },


  repeatChip: {
    backgroundColor: "#E8EDF4",

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: 15,
  },


  repeatText: {
    color: "#65758B",

    fontWeight: "700",

    fontSize: 13,
  },


  // ==========================================================
  // EMPTY
  // ==========================================================

  empty: {
    alignItems: "center",

    marginTop: 120,
  },


  emptyIcon: {
    fontSize: 55,

    color: "#AEB7C5",
  },


  emptyTitle: {
    fontSize: 20,

    fontWeight: "700",

    color: "#455066",

    marginTop: 15,
  },


  emptyText: {
    color: "#8993A5",

    marginTop: 5,
  },


  // ==========================================================
  // ADD MODAL
  // ==========================================================

  overlay: {
    flex: 1,

    backgroundColor:
      "rgba(0,0,0,0.45)",

    justifyContent: "flex-end",
  },


  modal: {
    backgroundColor: "#FFFFFF",

    borderTopLeftRadius: 30,

    borderTopRightRadius: 30,

    padding: 28,

    paddingBottom: 35,
  },


  modalHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 20,
  },


  modalTitle: {
    fontSize: 28,

    fontWeight: "800",

    color: "#182033",
  },


  close: {
    fontSize: 35,

    color: "#667085",
  },


  label: {
    fontSize: 17,

    fontWeight: "700",

    color: "#273044",

    marginTop: 15,

    marginBottom: 10,
  },


  // ==========================================================
  // TIME BOX
  // ==========================================================

  timeBox: {
    height: 65,

    borderWidth: 1,

    borderColor: "#D7DDE7",

    borderRadius: 12,

    paddingHorizontal: 20,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },


  timeText: {
    fontSize: 20,

    fontWeight: "800",

    color: "#182033",
  },


  clockButton: {
    width: 48,

    height: 48,

    justifyContent: "center",

    alignItems: "center",
  },


  clockIcon: {
    fontSize: 32,

    color: "#2875F2",
  },


  // ==========================================================
  // OPTIONS
  // ==========================================================

  row: {
    flexDirection: "row",

    gap: 12,
  },


  option: {
    flex: 1,

    height: 54,

    borderWidth: 1,

    borderColor: "#D8DEE8",

    borderRadius: 10,

    justifyContent: "center",

    alignItems: "center",
  },


  optionText: {
    fontSize: 16,

    fontWeight: "800",

    color: "#596273",
  },


  green: {
    backgroundColor: "#20C86A",

    borderColor: "#20C86A",
  },


  red: {
    backgroundColor: "#F04444",

    borderColor: "#F04444",
  },


  blue: {
    backgroundColor: "#3478F6",

    borderColor: "#3478F6",
  },


  white: {
    color: "#FFFFFF",
  },


  // ==========================================================
  // SAVE
  // ==========================================================

  save: {
    height: 60,

    backgroundColor: "#3478F6",

    borderRadius: 11,

    justifyContent: "center",

    alignItems: "center",

    marginTop: 25,
  },


  saveDisabled: {
    opacity: 0.6,
  },


  saveText: {
    color: "#FFFFFF",

    fontSize: 17,

    fontWeight: "800",
  },


  // ==========================================================
  // TIME PICKER
  // ==========================================================

  timeOverlay: {
    flex: 1,

    backgroundColor:
      "rgba(0,0,0,0.55)",

    justifyContent: "center",

    alignItems: "center",

    padding: 20,
  },


  timePicker: {
    width: "100%",

    maxWidth: 600,

    backgroundColor: "#FFFFFF",

    borderRadius: 25,

    padding: 25,
  },


  pickerTitle: {
    textAlign: "center",

    fontSize: 24,

    fontWeight: "800",

    color: "#182033",
  },


  bigTime: {
    textAlign: "center",

    fontSize: 36,

    fontWeight: "800",

    color: "#3478F6",

    marginVertical: 20,
  },


  pickerLabel: {
    fontSize: 15,

    fontWeight: "700",

    color: "#596273",

    marginBottom: 10,

    marginTop: 8,
  },


  circleButton: {
    width: 50,

    height: 50,

    borderRadius: 25,

    borderWidth: 1,

    borderColor: "#D7DDE7",

    justifyContent: "center",

    alignItems: "center",

    marginRight: 9,
  },


  selectedCircle: {
    backgroundColor: "#3478F6",

    borderColor: "#3478F6",
  },


  circleText: {
    fontSize: 15,

    fontWeight: "700",

    color: "#4C566A",
  },


  selectedCircleText: {
    color: "#FFFFFF",
  },


  periodRow: {
    flexDirection: "row",

    gap: 12,

    marginTop: 20,
  },


  periodButton: {
    flex: 1,

    height: 50,

    borderWidth: 1,

    borderColor: "#D8DEE8",

    borderRadius: 10,

    justifyContent: "center",

    alignItems: "center",
  },


  selectedPeriod: {
    backgroundColor: "#3478F6",

    borderColor: "#3478F6",
  },


  periodText: {
    fontSize: 16,

    fontWeight: "800",

    color: "#596273",
  },


  doneButton: {
    height: 55,

    backgroundColor: "#3478F6",

    borderRadius: 10,

    justifyContent: "center",

    alignItems: "center",

    marginTop: 22,
  },


  doneText: {
    color: "#FFFFFF",

    fontSize: 17,

    fontWeight: "800",
  },

});