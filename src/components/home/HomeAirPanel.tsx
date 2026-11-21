// ============================================================
// src/components/home/HomeAirPanel.tsx
// Indoor air quality. Composition only: the panel assembles the
// room calculator and the hack catalogue, each of which owns its
// own state and calculation.
// ============================================================

import { RoomCalculator } from './RoomCalculator';
import { HackCatalogue } from './HackCatalogue';

export function HomeAirPanel() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <RoomCalculator />
      </div>
      <HackCatalogue />
    </div>
  );
}
