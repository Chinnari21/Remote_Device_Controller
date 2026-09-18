import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { loginUser } from '../services/auth';
import { registerForPushNotifications } from '../services/notifications';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (email.trim() === '') {
      alert('Please enter your email');
      return;
    }

    if (password === '') {
      alert('Please enter your password');
      return;
    }

    try {
      // Firebase Login
      const userCredential = await loginUser(
        email.trim(),
        password
      );

      const uid = userCredential.user.uid;

      console.log('Login successful:', uid);

      // Request notification permission
      // and generate FCM token
      const fcmToken = await registerForPushNotifications();

      if (fcmToken) {
        console.log('FCM Token:', fcmToken);
      } else {
        console.log('FCM token was not generated.');
      }

      // Login successful → Home
      router.replace('/home');

    } catch (error) {
      console.log('Login error:', error);

      if (error?.code === 'auth/invalid-credential') {
        alert('Invalid email or password');
      } else if (error?.code === 'auth/user-not-found') {
        alert('User not found');
      } else if (error?.code === 'auth/wrong-password') {
        alert('Incorrect password');
      } else {
        alert('Login failed. Please try again.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginBox}>

        <Text style={styles.title}>
          Remote Desktop Switch
        </Text>

        <Text style={styles.subtitle}>
          Login to continue
        </Text>

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#888"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>
          Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#888888"
          secureTextEntry={true}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          keyboardType="default"
          importantForAutofill="no"
        />

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
        >
          <Text style={styles.loginButtonText}>
            Login
          </Text>
        </TouchableOpacity>

        <TouchableOpacity>
          <Text style={styles.forgotPassword}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>
            Don't have an account?
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.registerButton}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loginBox: {
    width: '90%',
    maxWidth: 450,
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 20,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 10,

    elevation: 5,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1f2937',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 30,
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    color: '#111111',
  },

  loginButton: {
    height: 50,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },

  loginButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  forgotPassword: {
    textAlign: 'center',
    color: '#2563eb',
    fontSize: 14,
    marginTop: 18,
  },

  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },

  registerText: {
    color: '#6b7280',
    fontSize: 14,
  },

  registerButton: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});