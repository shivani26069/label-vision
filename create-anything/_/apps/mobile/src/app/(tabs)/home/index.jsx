import { View, Text, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Scan, History, Settings } from "lucide-react-native";
import { useEffect } from "react";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
} from "@expo-google-fonts/inter";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings } = useScanStore();

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
  });

  useEffect(() => {
    if (settings.voiceEnabled) {
      speak("Welcome to Label Vision Assistant");
    }
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#FFFFFF" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 20 }}
      >
        {/* Header */}
        <Text
          style={{
            fontSize: 32,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
            marginBottom: 12,
          }}
        >
          Label Vision
        </Text>
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Inter_500Medium",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 60,
          }}
        >
          Tap anywhere to scan a product label
        </Text>

        {/* Auto Scan Button */}
        <HapticButton
          onPress={() => {
            if (settings.voiceEnabled) {
              speak("Auto Scan activated");
            }
            router.push("/(tabs)/home/auto-scan");
          }}
          style={{
            backgroundColor: "#3B82F6",
            borderRadius: 16,
            paddingVertical: 28,
            alignItems: "center",
            marginBottom: 20,
            shadowColor: "#3B82F6",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Scan size={40} color="#FFFFFF" />
          <Text
            style={{
              fontSize: 24,
              fontFamily: "Inter_600SemiBold",
              color: "#FFFFFF",
              marginTop: 12,
            }}
          >
            Auto Scan
          </Text>
        </HapticButton>

        {/* Secondary Buttons */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
          <HapticButton
            onPress={() => router.push("/(tabs)/history")}
            style={{
              flex: 1,
              backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
              borderRadius: 12,
              paddingVertical: 20,
              alignItems: "center",
            }}
          >
            <History size={32} color={isDark ? "#FFFFFF" : "#000000"} />
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Inter_500Medium",
                color: isDark ? "#FFFFFF" : "#000000",
                marginTop: 8,
              }}
            >
              History
            </Text>
          </HapticButton>

          <HapticButton
            onPress={() => router.push("/(tabs)/settings")}
            style={{
              flex: 1,
              backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
              borderRadius: 12,
              paddingVertical: 20,
              alignItems: "center",
            }}
          >
            <Settings size={32} color={isDark ? "#FFFFFF" : "#000000"} />
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Inter_500Medium",
                color: isDark ? "#FFFFFF" : "#000000",
                marginTop: 8,
              }}
            >
              Settings
            </Text>
          </HapticButton>
        </View>
      </View>
    </View>
  );
}
