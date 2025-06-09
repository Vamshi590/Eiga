import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the explore tab
  return <Redirect href="/(tabs)/explore" />;
}
