// frontend/src/navigation/index.tsx
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { OfflineBanner } from "../components/OfflineBanner";
import { Toast } from "../components/Toast";
import { useSyncStatusStore } from "../store/syncStatusStore";
import { usePendingMutationsStore } from "../store/pendingMutationsStore";
import { useSmsAutoImport } from "../hooks/useSmsAutoImport";
import { usePushAutoImport } from "../hooks/usePushAutoImport";

import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import VerifyEmailScreen from "../screens/auth/VerifyEmailScreen";
import TransactionListScreen from "../screens/transactions/TransactionListScreen";
import AnalysisScreen from "../screens/analysis/AnalysisScreen";
import CardPerformanceScreen from "../screens/analysis/CardPerformanceScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import CategoryListScreen from "../screens/categories/CategoryListScreen";
import CardListScreen from "../screens/settings/CardListScreen";
import PrivacyPolicyScreen from "../screens/settings/PrivacyPolicyScreen";
import ImportScreen from "../screens/settings/ImportScreen";
import ExportScreen from "../screens/settings/ExportScreen";
import CardRecommendScreen from "../screens/benefit/CardRecommendScreen";
import CardBenefitEditScreen from "../screens/benefit/CardBenefitEditScreen";
import { useAuthStore } from "../store/authStore";
import { theme } from "../theme";

const AuthStack = createNativeStackNavigator();
const MainTab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();
const AnalysisStack = createNativeStackNavigator();
const BenefitStack = createNativeStackNavigator();

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
      <SettingsStack.Screen
        name="Import"
        component={ImportScreen}
        options={{
          title: "Excel 가져오기",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
      <SettingsStack.Screen
        name="Export"
        component={ExportScreen}
        options={{
          title: "Excel 내보내기",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
    </SettingsStack.Navigator>
  );
}

function AnalysisNavigator() {
  return (
    <AnalysisStack.Navigator>
      <AnalysisStack.Screen
        name="AnalysisMain"
        component={AnalysisScreen}
        options={{ headerShown: false }}
      />
      <AnalysisStack.Screen
        name="CardPerformance"
        component={CardPerformanceScreen}
        options={{
          title: "카드 실적",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
    </AnalysisStack.Navigator>
  );
}

function BenefitNavigator() {
  return (
    <BenefitStack.Navigator>
      <BenefitStack.Screen
        name="CardRecommend"
        component={CardRecommendScreen}
        options={{ headerShown: false }}
      />
      <BenefitStack.Screen
        name="CardBenefitEdit"
        component={CardBenefitEditScreen}
        options={{
          title: "카드 혜택 관리",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text.primary, fontWeight: "700" },
        }}
      />
    </BenefitStack.Navigator>
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
          } else if (route.name === "혜택") {
            iconName = focused ? "gift" : "gift-outline";
          } else {
            iconName = focused ? "settings" : "settings-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen name="가계부" component={TransactionListScreen} />
      <MainTab.Screen name="분석" component={AnalysisNavigator} />
      <MainTab.Screen name="혜택" component={BenefitNavigator} />
      <MainTab.Screen name="설정" component={SettingsNavigator} />
    </MainTab.Navigator>
  );
}

export default function RootNavigation() {
  useSmsAutoImport();    // Android 전용, 내부 Platform 가드 있음
  usePushAutoImport();   // Android 전용, 내부 Platform 가드 있음
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuthStore();
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const { isOnline } = useNetworkStatus();
  const isSyncing = useSyncStatusStore((s) => s.isSyncing);
  const pendingCount = usePendingMutationsStore((s) => s.queue.length);

  useEffect(() => {
    if (isOnline) {
      fetchMe();
    } else {
      useAuthStore.setState({ isLoading: false });
    }
  }, []);

  if (isLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <NavigationContainer>
        {user !== null
          ? user.is_email_verified
            ? <MainNavigator />
            : <VerifyEmailScreen />
          : <AuthNavigator />
        }
      </NavigationContainer>
      <OfflineBanner isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
      <Toast />
    </View>
  );
}
