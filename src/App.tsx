// ============================================================
// src/App.tsx
// Root component: provider, chrome, and the active panel.
// ============================================================

import { AppProvider, useApp } from '@/context/AppContext';
import { AppShell } from '@/components/layout/AppShell';
import { AirNowPanel } from '@/components/air/AirNowPanel';
import { RoutinePanel } from '@/components/routine/RoutinePanel';
import { HomeAirPanel } from '@/components/home/HomeAirPanel';
import { SwapsPanel } from '@/components/swaps/SwapsPanel';
import { ImpactPanel } from '@/components/impact/ImpactPanel';
import { CommunityPanel } from '@/components/community/CommunityPanel';

function Panels() {
  const { tab } = useApp();

  switch (tab) {
    case 'air':
      return <AirNowPanel />;
    case 'routine':
      return <RoutinePanel />;
    case 'home':
      return <HomeAirPanel />;
    case 'swaps':
      return <SwapsPanel />;
    case 'impact':
      return <ImpactPanel />;
    case 'community':
      return <CommunityPanel />;
    default:
      return <AirNowPanel />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppShell>
        <Panels />
      </AppShell>
    </AppProvider>
  );
}
