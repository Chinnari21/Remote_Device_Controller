import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="signup"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="alerts"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="schedule"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="logs"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}