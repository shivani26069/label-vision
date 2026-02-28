import {
  View,
  Text,
  StatusBar,
  Pressable,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useFonts } from "expo-font";
import { CameraView, useCameraPermissions } from "expo-camera";
import { speak, stopSpeaking } from "@/utils/tts";
import { scanImage, testConnection } from "@/utils/api";
import { useScanStore } from "@/utils/scanStore";
import {
  Inter_600SemiBold,
  Inter_500Medium,
  Inter_400Regular,
} from "@expo-google-fonts/inter";

export default function ScanningScreen() {
  const router = useRouter();
  const { settings, setCurrentScan } = useScanStore();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const autoCaptureDoneRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const processingIntervalRef = useRef(null);

  const [capturing, setCapturing] = useState(false);
  const [connected, setConnected] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoMode, setPhotoMode] = useState("initial");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);

  const [fontsLoaded] = useFonts({
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
  });

  // Refs so panResponder + callbacks always see latest state
  const photosRef = useRef(photos);
  const photoModeRef = useRef(photoMode);
  const isProcessingRef = useRef(isProcessing);
  const capturingRef = useRef(capturing);
  const cameraReadyStateRef = useRef(cameraReady);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { photoModeRef.current = photoMode; }, [photoMode]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { capturingRef.current = capturing; }, [capturing]);
  useEffect(() => { cameraReadyStateRef.current = cameraReady; }, [cameraReady]);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const say = useCallback((text, options = {}) => {
    if (settings.voiceEnabled) speak(text, options);
  }, [settings.voiceEnabled]);

  const startProcessingAnnouncements = useCallback(() => {
    if (!settings.voiceEnabled) return;
    let count = 0;
    const messages = [
      "Still working, please wait.",
      "Your label is being read right now.",
      "AI is analysing the product details.",
      "Almost done, just a few more seconds.",
      "Nearly finished, thank you for your patience.",
      "Results are on their way.",
    ];
    processingIntervalRef.current = setInterval(() => {
      speak(messages[count % messages.length], { rate: 0.85 });
      count++;
    }, 10000);
  }, [settings.voiceEnabled]);

  const stopProcessingAnnouncements = useCallback(() => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
  }, []);

  // ── CAPTURE — called on every tap ────────────────────────────────────────
  const capturePhoto = useCallback(async () => {
    if (capturingRef.current || !cameraReadyRef.current || !cameraRef.current) return;
    if (isProcessingRef.current) return;
    if (photosRef.current.length >= 4) {
      say("Maximum 4 photos reached. Swipe up to process now.");
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: false });
      const updatedPhotos = [...photosRef.current, photo.uri];
      setPhotos(updatedPhotos);
      setCapturing(false);

      if (updatedPhotos.length === 1) {
        setPhotoMode("capturing_more");
        say("Photo captured. Tap anywhere for another angle. Swipe up when ready to process.");
      } else if (updatedPhotos.length === 2) {
        say("2 photos captured. Tap for more, or swipe up to process.");
      } else if (updatedPhotos.length === 3) {
        say("3 photos captured. Tap for one more, or swipe up to process.");
      } else if (updatedPhotos.length >= 4) {
        say("4 photos captured. Swipe up now to process.");
      }
    } catch (error) {
      setCapturing(false);
      say("Camera error. Please tap to try again.");
    }
  }, [say]);

  // ── PROCESS — called on swipe up ─────────────────────────────────────────
  const processAllPhotos = useCallback(async () => {
    if (photosRef.current.length === 0) {
      say("No photos yet. Tap anywhere on the screen to take a photo.");
      return;
    }
    if (isProcessingRef.current) {
      say("Already processing, please wait.");
      return;
    }

    setIsProcessing(true);
    setProcessingStage("uploading");
    setUploadProgress(0);
    say("Processing your label now. Please wait.", { rate: 0.85 });
    startProcessingAnnouncements();

    const uploadInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) { clearInterval(uploadInterval); return 90; }
        return prev + Math.random() * 15;
      });
    }, 500);

    const stageTimer1 = setTimeout(() => {
      setProcessingStage("ocr");
      if (settings.voiceEnabled) speak("Reading text from your label.", { rate: 0.85 });
    }, 8000);

    const stageTimer2 = setTimeout(() => {
      setProcessingStage("gemini");
      if (settings.voiceEnabled) speak("Analysing product information with AI.", { rate: 0.85 });
    }, 25000);

    try {
      const scanResult = await scanImage(photosRef.current);
      clearInterval(uploadInterval);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      stopProcessingAnnouncements();
      stopSpeaking();

      setUploadProgress(100);
      setProcessingStage("complete");
      say("Analysis complete. Loading your results.", { rate: 0.85 });
      await new Promise((resolve) => setTimeout(resolve, 800));

      setCurrentScan(scanResult);
      setPhotos([]);
      setPhotoMode("initial");
      setIsProcessing(false);
      router.replace("/(tabs)/home/result");
    } catch (apiError) {
      clearInterval(uploadInterval);
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      stopProcessingAnnouncements();
      setIsProcessing(false);
      say("Something went wrong. Please tap to try again.");
      alert("Backend error: " + apiError.message);
    }
  }, [say, startProcessingAnnouncements, stopProcessingAnnouncements, settings.voiceEnabled, setCurrentScan, router]);

  const processAllPhotosRef = useRef(processAllPhotos);
  useEffect(() => { processAllPhotosRef.current = processAllPhotos; }, [processAllPhotos]);

  const cancelPhotos = useCallback(() => {
    setPhotos([]);
    setPhotoMode("initial");
    autoCaptureDoneRef.current = false;
    say("Scan cancelled. Tap anywhere to start again.");
  }, [say]);

  // ── SWIPE UP = PROCESS (outer View) ──────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy < -40 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -60 && !isProcessingRef.current && !capturingRef.current) {
          if (photosRef.current.length === 0) {
            if (settings.voiceEnabled) speak("No photos yet. Tap the screen to take a photo first.");
          } else {
            processAllPhotosRef.current();
          }
        }
      },
    })
  ).current;

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    say("Label Vision ready. Tap anywhere on the screen to take a photo. Swipe up when you are done to process.");
    if (permission?.status !== "granted") requestPermission();

    testConnection()
      .then(() => setConnected(true))
      .catch(() => {
        setConnected(false);
        say("Server is offline. Please check your connection and try again.");
      });

    return () => {
      stopProcessingAnnouncements();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isProcessing) {
        setCapturing(false);
        setCameraReady(false);
        cameraReadyRef.current = false;
        setPhotos([]);
        setPhotoMode("initial");
        autoCaptureDoneRef.current = false;
      }
      return () => {};
    }, [isProcessing])
  );

  if (!fontsLoaded) return null;

  // ── PERMISSION SCREEN ─────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF", padding: 32 }}>
        <StatusBar barStyle="dark-content" />
        <Text style={{ fontSize: 22, fontFamily: "Inter_600SemiBold", color: "#111111", marginBottom: 12, textAlign: "center" }}>
          Camera Access Required
        </Text>
        <Text style={{ fontSize: 18, color: "#444444", textAlign: "center", marginBottom: 32, lineHeight: 26 }}>
          LabelVision needs your camera to scan product labels.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: "#111111", paddingVertical: 20, paddingHorizontal: 40, borderRadius: 12 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_600SemiBold" }}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  // ── PROCESSING SCREEN ─────────────────────────────────────────────────────
  if (isProcessing) {
    const stages = [
      { key: "uploading", label: "Uploading", emoji: "📤", desc: "Sending photos to server" },
      { key: "ocr",       label: "Reading Text", emoji: "🔍", desc: "Extracting text from label" },
      { key: "gemini",    label: "AI Analysis", emoji: "🤖", desc: "Understanding product info" },
      { key: "complete",  label: "Done!", emoji: "✅", desc: "Loading your results" },
    ];
    const currentStage = stages.find(s => s.key === processingStage) || stages[0];
    const currentIdx = stages.findIndex(s => s.key === processingStage);

    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", padding: 32 }}>
        <StatusBar barStyle="dark-content" />

        <Text style={{ fontSize: 64, marginBottom: 20 }}>{currentStage.emoji}</Text>
        <Text style={{ fontSize: 28, fontFamily: "Inter_600SemiBold", color: "#111111", marginBottom: 10, textAlign: "center" }}>
          {currentStage.label}
        </Text>
        <Text style={{ fontSize: 18, color: "#444444", textAlign: "center", lineHeight: 26, marginBottom: 36 }}>
          {currentStage.desc}
        </Text>

        {processingStage === "uploading" && (
          <View style={{ width: "100%", marginBottom: 12 }}>
            <View style={{ height: 12, backgroundColor: "#EEEEEE", borderRadius: 6, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${uploadProgress}%`, backgroundColor: "#111111", borderRadius: 6 }} />
            </View>
            <Text style={{ fontSize: 18, color: "#111111", marginTop: 10, textAlign: "right", fontFamily: "Inter_600SemiBold" }}>
              {Math.round(uploadProgress)}%
            </Text>
          </View>
        )}

        {processingStage !== "uploading" && processingStage !== "complete" && (
          <ActivityIndicator size="large" color="#111111" style={{ marginBottom: 24 }} />
        )}

        <View style={{ width: "100%", marginTop: 24, gap: 10 }}>
          {stages.slice(0, 3).map((step, idx) => {
            const isDone = idx < currentIdx;
            const isActive = step.key === processingStage;
            return (
              <View key={step.key} style={{
                flexDirection: "row", alignItems: "center", gap: 14,
                padding: 16, borderRadius: 12,
                backgroundColor: isActive ? "#F5F5F5" : "transparent",
                borderWidth: isActive ? 2 : 0,
                borderColor: "#111111",
              }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isDone || isActive ? "#111111" : "#EEEEEE",
                  justifyContent: "center", alignItems: "center",
                }}>
                  <Text style={{ color: isDone || isActive ? "#FFFFFF" : "#999999", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                    {isDone ? "✓" : idx + 1}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 18,
                  fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                  color: isDone || isActive ? "#111111" : "#AAAAAA",
                  flex: 1,
                }}>
                  {step.label}
                </Text>
                {isActive && <ActivityIndicator size="small" color="#111111" />}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  // ── CAMERA SCREEN ─────────────────────────────────────────────────────────
  // Outer View handles swipe, inner Pressable handles tap
  return (
    <View
      style={{ flex: 1, backgroundColor: "#000000" }}
      {...panResponder.panHandlers}
    >
      <StatusBar barStyle="light-content" />

      {/* Inner Pressable — tap anywhere to capture */}
      <Pressable style={{ flex: 1 }} onPress={capturePhoto}>

        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          onCameraReady={() => {
            cameraReadyRef.current = true;
            setCameraReady(true);
          }}
        />

        {/* UI overlay */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: "box-none",
        }}>

          {/* Top bar */}
          <View style={{
            paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            pointerEvents: "none",
          }}>
            <Text style={{
              color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_600SemiBold",
              textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
            }}>
              {capturing
                ? "📸 Capturing..."
                : photoMode === "initial"
                ? "Tap anywhere to scan"
                : `${photos.length} photo${photos.length > 1 ? "s" : ""} • Tap for more`}
            </Text>

            <View style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected === true ? "#22C55E" : connected === false ? "#EF4444" : "#888888" }} />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_500Medium" }}>
                {connected === true ? "Server Ready" : connected === false ? "Offline" : "Connecting..."}
              </Text>
            </View>
          </View>

          {/* Bottom area */}
          <View style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            paddingHorizontal: 20, paddingBottom: 48, gap: 12,
            pointerEvents: "box-none",
          }}>

            {/* Swipe hint */}
            {photoMode === "capturing_more" && (
              <View style={{ alignItems: "center", marginBottom: 4, pointerEvents: "none" }}>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 18, fontFamily: "Inter_500Medium" }}>
                  ↑  Swipe up to process
                </Text>
              </View>
            )}

            {/* Max warning */}
            {photos.length >= 4 && (
              <View style={{ backgroundColor: "rgba(254,243,199,0.95)", borderRadius: 10, padding: 14, pointerEvents: "none" }}>
                <Text style={{ color: "#92400E", fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" }}>
                  ⚠️  Maximum 4 photos. Swipe up to process.
                </Text>
              </View>
            )}

            {/* Cancel button */}
            {photoMode === "capturing_more" && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  cancelPhotos();
                }}
                style={({ pressed }) => ({
                  alignItems: "center", paddingVertical: 16,
                  borderRadius: 14, borderWidth: 2, borderColor: "#EF4444",
                  backgroundColor: "rgba(0,0,0,0.5)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: "#EF4444", fontSize: 18, fontFamily: "Inter_500Medium" }}>
                  ✕  Cancel & Start Over
                </Text>
              </Pressable>
            )}

            {/* Camera loading */}
            {!cameraReady && (
              <View style={{ alignItems: "center", pointerEvents: "none" }}>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontFamily: "Inter_400Regular" }}>
                  Loading camera...
                </Text>
              </View>
            )}
          </View>
        </View>

      </Pressable>
    </View>
  );
}