import { Redirect, useLocalSearchParams } from 'expo-router';

/** Universal link https://hopium.family/u/:username */
export default function UserLink() {
  const { username = '' } = useLocalSearchParams<{ username: string }>();
  return <Redirect href={{ pathname: '/user/[username]', params: { username } }} />;
}
