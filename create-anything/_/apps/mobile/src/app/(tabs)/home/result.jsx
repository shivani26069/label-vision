import { View, Text, useColorScheme, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Volume2,
  FileText,
  RotateCcw,
  AlertTriangle,
} from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { successHaptic } from "@/utils/haptics";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
  Inter_400Regular,
} from "@expo-google-fonts/inter";

export default function ResultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings, currentScan, addScan } = useScanStore();

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
  });

  // Determine if scan failed
  const isFailed = !currentScan?.product_name || currentScan?.confidence === 0;

  useEffect(() => {
    if (currentScan) {
      console.log("📍 ResultScreen mounted with currentScan:", JSON.stringify(currentScan, null, 2));
      console.log("📊 Ingredients on result screen:", currentScan.ingredients);
      console.log("📊 Ingredients count:", currentScan.ingredients?.length);
      console.log("📊 Brand:", currentScan.brand);
      console.log("📊 Product name:", currentScan.product_name);
      console.log("📊 Is Failed?:", isFailed);
      
      addScan(currentScan);

      if (settings.hapticsEnabled) {
        successHaptic();
      }

      if (settings.voiceEnabled) {
        if (isFailed) {
          speak(currentScan.failure_reason || "Scan failed. Unable to read label.");
        } else {
          const summary = `Product: ${currentScan.product_name || "Unknown"}. ${
            currentScan.brand ? `Brand: ${currentScan.brand}. ` : ""
          }${currentScan.expiry_date ? `Expires: ${currentScan.expiry_date}. ` : ""}${
            currentScan.warnings?.length > 0 ? "Warning: " + currentScan.warnings.join(". ") : "No warnings"
          }`;
          speak(summary);
        }
      }
    }
  }, [currentScan]);

  if (!fontsLoaded || !currentScan) {
    return null;
  }

  const playSummary = () => {
    if (isFailed) {
      speak(currentScan.failure_reason || "Scan failed. Unable to read label.");
    } else {
      const summary = `Product: ${currentScan.product_name || "Unknown"}. ${
        currentScan.brand ? `Brand: ${currentScan.brand}. ` : ""
      }${currentScan.expiry_date ? `Expires: ${currentScan.expiry_date}. ` : ""}${
        currentScan.warnings?.length > 0 ? "Warning: " + currentScan.warnings.join(". ") : "No warnings"
      }`;
      speak(summary);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)",
      }}
    >
      <StatusBar style="light" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Result Card */}
        <View
          style={{
            backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
            borderRadius: 20,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
        {/* Header */}
          <Text
            style={{
              fontSize: 28,
              fontFamily: "Inter_600SemiBold",
              color: isDark ? "#FFFFFF" : "#000000",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            {isFailed ? "⚠️ Scan Issue" : "✅ Scan Results"}
          </Text>

          {/* Failure Message */}
          {isFailed ? (
            <View
              style={{
                backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                flexDirection: "row",
              }}
            >
              <AlertTriangle
                size={24}
                color={isDark ? "#FCA5A5" : "#DC2626"}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Inter_600SemiBold",
                    color: isDark ? "#FCA5A5" : "#DC2626",
                    marginBottom: 4,
                  }}
                >
                  Unable to read label
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Inter_400Regular",
                    color: isDark ? "#FECACA" : "#EF4444",
                    lineHeight: 20,
                  }}
                >
                  {currentScan.failure_reason || "Please try again with a clearer image"}
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Summary Line */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: "Inter_500Medium",
                    color: isDark ? "#9CA3AF" : "#6B7280",
                    marginBottom: 6,
                  }}
                >
                  Product
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Inter_600SemiBold",
                    color: isDark ? "#FFFFFF" : "#000000",
                    lineHeight: 28,
                  }}
                >
                  {currentScan.product_name || "Unknown Product"}
                </Text>
              </View>

              {/* Brand */}
              {currentScan.brand && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#9CA3AF" : "#6B7280",
                      marginBottom: 6,
                    }}
                  >
                    Brand
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#D1D5DB" : "#374151",
                    }}
                  >
                    {currentScan.brand}
                  </Text>
                </View>
              )}

              {/* Expiry Date */}
              {currentScan.expiry_date && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#9CA3AF" : "#6B7280",
                      marginBottom: 6,
                    }}
                  >
                    Expiry Date
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Inter_600SemiBold",
                      color: "#EF4444",
                    }}
                  >
                    {currentScan.expiry_date}
                  </Text>
                </View>
              )}

              {/* Warnings */}
              {currentScan.warnings && currentScan.warnings.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#9CA3AF" : "#6B7280",
                      marginBottom: 8,
                    }}
                  >
                    Warnings
                  </Text>
                  {currentScan.warnings.map((warning, idx) => (
                    <Text
                      key={idx}
                      style={{
                        fontSize: 14,
                        fontFamily: "Inter_400Regular",
                        color: "#F59E0B",
                        marginBottom: 4,
                        paddingLeft: 8,
                      }}
                    >
                      • {warning}
                    </Text>
                  ))}
                </View>
              )}

              {/* Ingredients */}
              {currentScan.ingredients && currentScan.ingredients.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Inter_500Medium",
                      color: isDark ? "#9CA3AF" : "#6B7280",
                      marginBottom: 8,
                    }}
                  >
                    Ingredients
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Inter_400Regular",
                      color: isDark ? "#D1D5DB" : "#374151",
                      lineHeight: 20,
                    }}
                  >
                    {currentScan.ingredients.join(", ")}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Confidence */}
          {currentScan.confidence !== undefined && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_500Medium",
                  color: isDark ? "#9CA3AF" : "#6B7280",
                  marginBottom: 6,
                }}
              >
                Confidence
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: "Inter_600SemiBold",
                  color:
                    currentScan.confidence > 0.7
                      ? "#10B981"
                      : currentScan.confidence > 0.4
                      ? "#F59E0B"
                      : "#EF4444",
                }}
              >
                {(currentScan.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 12 }}>
            <HapticButton
              onPress={playSummary}
              style={{
                backgroundColor: "#3B82F6",
                borderRadius: 12,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Volume2 size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_600SemiBold",
                  color: "#FFFFFF",
                }}
              >
                {isFailed ? "Hear Details" : "Play Summary"}
              </Text>
            </HapticButton>

            {!isFailed && (
              <HapticButton
                onPress={() => router.push("/(tabs)/home/full-label")}
                style={{
                  backgroundColor: isDark ? "#333333" : "#F6F6F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText
                  size={24}
                  color={isDark ? "#FFFFFF" : "#000000"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Inter_600SemiBold",
                    color: isDark ? "#FFFFFF" : "#000000",
                  }}
                >
                  View Full Label
                </Text>
              </HapticButton>
            )}

            <HapticButton
              onPress={() => router.push("/(tabs)/home")}
              style={{
                backgroundColor: isDark ? "#333333" : "#F6F6F6",
                borderRadius: 12,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RotateCcw
                size={24}
                color={isDark ? "#FFFFFF" : "#000000"}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Inter_600SemiBold",
                  color: isDark ? "#FFFFFF" : "#000000",
                }}
              >
                {isFailed ? "Scan Again" : "Scan Another"}
              </Text>
            </HapticButton>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
