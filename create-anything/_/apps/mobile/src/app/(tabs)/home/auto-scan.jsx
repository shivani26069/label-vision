import { View, Text, useColorScheme, Animated } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react-native";
import HapticButton from "@/components/HapticButton";
import { speak } from "@/utils/tts";
import { successHaptic } from "@/utils/haptics";
import { useScanStore } from "@/utils/scanStore";
import {
  useFonts,
  Inter_600SemiBold,
  Inter_500Medium,
} from "@expo-google-fonts/inter";

export default function AutoScanScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings } = useScanStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const timerRef = useRef(null);

  const glowAnimation = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
  });

  useEffect(() => {
    if (settings.voiceEnabled) {
      speak("Hold steady. Auto scan is active.");
    }

    // Simulate label detection after 3 seconds
    timerRef.current = setTimeout(async () => {
      if (settings.voiceEnabled) {
        speak("Label detected");
      }
      if (settings.hapticsEnabled) {
        await successHaptic();
      }
      setIsScanning(false);
      router.replace("/(tabs)/home/scanning");
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Glowing animation for scan zone
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

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

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.9],
  });

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

        {/* Top Status Text */}
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
            Hold steady...
          </Text>
        </View>

        {/* Scan Zone with Glowing Border */}
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <View style={{ position: "relative" }}>
            {/* Background rectangle */}
            <View
              style={{
                width: 280,
                height: 200,
                borderRadius: 16,
                borderWidth: 3,
                borderColor: "rgba(255, 255, 255, 0.4)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
              }}
            />

            {/* Glowing corners */}
            <Animated.View
              style={{
                position: "absolute",
                top: -4,
                left: -4,
                width: 40,
                height: 40,
                borderTopWidth: 4,
                borderLeftWidth: 4,
                borderColor: "#3B82F6",
                borderTopLeftRadius: 16,
                opacity: glowOpacity,
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 40,
                height: 40,
                borderTopWidth: 4,
                borderRightWidth: 4,
                borderColor: "#3B82F6",
                borderTopRightRadius: 16,
                opacity: glowOpacity,
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                bottom: -4,
                left: -4,
                width: 40,
                height: 40,
                borderBottomWidth: 4,
                borderLeftWidth: 4,
                borderColor: "#3B82F6",
                borderBottomLeftRadius: 16,
                opacity: glowOpacity,
              }}
            />
            <Animated.View
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 40,
                height: 40,
                borderBottomWidth: 4,
                borderRightWidth: 4,
                borderColor: "#3B82F6",
                borderBottomRightRadius: 16,
                opacity: glowOpacity,
              }}
            />
          </View>
        </View>

        {/* Bottom Status Bar */}
        <View
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.9)",
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 24,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Inter_600SemiBold",
                color: "#FFFFFF",
              }}
            >
              Auto Scan Active
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
