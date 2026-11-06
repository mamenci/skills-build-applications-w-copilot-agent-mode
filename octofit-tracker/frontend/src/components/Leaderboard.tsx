import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type Entry = { teamName: string; totalPoints: number; rank: number };

const loadLeaderboard = () => getJson<{ leaderboard: Entry[] }>('/api/leaderboard').then((payload) => payload.leaderboard);

export default function Leaderboard() {
  return <CapabilityCard<Entry>
    title="Leaderboard"
    description="Compare team point totals."
    load={loadLeaderboard}
    emptyText="No leaderboard scores yet."
    renderItem={(e) => `#${e.rank} ${e.teamName}: ${e.totalPoints} points`}
  />;
}
