import { View } from 'react-native';
import QR from 'react-native-qrcode-svg';

export function QRCode({
  value,
  size = 200,
  label,
}: {
  value: string;
  size?: number;
  label: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="items-center justify-center self-center rounded-lg bg-white p-4"
    >
      <QR value={value} size={size} color="#07060F" backgroundColor="#FFFFFF" />
    </View>
  );
}
