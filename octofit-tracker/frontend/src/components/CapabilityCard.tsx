import { useEffect, useState, type ReactNode } from 'react';

type Props<T> = {
  title: string;
  description: string;
  load: () => Promise<T[]>;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
};

type State<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; items: T[] };

// `load` must be a stable (module-level) function so the request runs once per mount.
export function CapabilityCard<T>({ title, description, load, emptyText, renderItem }: Props<T>) {
  const [state, setState] = useState<State<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load()
      .then((items) => active && setState({ status: 'ready', items: items ?? [] }))
      .catch((error: Error) => active && setState({ status: 'error', message: error.message }));
    return () => { active = false; };
  }, [load]);

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
