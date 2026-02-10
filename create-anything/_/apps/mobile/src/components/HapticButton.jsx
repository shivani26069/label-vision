import { Pressable } from "react-native";
import { mediumHaptic } from "@/utils/haptics";
import { useScanStore } from "@/utils/scanStore";

export default function HapticButton({
  onPress,
  children,
  style,
  pressedStyle,
  ...props
}) {
  const { settings } = useScanStore();

  const handlePress = async () => {
    if (settings.hapticsEnabled) {
      await mediumHaptic();
    }
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        style,
        pressed && (pressedStyle || { opacity: 0.7 }),
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}
