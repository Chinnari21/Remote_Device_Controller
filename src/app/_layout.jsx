import React from "react";
import { View, StyleSheet } from "react-native";
import { Stack, usePathname, router } from "expo-router";

import {
  TouchableOpacity,
  Text,
} from "react-native";

export default function RootLayout() {

  const pathname = usePathname();

  // Login and Signup should NOT have bottom navigation
  const isAuthScreen =
    pathname === "/" ||
    pathname === "/signup";

  return (
    <View style={styles.container}>

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      {!isAuthScreen && (
        <BottomNavigation />
      )}

    </View>
  );
}


// ============================================================
// BOTTOM NAVIGATION
// ============================================================

function BottomNavigation() {

  const pathname = usePathname();

  const goTo = (path) => {
    router.replace(path);
  };

  return (
    <View style={styles.bottomNav}>

      {/* HOME */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => goTo("/home")}
      >
        <Text
          style={[
            styles.navIcon,
            pathname === "/home" &&
              styles.activeIcon,
          ]}
        >
          ⌂
        </Text>

        <Text
          style={[
            styles.navText,
            pathname === "/home" &&
              styles.activeText,
          ]}
        >
          Home
        </Text>
      </TouchableOpacity>


      {/* SCHEDULE */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => goTo("/schedule")}
      >
        <Text
          style={[
            styles.navIcon,
            pathname === "/schedule" &&
              styles.activeIcon,
          ]}
        >
          ◷
        </Text>

        <Text
          style={[
            styles.navText,
            pathname === "/schedule" &&
              styles.activeText,
          ]}
        >
          Schedule
        </Text>
      </TouchableOpacity>


      {/* ALERTS */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => goTo("/alerts")}
      >
        <Text
          style={[
            styles.navIcon,
            pathname === "/alerts" &&
              styles.activeIcon,
          ]}
        >
          ♧
        </Text>

        <Text
          style={[
            styles.navText,
            pathname === "/alerts" &&
              styles.activeText,
          ]}
        >
          Alerts
        </Text>
      </TouchableOpacity>


      {/* LOGS */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => goTo("/logs")}
      >
        <Text
          style={[
            styles.navIcon,
            pathname === "/logs" &&
              styles.activeIcon,
          ]}
        >
          ▥
        </Text>

        <Text
          style={[
            styles.navText,
            pathname === "/logs" &&
              styles.activeText,
          ]}
        >
          Logs
        </Text>
      </TouchableOpacity>

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  bottomNav: {
    height: 82,
    backgroundColor: "#FFFFFF",

    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",

    flexDirection: "row",

    justifyContent: "space-around",
    alignItems: "center",

    paddingBottom: 6,
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  navIcon: {
    fontSize: 27,
    color: "#A5ACB8",
    lineHeight: 30,
  },

  navText: {
    fontSize: 13,
    color: "#A5ACB8",
    marginTop: 3,
  },

  activeIcon: {
    color: "#3478F6",
  },

  activeText: {
    color: "#3478F6",
    fontWeight: "700",
  },

});