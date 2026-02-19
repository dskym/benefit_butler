// frontend/src/navigation/index.tsx
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import TransactionListScreen from "../screens/transactions/TransactionListScreen";
import CategoryListScreen from "../screens/categories/CategoryListScreen";
import { useAuthStore } from "../store/authStore";

const AuthStack = createNativeStackNavigator();
const MainTab = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator>
      <MainTab.Screen name="Dashboard" component={DashboardScreen} />
      <MainTab.Screen name="Transactions" component={TransactionListScreen} />
      <MainTab.Screen name="Categories" component={CategoryListScreen} />
    </MainTab.Navigator>
  );
}

export default function RootNavigation() {
  const { user, isLoading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, []);

  if (isLoading) return null;

  return (
    <NavigationContainer>
      {user !== null ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
