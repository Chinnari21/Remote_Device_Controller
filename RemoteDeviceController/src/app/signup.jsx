import React, { useState } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { useRouter } from "expo-router";

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import { auth } from "../../firebaseConfig";

export default function Signup() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Check empty fields
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        "Missing Information",
        "Please fill all fields."
      );
      return;
    }

    // Password length
    if (password.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must contain at least 6 characters."
      );
      return;
    }

    // Confirm password
    if (password !== confirmPassword) {
      Alert.alert(
        "Password Mismatch",
        "Password and Confirm Password must be the same."
      );
      return;
    }

    try {
      setLoading(true);

      console.log("1. Creating Firebase account...");

      // CREATE FIREBASE ACCOUNT
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const user = userCredential.user;

      console.log(
        "2. Account created:",
        user.uid
      );

      // SAVE FIRST NAME + LAST NAME
      const fullName =
        `${firstName.trim()} ${lastName.trim()}`;

      await updateProfile(user, {
        displayName: fullName,
      });

      console.log(
        "3. Name saved:",
        fullName
      );

      // Go to Home
      console.log("4. Going to Home...");

      router.replace("/home");
    } catch (error) {
      console.log(
        "SIGNUP ERROR:",
        error
      );

      let message =
        "Something went wrong. Please try again.";

      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        message =
          "This email is already registered.";
      } else if (
        error.code ===
        "auth/invalid-email"
      ) {
        message =
          "Please enter a valid email.";
      } else if (
        error.code ===
        "auth/weak-password"
      ) {
        message =
          "Password must contain at least 6 characters.";
      }

      Alert.alert(
        "Registration Error",
        message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* TITLE */}

        <Text style={styles.title}>
          Create Account
        </Text>


        {/* FIRST NAME */}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            First Name
          </Text>

          <TextInput
            style={styles.input}
            placeholder=""
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>


        {/* LAST NAME */}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Last Name
          </Text>

          <TextInput
            style={styles.input}
            placeholder=""
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>


        {/* EMAIL */}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            placeholder=""
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>


        {/* PASSWORD */}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder=""
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>


        {/* CONFIRM PASSWORD */}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Confirm Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder=""
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>


        {/* SIGN UP BUTTON */}

        <TouchableOpacity
          style={[
            styles.registerButton,
            loading && styles.disabledButton,
          ]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.registerText}>
              Sign Up
            </Text>
          )}
        </TouchableOpacity>


        {/* LOGIN ROW */}

        <View style={styles.loginRow}>
          <Text style={styles.accountText}>
            Already have an account?
          </Text>

          <TouchableOpacity
            onPress={() => router.replace("/")}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>
              Login
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 35,
  },

  title: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 30,
  },

  fieldContainer: {
    marginBottom: 17,
  },

  label: {
    fontSize: 12,
    color: "#333333",
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 9,
    paddingHorizontal: 14,
    backgroundColor: "#F8F8F9",
    fontSize: 14,
    color: "#222222",
  },

  registerButton: {
    height: 50,
    backgroundColor: "#3478F6",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 3,
  },

  disabledButton: {
    opacity: 0.7,
  },

  registerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  accountText: {
    fontSize: 12,
    color: "#777777",
  },

  loginText: {
    fontSize: 12,
    color: "#3478F6",
    fontWeight: "600",
    marginLeft: 8,
  },
});