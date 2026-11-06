import { CapabilityCard } from './CapabilityCard.js';

type Suggestion = { title: string; reason: string };

// Authentication is out of scope, so suggestions use the demo user.
const demoUserEmail = 'mona@example.com';

export default function Workouts() {
  return <CapabilityCard<Suggestion>
    title="Workout suggestions"
    description="Recommend workouts from activity patterns."
    path={`/api/workouts/suggestions/${encodeURIComponent(demoUserEmail)}`}
    select={(payload) => payload.suggestions}
    emptyText="No workout suggestions yet."
    renderItem={(s) => `${s.title}: ${s.reason}`}
  />;
}
