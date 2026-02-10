import { View, Text, useColorScheme, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ArrowLeft, Volume2 } from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
  Inter_400Regular,
} from "@expo-google-fonts/inter";

export default function FullLabelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { currentScan } = useScanStore();

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
  });

  if (!fontsLoaded || !currentScan) {
    return null;
  }

  const playFullLabel = () => {
    const fullText = currentScan.rawText || `${currentScan.product}. Manufactured ${currentScan.mfgDate}. Expires ${currentScan.expiry}. Ingredients: ${currentScan.ingredients.join(", ")}. ${currentScan.warnings.length > 0 ? "Warnings: " + currentScan.warnings.join(". ") : "No warnings"}.`;
    speak(fullText);
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
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <HapticButton onPress={() => router.back()} style={{ marginRight: 12 }}>
          <ArrowLeft size={28} color={isDark ? "#FFFFFF" : "#000000"} />
        </HapticButton>
        <Text
          style={{
            fontSize: 24,
            fontFamily: "Inter_600SemiBold",
            color: isDark ? "#FFFFFF" : "#000000",
            flex: 1,
          }}
        >
          Full Label
        </Text>
        <HapticButton onPress={playFullLabel}>
          <Volume2 size={28} color="#3B82F6" />
        </HapticButton>
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
        {/* Summary Line (minimal display) */}
        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Inter_500Medium",
              color: isDark ? "#9CA3AF" : "#6B7280",
              marginBottom: 8,
            }}
          >
            Summary
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              lineHeight: 28,
            }}
          >
            {currentScan.summary || `${currentScan.product}. Expires ${currentScan.expiry}.`}
          </Text>
        </View>

        {/* Confidence */}
        {currentScan.confidence && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 16,
                fontFamily: "Inter_500Medium",
                color: isDark ? "#9CA3AF" : "#6B7280",
                marginBottom: 8,
              }}
            >
              Scan Confidence
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontFamily: "Inter_600SemiBold",
                color: "#3B82F6",
              }}
            >
              {(currentScan.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
