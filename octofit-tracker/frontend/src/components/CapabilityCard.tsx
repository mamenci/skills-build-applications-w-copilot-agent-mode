import { useEffect, useState, type ReactNode } from 'react';
import { getJson } from '../api/client.js';

type Props<T> = {
  title: string;
  description: string;
  path: string;
  select: (payload: any) => T[];
  emptyText: string;
  renderItem: (item: T) => ReactNode;
};

type State<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: T[] };

export function CapabilityCard<T>({ title, description, path, select, emptyText, renderItem }: Props<T>) {
  const [state, setState] = useState<State<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    getJson<unknown>(path)
      .then((payload) => active && setState({ status: 'ready', items: select(payload) ?? [] }))
      .catch((error: Error) => active && setState({ status: 'error', message: error.message }));
    return () => { active = false; };
    // select is a stable inline function per caller; path alone identifies the request
  }, [path]);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">{title}</h2>
        <p>{description}</p>
        {state.status === 'loading' && <p role="status">Loading {title.toLowerCase()}…</p>}
        {state.status === 'error' && <p role="alert">Unable to load {title.toLowerCase()}: {state.message}</p>}
        {state.status === 'ready' && (state.items.length === 0
          ? <p>{emptyText}</p>
          : <ul>{state.items.map((item, index) => <li key={index}>{renderItem(item)}</li>)}</ul>)}
      </div>
    </section>
  );
}
