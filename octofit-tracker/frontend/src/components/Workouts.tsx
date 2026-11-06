import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type Suggestion = { title: string; reason: string };

// Authentication is out of scope, so suggestions use the demo user.
const demoUserEmail = 'mona@example.com';

const loadSuggestions = () =>
  getJson<{ suggestions: Suggestion[] }>(`/api/workouts/suggestions/${encodeURIComponent(demoUserEmail)}`).then((payload) => payload.suggestions);

export default function Workouts() {
  return <CapabilityCard<Suggestion>
    title="Workout suggestions"
    description="Recommend workouts from activity patterns."
    load={loadSuggestions}
    emptyText="No workout suggestions yet."
    renderItem={(s) => `${s.title}: ${s.reason}`}
  />;
}
