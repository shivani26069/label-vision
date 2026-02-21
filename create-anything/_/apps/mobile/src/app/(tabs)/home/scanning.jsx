import { View, Text, StatusBar, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useColorScheme } from "react-native";
import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import { useFonts } from "expo-font";
import { CameraView, useCameraPermissions } from "expo-camera";
import { speak } from "@/utils/tts";
import { scanImage, testConnection } from "@/utils/api";
import { useScanStore } from "@/utils/scanStore";
import {
  Inter_600SemiBold,
  Inter_500Medium,
} from "@expo-google-fonts/inter";

export default function ScanningScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { settings, setCurrentScan } = useScanStore();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const captureTimeoutRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [connected, setConnected] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [debugMsg, setDebugMsg] = useState("Camera loading...");

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
  });

  const autoCapturePhoto = async () => {
    if (capturing || !cameraReady || !cameraRef.current) {
      console.log("⚠️ Cannot capture:", { capturing, cameraReady, hasRef: !!cameraRef.current });
      return;
    }

    try {
      setCapturing(true);
      setDebugMsg("📸 Capturing...");
      console.log("📸 Auto-capturing photo...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      console.log("✅ Photo captured:", photo.uri);
      setDebugMsg("Processing...");
      await processImage(photo.uri);
    } catch (error) {
      console.error("❌ Capture error:", error);
      setDebugMsg("❌ Capture error");
      alert("Camera error: " + error.message);
      setCapturing(false);
    }
  };

  const manualCapture = async () => {
    console.log("📸 Manual capture triggered");
    autoCapturePhoto();
  };

  const processImage = async (imageUri) => {
    try {
      console.log("🚀 Processing image...");

      try {
        console.log("📤 Sending to backend...");
        const scanResult = await scanImage(imageUri);
        console.log("✅ Backend response:", scanResult);
        setCurrentScan(scanResult);
        setCapturing(false);
        router.replace("/(tabs)/home/result");
      } catch (apiError) {
        console.error("❌ Backend failed:", apiError);
        alert("Backend error: " + apiError.message);
        setCapturing(false);
      }
    } catch (e) {
      console.error("❌ Process error:", e);
      alert("Error: " + e.message);
      setCapturing(false);
    }
  };

  useEffect(() => {
    console.log("🎬 ScanningScreen mounted");
    
    if (settings.voiceEnabled) {
      speak("Point camera at label to auto-scan");
    }

    if (permission?.status !== "granted") {
      console.log("📹 Requesting camera permission...");
      requestPermission();
    } else {
      console.log("✅ Camera permission already granted");
    }

    testConnection()
      .then(() => {
        console.log("✅ Backend connected");
        setConnected(true);
      })
      .catch((err) => {
        console.error("❌ Backend unreachable:", err);
        setConnected(false);
      });

    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current);
      }
    };
  }, [settings.voiceEnabled, permission?.status, requestPermission]);

  // Reset state when screen comes into focus (after returning from result screen)
  useFocusEffect(
    useCallback(() => {
      console.log("🔄 Screen focused - resetting capture state");
      setCapturing(false);
      setCameraReady(false);
      return () => {
        if (captureTimeoutRef.current) {
          clearTimeout(captureTimeoutRef.current);
        }
      };
    }, [])
  );

  if (!fontsLoaded) {
    return null;
  }

  if (!permission?.granted) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#111827" : "#F9FAFB",
        }}
      >
        <Text style={{ fontSize: 16, marginBottom: 16, color: isDark ? "#FFF" : "#000" }}>
          Camera access required
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#F9FAFB" }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        onCameraReady={() => {
          console.log("📷 Camera onCameraReady fired!");
          setCameraReady(true);
          setDebugMsg("Camera ready - auto-capturing in 2s...");
          console.log("📷 Camera ready - auto-capture will start in 2s");
          captureTimeoutRef.current = setTimeout(() => {
            console.log("⏱️ 2 seconds elapsed, calling autoCapturePhoto");
            autoCapturePhoto();
          }, 2000);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          }}
        >
          <View
            style={{
              width: "80%",
              aspectRatio: 1,
              borderWidth: 3,
              borderColor: "#3B82F6",
              borderRadius: 20,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#3B82F6",
                fontSize: 18,
                fontFamily: "Inter_500Medium",
              }}
            >
              {capturing ? "📸 Scanning..." : "📸 Point at label"}
            </Text>
          </View>

          {/* Manual capture button as backup */}
          <Pressable
            onPress={manualCapture}
            disabled={capturing}
            style={{
              marginTop: 40,
              backgroundColor: "#EF4444",
              paddingHorizontal: 30,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
              {capturing ? "Processing..." : "Tap to Capture"}
            </Text>
          </Pressable>
        </View>
      </CameraView>

      <View
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          alignItems: "center",
        }}
      >
        {/* Debug message */}
        <View style={{ marginBottom: 16, paddingHorizontal: 20 }}>
          <Text style={{ color: "#FFF", fontSize: 12, textAlign: "center" }}>
            {debugMsg}
          </Text>
        </View>

        {connected === false && (
          <View style={{ marginBottom: 12, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AlertCircle size={20} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontSize: 14, flex: 1 }}>
                Backend unreachable
              </Text>
            </View>
          </View>
        )}
        {connected === true && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <CheckCircle size={16} color="#10B981" />
              <Text style={{ color: "#10B981", fontSize: 12 }}>
                Connected
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
