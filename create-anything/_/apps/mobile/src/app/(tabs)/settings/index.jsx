import {
  View,
  Text,
  useColorScheme,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Vibrate, Volume2, Scan, Globe, Trash2 } from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { mediumHaptic } from "@/utils/haptics";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
  Inter_400Regular,
} from "@expo-google-fonts/inter";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings, updateSettings, clearHistory, scans } = useScanStore();

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleToggle = async (key, value) => {
    if (settings.hapticsEnabled && key !== "hapticsEnabled") {
      await mediumHaptic();
    }
    updateSettings({ [key]: value });
    if (key === "voiceEnabled" && value) {
      speak("Voice enabled");
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      `Are you sure you want to delete all ${scans.length} scan${scans.length !== 1 ? "s" : ""}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            clearHistory();
            if (settings.hapticsEnabled) {
              await mediumHaptic();
            }
            if (settings.voiceEnabled) {
              speak("History cleared");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#FFFFFF" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
          }}
        >
          Settings
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Scan Settings */}
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Scan Settings
        </Text>

        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? "#333333" : "#E5E7EB",
            }}
          >
            <Scan size={24} color={isDark ? "#FFFFFF" : "#000000"} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#FFFFFF" : "#000000",
                  marginBottom: 2,
                }}
              >
                Auto-Scan
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                }}
              >
                Enable automatic label detection
              </Text>
            </View>
            <Switch
              value={settings.autoScanEnabled}
              onValueChange={(value) => handleToggle("autoScanEnabled", value)}
              trackColor={{ false: "#D1D5DB", true: "#60A5FA" }}
              thumbColor={settings.autoScanEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: isDark ? "#333333" : "#E5E7EB",
            }}
          >
            <Vibrate size={24} color={isDark ? "#FFFFFF" : "#000000"} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#FFFFFF" : "#000000",
                  marginBottom: 2,
                }}
              >
                Haptic Feedback
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                }}
              >
                Vibrate on actions
              </Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={(value) => handleToggle("hapticsEnabled", value)}
              trackColor={{ false: "#D1D5DB", true: "#60A5FA" }}
              thumbColor={settings.hapticsEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Volume2 size={24} color={isDark ? "#FFFFFF" : "#000000"} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#FFFFFF" : "#000000",
                  marginBottom: 2,
                }}
              >
                Voice Announcements
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                }}
              >
                Speak scan results aloud
              </Text>
            </View>
            <Switch
              value={settings.voiceEnabled}
              onValueChange={(value) => handleToggle("voiceEnabled", value)}
              trackColor={{ false: "#D1D5DB", true: "#60A5FA" }}
              thumbColor={settings.voiceEnabled ? "#3B82F6" : "#F3F4F6"}
            />
          </View>
        </View>

        {/* Language Settings */}
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Language
        </Text>

        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
            borderRadius: 12,
            marginBottom: 24,
            opacity: 0.5,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Globe size={24} color={isDark ? "#FFFFFF" : "#000000"} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#FFFFFF" : "#000000",
                  marginBottom: 2,
                }}
              >
                English (US)
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Inter_400Regular",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                }}
              >
                More languages coming soon
              </Text>
            </View>
          </View>
        </View>

        {/* Data Settings */}
        <Text
          style={{
            fontSize: 14,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#9CA3AF" : "#6B7280",
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Data
        </Text>

        <HapticButton
          onPress={handleClearHistory}
          disabled={scans.length === 0}
          style={{
            backgroundColor:
              scans.length === 0 ? (isDark ? "#1E1E1E" : "#F6F6F6") : "#FEF2F2",
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            opacity: scans.length === 0 ? 0.5 : 1,
          }}
        >
          <Trash2
            size={24}
            color={
              scans.length === 0 ? (isDark ? "#6B7280" : "#9CA3AF") : "#EF4444"
            }
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Inter_500Medium",
                color:
                  scans.length === 0
                    ? isDark
                      ? "#6B7280"
                      : "#9CA3AF"
                    : "#EF4444",
                marginBottom: 2,
              }}
            >
              Clear History
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: isDark ? "#9CA3AF" : "#6B7280",
              }}
            >
              {scans.length === 0
                ? "No scans to clear"
                : `Delete ${scans.length} scan${scans.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
        </HapticButton>
      </ScrollView>
    </View>
  );
}
