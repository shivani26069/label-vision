import { View, Text, StatusBar, Pressable, ActivityIndicator } from "react-native";
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
  const autoCaptureDoneRef = useRef(false); // Prevent duplicate auto-captures
  const cameraReadyRef = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const [connected, setConnected] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [debugMsg, setDebugMsg] = useState("Camera loading...");
  
  // Multi-photo state
  const [photos, setPhotos] = useState([]); // Array of captured photo URIs
  const [photoMode, setPhotoMode] = useState("initial"); // initial, capturing_more, reviewing
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("uploading"); // uploading, ocr, gemini, complete
  const [uploadProgress, setUploadProgress] = useState(0);

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
  });

  const capturePhoto = async () => {
    if (capturing || !cameraReadyRef.current || !cameraRef.current) {
      console.log("⚠️ Cannot capture:", {
        capturing,
        cameraReady: cameraReadyRef.current,
        hasRef: !!cameraRef.current,
      });
      return;
    }

    try {
      setCapturing(true);
      setDebugMsg("📸 Capturing...");
      console.log("📸 Capturing photo...");

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, // REDUCED from 0.8 - 60% faster processing & upload
        base64: false,
      });

      console.log("✅ Photo captured:", photo.uri);
      const updatedPhotos = [...photos, photo.uri];
      setPhotos(updatedPhotos);
      setCapturing(false);
      
      // First photo: ask user to capture more
      if (updatedPhotos.length === 1) {
        console.log("📸 First photo captured - asking for more");
        setPhotoMode("capturing_more");
        setDebugMsg(`✅ Captured ${updatedPhotos.length} photo - Capture more angles?`);
        if (settings.voiceEnabled) {
          speak(`Got front label. Now capture back, sides, or nutrition info`);
        }
      } else {
        setDebugMsg(`✅ Captured ${updatedPhotos.length} photos`);
      }
    } catch (error) {
      console.error("❌ Capture error:", error);
      setDebugMsg("❌ Capture error");
      alert("Camera error: " + error.message);
      setCapturing(false);
    }
  };

  const autoCapturePhoto = async () => {
    await capturePhoto();
  };

  const manualCapture = async () => {
    console.log("📸 Manual capture triggered");
    capturePhoto();
  };

  const processAllPhotos = async () => {
    if (photos.length === 0) {
      alert("No photos captured");
      return;
    }

    console.log(`🚀 Processing ${photos.length} photos...`);
    console.log("🎬 Setting isProcessing=true, showing modal...");
    setIsProcessing(true);
    setProcessingStage("uploading");
    setUploadProgress(0);

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(uploadInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    // Stage timers: roughly match expected backend phases
    const stageTimer1 = setTimeout(() => setProcessingStage("ocr"), 8000); // 8s → OCR
    const stageTimer2 = setTimeout(
      () => setProcessingStage("gemini"),
      25000
    ); // 25s → Gemini

    try {
      console.log("📤 Sending to backend...");
      const scanResult = await scanImage(photos);

      clearInterval(uploadInterval);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      setUploadProgress(100);
      console.log("✅ Backend response:", scanResult);
      console.log("📊 RESPONSE STRUCTURE:");
      console.log("  - product_name:", scanResult?.product_name);
      console.log("  - brand:", scanResult?.brand);
      console.log("  - expiry_date:", scanResult?.expiry_date);
      console.log("  - mfg_date:", scanResult?.mfg_date);
      console.log("  - ingredients (count):", scanResult?.ingredients?.length);
      console.log("  - ingredients (full):", scanResult?.ingredients);
      console.log("  - warnings:", scanResult?.warnings);
      console.log("  - confidence:", scanResult?.confidence);
      console.log("  - raw_text length:", scanResult?.raw_text?.length);
      console.log("  - extracted_json:", scanResult?.extracted_json);
      console.log("📋 FULL RESPONSE OBJECT:", JSON.stringify(scanResult, null, 2));

      setProcessingStage("complete");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("🔄 Storing in currentScan...");
      setCurrentScan(scanResult);
      console.log("✨ currentScan state updated");
      setPhotos([]); // Reset photos
      setPhotoMode("initial");
      setIsProcessing(false);
      router.replace("/(tabs)/home/result");
    } catch (apiError) {
      console.error("❌ Backend failed:", apiError);
      clearInterval(uploadInterval);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsProcessing(false);
      alert("Backend error: " + apiError.message);
    }
  };

  const cancelPhotos = () => {
    console.log("🗑️ Canceling photos");
    setPhotos([]);
    setPhotoMode("initial");
    autoCaptureDoneRef.current = false; // Allow auto-capture to run again
    setDebugMsg("Camera ready - Point at label");
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
      console.log("🔄 Screen focused");

      // Only reset capture state if we are NOT actively processing a scan
      if (!isProcessing) {
        console.log("🔄 Resetting capture state (not processing)");
        setCapturing(false);
        setCameraReady(false);
        cameraReadyRef.current = false;
        setPhotos([]);
        setPhotoMode("initial");
        autoCaptureDoneRef.current = false; // Reset auto-capture flag so it can run again
      }
      return () => {
        if (captureTimeoutRef.current) {
          clearTimeout(captureTimeoutRef.current);
        }
      };
    }, [isProcessing])
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

      {isProcessing ? (
        // PROCESSING MODAL - Show full screen loading screen
        <View
          style={{
            flex: 1,
            backgroundColor: "#0F172A",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 40,
          }}
        >
          {/* Animated Spinner */}
          <ActivityIndicator size="large" color="#3B82F6" style={{ marginBottom: 40 }} />

          {/* Stage Messages */}
          {processingStage === "uploading" && (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Inter_600SemiBold",
                  color: "#FFFFFF",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                📤 Uploading Photos
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_500Medium",
                  color: "#9CA3AF",
                  textAlign: "center",
                  lineHeight: 24,
                  marginBottom: 24,
                }}
              >
                Sending {photos.length} image{photos.length > 1 ? "s" : ""} to server{"\n"}(Please wait...)
              </Text>
              <View
                style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "#374151",
                  borderRadius: 4,
                  overflow: "hidden",
                  marginTop: 20,
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${uploadProgress}%`,
                    backgroundColor: "#3B82F6",
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  color: "#6B7280",
                  marginTop: 12,
                  fontWeight: "600",
                }}
              >
                {uploadProgress}%
              </Text>
            </View>
          )}

          {processingStage === "ocr" && (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Inter_600SemiBold",
                  color: "#FFFFFF",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                🔍 Reading Text
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_500Medium",
                  color: "#9CA3AF",
                  textAlign: "center",
                  lineHeight: 24,
                }}
              >
                Converting images to text{"\n"}(15-30 seconds...)
              </Text>
            </View>
          )}

          {processingStage === "gemini" && (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Inter_600SemiBold",
                  color: "#FFFFFF",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                🤖 AI Analysis
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_500Medium",
                  color: "#9CA3AF",
                  textAlign: "center",
                  lineHeight: 24,
                }}
              >
                Analyzing product information{"\n"}with AI (5-10 seconds...)
              </Text>
            </View>
          )}

          {processingStage === "complete" && (
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 60,
                  marginBottom: 16,
                }}
              >
                ✅
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Inter_600SemiBold",
                  color: "#FFFFFF",
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Processing Complete!
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Inter_500Medium",
                  color: "#9CA3AF",
                  textAlign: "center",
                }}
              >
                Loading results...
              </Text>
            </View>
          )}

          {/* Loading Tips */}
          <View
            style={{
              marginTop: 50,
              paddingTop: 20,
              borderTopWidth: 1,
              borderTopColor: "#475569",
              alignItems: "center",
              width: "100%",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: "#6B7280",
                fontStyle: "italic",
                textAlign: "center",
              }}
            >
              {processingStage === "uploading"
                ? "🔗 Sending large image files..."
                : processingStage === "ocr"
                ? "📸 Converting images to text..."
                : processingStage === "gemini"
                ? "🧠 Understanding product details..."
                : "⏳ Redirecting to results..."}
            </Text>
          </View>
        </View>
      ) : (
        // CAMERA VIEW - Normal scanning interface
        <View style={{ flex: 1 }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            onCameraReady={() => {
              console.log("📷 Camera onCameraReady fired!");
              // CLEAR previous timeout to prevent duplicate auto-captures
              if (captureTimeoutRef.current) {
                clearTimeout(captureTimeoutRef.current);
                console.log("🧹 Cleared previous timeout");
              }
              cameraReadyRef.current = true;
              setCameraReady(true);

              // ONLY auto-capture if: in initial mode AND haven't auto-captured yet
              // AND backend is not known to be unreachable
              if (
                photoMode === "initial" &&
                !autoCaptureDoneRef.current &&
                !capturing &&
                connected !== false
              ) {
                console.log("📷 Camera ready - auto-capture will start in 2s");
                setDebugMsg("Camera ready - auto-capturing in 2s...");
                captureTimeoutRef.current = setTimeout(() => {
                  console.log(
                    "⏱️ 2 seconds elapsed, calling autoCapturePhoto"
                  );
                  autoCaptureDoneRef.current = true; // Mark as done
                  autoCapturePhoto();
                }, 2000);
              } else {
                console.log("⏭️ Skipping auto-capture:", {
                  photoMode,
                  autoCaptureAlreadyDone: autoCaptureDoneRef.current,
                  stillCapturing: capturing,
                });
                setDebugMsg("Camera ready - Tap to capture");
              }
            }}
          />

          {/* Overlay Controls (absolute positioned on top of camera) */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              pointerEvents: "box-none",
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

            {/* Multi-photo controls */}
            {photoMode === "capturing_more" && (
              <View
                style={{
                  marginTop: 30,
                  gap: 12,
                  width: "80%",
                  paddingHorizontal: 20,
                }}
              >
                {/* Photo count warning */}
                {photos.length >= 4 && (
                  <View
                    style={{
                      backgroundColor: "#FEF3C7",
                      borderLeftWidth: 4,
                      borderLeftColor: "#F59E0B",
                      padding: 12,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#92400E",
                        fontWeight: "600",
                      }}
                    >
                      ⚠️ Maximum 4 photos allowed. Process now to scan.
                    </Text>
                  </View>
                )}

                {/* Capture More Button */}
                <Pressable
                  onPress={manualCapture}
                  disabled={capturing || photos.length >= 4}
                  style={{
                    backgroundColor:
                      photos.length >= 4 ? "#9CA3AF" : "#3B82F6",
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFF",
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    📸 Capture More ({photos.length}
                    {photos.length >= 4 ? " - MAX" : ""})
                  </Text>
                </Pressable>

                {/* Process Photos Button */}
                <Pressable
                  onPress={processAllPhotos}
                  disabled={capturing}
                  style={{
                    backgroundColor: "#10B981",
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>
                    ✅ Process All Photos
                  </Text>
                </Pressable>

                {/* Cancel Button */}
                <Pressable
                  onPress={cancelPhotos}
                  disabled={capturing}
                  style={{
                    backgroundColor: "#6B7280",
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#FFF",
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    ❌ Cancel & Restart
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Debug Info (absolute positioned at bottom) */}
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
              <Text
                style={{
                  color: "#FFF",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {debugMsg}
              </Text>
            </View>

            {/* Connection status */}
            {connected === false && (
              <View style={{ marginBottom: 12, paddingHorizontal: 20 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={20} color="#EF4444" />
                  <Text
                    style={{
                      color: "#EF4444",
                      fontSize: 14,
                      flex: 1,
                    }}
                  >
                    Backend unreachable
                  </Text>
                </View>
              </View>
            )}
            {connected === true && (
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <CheckCircle size={16} color="#10B981" />
                  <Text
                    style={{
                      color: "#10B981",
                      fontSize: 12,
                    }}
                  >
                    Connected
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
