import DashboardScreen from '@/components/dashboard/DashboardScreen';
import type { SearchParams } from '@/lib/context';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <DashboardScreen slug="home" searchParams={await searchParams} />;
}
