import { Redirect } from 'expo-router';
import { useStore } from '@/lib/store';

export default function Index() {
  const { ready, plans } = useStore();
  if (!ready) return null;
  return <Redirect href={plans.length ? '/today' : '/welcome'} />;
}
