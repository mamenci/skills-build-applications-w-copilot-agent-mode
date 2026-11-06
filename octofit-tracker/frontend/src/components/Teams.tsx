import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type Team = { name: string; members: string[] };

const loadTeams = () => getJson<{ teams: Team[] }>('/api/teams').then((payload) => payload.teams);

export default function Teams() {
  return <CapabilityCard<Team>
    title="Teams"
    description="Manage teams and members."
    load={loadTeams}
    emptyText="No teams created yet."
    renderItem={(t) => `${t.name}: ${t.members.join(', ') || 'no members'}`}
  />;
}
