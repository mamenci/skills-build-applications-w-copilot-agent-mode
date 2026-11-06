import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type Activity = { type: string; minutes: number; points: number };

const loadActivities = () => getJson<{ activities: Activity[] }>('/api/activities').then((payload) => payload.activities);

export default function Activities() {
  return <CapabilityCard<Activity>
    title="Activities"
    description="Track student activity minutes and points."
    load={loadActivities}
    emptyText="No activities logged yet."
    renderItem={(a) => `${a.type}: ${a.minutes} minutes, ${a.points} points`}
  />;
}
