import { View, Text, useColorScheme, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Clock, Package } from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { useScanStore } from "@/utils/scanStore";
import { getHistory } from "@/utils/api";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
  Inter_400Regular,
} from "@expo-google-fonts/inter";
import { useState, useEffect } from "react";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { scans, setCurrentScan, setScans } = useScanStore();
  const [remoteScans, setRemoteScans] = useState([]);
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
  });

  useEffect(() => {
    const loadRemoteHistory = async () => {
      setLoading(true);
      try {
        const data = await getHistory();
        setRemoteScans(data);
      } catch (e) {
        console.error('Failed to load remote history:', e);
      } finally {
        setLoading(false);
      }
    };
    loadRemoteHistory();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleScanPress = (scan) => {
    // Use actual backend data
    const normalized = {
      id: scan.id,
      product_name: scan.productName || 'Unknown Product',
      brand: scan.brand || 'Unknown Brand',
      confidence: scan.confidence || 0,
      scannedAt: scan.scannedAt,
    };
    setCurrentScan(normalized);
    router.push("/(tabs)/home/result");
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
          History
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {remoteScans.length === 0 && !loading ? (
          /* Empty State */
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingVertical: 60,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isDark ? "#1E1E1E" : "#F8F9FA",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Clock size={32} color={isDark ? "#6B7280" : "#9CA3AF"} />
            </View>

            <Text
              style={{
                fontSize: 20,
                fontFamily: "Inter_600SemiBold",
                color: isDark ? "#FFFFFF" : "#000000",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              No Scans Yet
            </Text>

            <Text
              style={{
                fontSize: 16,
                fontFamily: "Inter_400Regular",
                color: isDark ? "#9CA3AF" : "#6B7280",
                textAlign: "center",
                lineHeight: 24,
                paddingHorizontal: 40,
              }}
            >
              Your scan history will appear here once you scan your first label
            </Text>
          </View>
        ) : (
          /* History List */
          <View style={{ paddingTop: 16 }}>
            {remoteScans.map((scan) => (
              <HapticButton
                key={scan.id}
                onPress={() => handleScanPress(scan)}
                style={{
                  backgroundColor: isDark ? "#1E1E1E" : "#F6F6F6",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark ? "#333333" : "#E5E7EB",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 16,
                  }}
                >
                  <Package size={24} color="#3B82F6" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Inter_600SemiBold",
                      color: isDark ? "#FFFFFF" : "#000000",
                      marginBottom: 4,
                    }}
                  >
                    {scan.productName || 'Unknown Product'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Inter_400Regular",
                      color: isDark ? "#9CA3AF" : "#6B7280",
                      marginBottom: 6,
                    }}
                  >
                    {scan.brand && `${scan.brand} • `}
                    {scan.confidence ? `${(scan.confidence * 100).toFixed(0)}% confidence` : 'No data'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: isDark ? "#6B7280" : "#9CA3AF",
                    }}
                  >
                    {formatDate(scan.scannedAt)}
                  </Text>
                </View>
              </HapticButton>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
