import { Stack } from "expo-router";

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auto-scan" />
      <Stack.Screen name="manual-scan" />
      <Stack.Screen name="scanning" />
      <Stack.Screen name="result" />
      <Stack.Screen name="full-label" />
    </Stack>
  );
}
