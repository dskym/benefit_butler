// frontend/src/navigation/index.tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { OfflineBanner } from "../components/OfflineBanner";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import TransactionListScreen from "../screens/transactions/TransactionListScreen";
import AnalysisScreen from "../screens/analysis/AnalysisScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import CategoryListScreen from "../screens/categories/CategoryListScreen";
import CardListScreen from "../screens/settings/CardListScreen";
import PrivacyPolicyScreen from "../screens/settings/PrivacyPolicyScreen";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";

const AuthStack = createNativeStackNavigator();
const MainTab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{
          title: "카테고리 관리",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
      <SettingsStack.Screen
        name="CardList"
        component={CardListScreen}
        options={{
          title: "카드 관리",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
      <SettingsStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: "개인정보 처리방침",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
    </SettingsStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          paddingBottom: 4,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text.hint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === "가계부") {
            iconName = focused ? "list" : "list-outline";
          } else if (route.name === "분석") {
            iconName = focused ? "bar-chart" : "bar-chart-outline";
          } else {
            iconName = focused ? "settings" : "settings-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen name="가계부" component={TransactionListScreen} />
      <MainTab.Screen name="분석" component={AnalysisScreen} />
      <MainTab.Screen name="설정" component={SettingsNavigator} />
    </MainTab.Navigator>
  );
}

export default function RootNavigation() {
  const { user, isLoading } = useAuthStore();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (isOnline) {
      fetchMe();
    } else {
      useAuthStore.setState({ isLoading: false });
    }
  }, []);

  if (isLoading) return null;

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {user !== null ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <OfflineBanner isOnline={isOnline} />
    </View>
  );
}
