import { Redirect, useLocalSearchParams } from 'expo-router';

/** Universal link https://hopium.family/a/:symbol */
export default function AssetLink() {
  const { symbol = '' } = useLocalSearchParams<{ symbol: string }>();
  return <Redirect href={{ pathname: '/asset/[symbol]', params: { symbol } }} />;
}
