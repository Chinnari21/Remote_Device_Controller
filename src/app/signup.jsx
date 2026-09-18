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

  const [loading, setLoading] = useState(false);


  const handleSignup = async () => {

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password
    ) {
      Alert.alert(
        "Missing Information",
        "Please fill all fields."
      );
      return;
    }


    if (password.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must contain at least 6 characters."
      );
      return;
    }


    try {

      setLoading(true);

      console.log("1. Creating Firebase account...");


      // CREATE ACCOUNT
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


      // IMPORTANT:
      // We are NOT writing Firestore here.
      // Home screen will create devices/{uid}.


      console.log(
        "4. Going to Home..."
      );


      router.replace("/home");

    }

    catch (error) {

      console.log(
        "SIGNUP ERROR:",
        error
      );


      let message = error.message;


      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        message =
          "This email is already registered.";
      }

      else if (
        error.code ===
        "auth/invalid-email"
      ) {
        message =
          "Please enter a valid email.";
      }

      else if (
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

    }

    finally {

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
      >

        <Text style={styles.title}>
          Create Account
        </Text>


        <Text style={styles.subtitle}>
          Register your RemoteSwitch account
        </Text>


        {/* FIRST NAME */}

        <Text style={styles.label}>
          First Name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />


        {/* LAST NAME */}

        <Text style={styles.label}>
          Last Name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />


        {/* EMAIL */}

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />


        {/* PASSWORD */}

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />


        {/* REGISTER */}

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleSignup}
          disabled={loading}
        >

          {loading ? (

            <ActivityIndicator
              color="#FFFFFF"
            />

          ) : (

            <Text style={styles.registerText}>
              Register
            </Text>

          )}

        </TouchableOpacity>


        {/* LOGIN */}

        <TouchableOpacity
          onPress={() => router.replace("/")}
        >

          <Text style={styles.loginText}>
            Already have an account? Login
          </Text>

        </TouchableOpacity>

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
    padding: 25,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222222",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
  },

  registerButton: {
    height: 52,
    backgroundColor: "#3478F6",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },

  registerText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  loginText: {
    textAlign: "center",
    color: "#3478F6",
    marginTop: 20,
    fontSize: 14,
  },

});