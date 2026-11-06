import { CapabilityCard } from './CapabilityCard.js';

type Team = { name: string; members: string[] };

export default function Teams() {
  return <CapabilityCard<Team>
    title="Teams"
    description="Manage teams and members."
    path="/api/teams"
    select={(payload) => payload.teams}
    emptyText="No teams created yet."
    renderItem={(t) => `${t.name}: ${t.members.join(', ') || 'no members'}`}
  />;
}
