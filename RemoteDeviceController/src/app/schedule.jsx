import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  Alert,
  ScrollView,
  Platform,
} from "react-native";

import { collection, addDoc, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../../firebaseConfig";

export default function ScheduleScreen() {
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);

  const [addModal, setAddModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);

  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState("PM");

  const [action, setAction] = useState("ON");
  const [repeat, setRepeat] = useState("Daily");

  const [saving, setSaving] = useState(false);

  // =====================================================
  // AUTH
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  // =====================================================
  // LOAD SCHEDULES
  // =====================================================

  useEffect(() => {
    if (!user) return;

    const schedulesRef = collection(
      db,
      "devices",
      user.uid,
      "schedules"
    );

    const unsubscribe = onSnapshot(
      schedulesRef,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        data.sort((a, b) => {
          const aMinutes =
            Number(a.hour || 0) * 60 +
            Number(a.minute || 0);

          const bMinutes =
            Number(b.hour || 0) * 60 +
            Number(b.minute || 0);

          return aMinutes - bMinutes;
        });

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

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const getTimeText = () => {
    return `${hour}:${String(minute).padStart(
      2,
      "0"
    )} ${period}`;
  };

  // =====================================================
  // OPEN ADD SCHEDULE
  // =====================================================

  const openAddSchedule = () => {
    const now = new Date();

    let currentHour = now.getHours();

    const currentMinute = now.getMinutes();

    const currentPeriod =
      currentHour >= 12 ? "PM" : "AM";

    currentHour = currentHour % 12;

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

  // =====================================================
  // SAVE
  // =====================================================

  const saveSchedule = async () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login first."
      );
      return;
    }

    try {
      setSaving(true);

      let hour24 = hour;

      if (period === "AM") {
        if (hour === 12) {
          hour24 = 0;
        }
      } else {
        if (hour !== 12) {
          hour24 = hour + 12;
        }
      }

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
        "Error",
        "Unable to save schedule."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // TOGGLE
  // =====================================================

  const toggleSchedule = async (item) => {
    if (!user) return;

    try {
      await updateDoc(
        doc(
          db,
          "devices",
          user.uid,
          "schedules",
          item.id
        ),
        {
          enabled: !item.enabled,
        }
      );
    } catch (error) {
      console.log(
        "Toggle error:",
        error
      );
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const deleteSchedule = (item) => {
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

          onPress: async () => {
            try {
              await deleteDoc(
                doc(
                  db,
                  "devices",
                  user.uid,
                  "schedules",
                  item.id
                )
              );
            } catch (error) {
              console.log(
                "Delete error:",
                error
              );
            }
          },
        },
      ]
    );
  };

  // =====================================================
  // HOURS
  // =====================================================

  const hours = [
    1, 2, 3, 4, 5, 6,
    7, 8, 9, 10, 11, 12,
  ];

  // =====================================================
  // MINUTES
  // =====================================================

  const minutes = [
    0, 5, 10, 15,
    20, 25, 30, 35,
    40, 45, 50, 55,
  ];

  return (
    <View style={styles.container}>

      {/* ================= HEADER ================= */}

      <View style={styles.header}>

        <View>
          <Text style={styles.headerTitle}>
            Schedules
          </Text>

          <Text style={styles.headerSubtitle}>
            Automate on/off timing
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddSchedule}
        >
          <Text style={styles.plus}>
            +
          </Text>
        </TouchableOpacity>

      </View>

      {/* ================= LIST ================= */}

      <ScrollView
        style={styles.list}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >

        {schedules.length === 0 ? (

          <View style={styles.empty}>

            <Text style={styles.emptyIcon}>
              ◷
            </Text>

            <Text style={styles.emptyTitle}>
              No schedules yet
            </Text>

            <Text style={styles.emptyText}>
              Tap + to create a schedule
            </Text>

          </View>

        ) : (

          schedules.map((item) => (

            <Pressable
              key={item.id}
              onLongPress={() =>
                deleteSchedule(item)
              }
              style={styles.card}
            >

              <View>

                <Text style={styles.cardTime}>
                  {item.time}
                </Text>

                <View style={styles.chips}>

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

                  <View style={styles.repeatChip}>
                    <Text style={styles.repeatText}>
                      {item.repeat}
                    </Text>
                  </View>

                </View>

              </View>

              <Switch
                value={item.enabled === true}
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

          ))

        )}

      </ScrollView>

      {/* =================================================
          ADD SCHEDULE MODAL
      ================================================= */}

      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setAddModal(false)
        }
      >

        <View style={styles.overlay}>

          <View style={styles.modal}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                Add Schedule
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setAddModal(false)
                }
              >
                <Text style={styles.close}>
                  ×
                </Text>
              </TouchableOpacity>

            </View>

            {/* TIME */}

            <Text style={styles.label}>
              Time
            </Text>

            <TouchableOpacity
              style={styles.timeBox}
              activeOpacity={0.7}
              onPress={() =>
                setTimeModal(true)
              }
            >

              <Text style={styles.timeText}>
                {getTimeText()}
              </Text>

              {/* THIS IS THE CLOCK BUTTON */}

              <View style={styles.clockButton}>

                <Text style={styles.clockIcon}>
                  ◷
                </Text>

              </View>

            </TouchableOpacity>

            {/* ACTION */}

            <Text style={styles.label}>
              Action
            </Text>

            <View style={styles.row}>

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

            <Text style={styles.label}>
              Repeat
            </Text>

            <View style={styles.row}>

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
              style={styles.save}
              onPress={saveSchedule}
              disabled={saving}
            >

              <Text style={styles.saveText}>
                {saving
                  ? "Saving..."
                  : "Save Schedule"}
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

      {/* =================================================
          CUSTOM TIME PICKER
      ================================================= */}

      <Modal
        visible={timeModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setTimeModal(false)
        }
      >

        <View style={styles.timeOverlay}>

          <View style={styles.timePicker}>

            <Text style={styles.pickerTitle}>
              Select Time
            </Text>

            {/* CURRENT TIME */}

            <Text style={styles.bigTime}>
              {getTimeText()}
            </Text>

            {/* HOURS */}

            <Text style={styles.pickerLabel}>
              Hour
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >

              {hours.map((item) => (

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

              ))}

            </ScrollView>

            {/* MINUTES */}

            <Text style={styles.pickerLabel}>
              Minutes
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
            >

              {minutes.map((item) => (

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
                    {String(item).padStart(
                      2,
                      "0"
                    )}
                  </Text>

                </TouchableOpacity>

              ))}

            </ScrollView>

            {/* AM PM */}

            <View style={styles.periodRow}>

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

              <Text style={styles.doneText}>
                Done
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </View>
  );
}

// ==========================================================
// STYLES
// ==========================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  header: {
    backgroundColor: "#3478F6",
    paddingTop:
      Platform.OS === "android" ? 50 : 30,
    paddingBottom: 25,
    paddingHorizontal: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: "#E4ECFF",
    fontSize: 17,
    marginTop: 5,
  },

  addButton: {
    width: 52,
    height: 52,
    borderRadius: 30,
    backgroundColor: "#1556B8",
    justifyContent: "center",
    alignItems: "center",
  },

  plus: {
    color: "#FFFFFF",
    fontSize: 34,
  },

  list: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    minHeight: 95,
    borderRadius: 18,
    marginBottom: 15,
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    elevation: 3,
  },

  cardTime: {
    fontSize: 23,
    fontWeight: "800",
    color: "#182033",
    marginBottom: 8,
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
  },

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

  // ======================================================
  // ADD MODAL
  // ======================================================

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
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

  save: {
    height: 60,
    backgroundColor: "#3478F6",
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  saveText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  // ======================================================
  // CUSTOM TIME PICKER
  // ======================================================

  timeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
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