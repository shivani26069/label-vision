import { View, Text, useColorScheme } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { X, Camera } from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { successHaptic } from "@/utils/haptics";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
} from "@expo-google-fonts/inter";

export default function ManualScanScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings } = useScanStore();
  const [permission, requestPermission] = useCameraPermissions();

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
  });

  useEffect(() => {
    if (settings.voiceEnabled) {
      speak("Tap anywhere to capture");
    }
  }, []);

  const handleCapture = async () => {
    if (settings.voiceEnabled) {
      speak("Captured");
    }
    if (settings.hapticsEnabled) {
      await successHaptic();
    }
    router.replace("/(tabs)/home/scanning");
  };

  if (!fontsLoaded) {
    return null;
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Camera permission is required to scan labels
        </Text>
        <HapticButton
          onPress={requestPermission}
          style={{
            backgroundColor: "#3B82F6",
            paddingVertical: 14,
            paddingHorizontal: 28,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 18,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Grant Permission
          </Text>
        </HapticButton>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      <CameraView style={{ flex: 1 }} facing="back">
        {/* Close Button */}
        <HapticButton
          onPress={() => router.back()}
          style={{
            position: "absolute",
            top: 50,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <X size={24} color="#FFFFFF" />
        </HapticButton>

        {/* Top Instruction */}
        <View
          style={{
            position: "absolute",
            top: 50,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: "Inter_500Medium",
              color: "#FFFFFF",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
            }}
          >
            Tap anywhere to capture
          </Text>
        </View>

        {/* Capture Button */}
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <HapticButton
            onPress={handleCapture}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#FFFFFF",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 6,
              borderColor: "rgba(255, 255, 255, 0.3)",
            }}
          >
            <Camera size={36} color="#000000" />
          </HapticButton>
        </View>
      </CameraView>
    </View>
  );
}
