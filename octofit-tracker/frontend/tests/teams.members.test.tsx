import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Teams members', () => {
  it('shows member names instead of IDs when the API provides them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ teams: [{ name: 'Octocats', members: ['64f1a0000000000000000001'], memberNames: ['Mona'] }] }),
      { status: 200 },
    )));
    render(<MemoryRouter initialEntries={['/teams']}><App /></MemoryRouter>);
    expect(await screen.findByText('Octocats: Mona')).toBeInTheDocument();
    expect(screen.queryByText(/64f1a0/)).not.toBeInTheDocument();
  });
});
