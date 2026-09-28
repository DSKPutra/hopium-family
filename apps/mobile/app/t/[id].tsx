import { Redirect, useLocalSearchParams } from 'expo-router';

/** Universal link https://hopium.family/t/:id */
export default function ThesisLink() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/thesis/[id]', params: { id } }} />;
}
