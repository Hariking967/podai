import HomeView from '@/modules/home/home-view';
import LandingPage from '@/modules/landing/landing-page';
import {auth} from '@/lib/auth'
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return <LandingPage />;
  }

  return (
    <HomeView user={session.user} />
  );
}
