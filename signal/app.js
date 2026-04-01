import { renderDashboard } from './render.mjs';

const app = document.getElementById('app');

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

function renderError(error) {
  app.innerHTML = `
    <section class="panel error-state">
      <div class="kicker">SYSTEM_ALERT</div>
      <h1>Signal feed offline</h1>
      <p>${error.message}</p>
      <p>Check <code>dashboard/data/latest.json</code> or fall back to <code>dashboard/data/sample.json</code>.</p>
    </section>
  `;
}

async function main() {
  try {
    let data;

    try {
      data = await fetchJson(`./data/latest.json?ts=${Date.now()}`);
    } catch {
      data = await fetchJson('./data/sample.json');
    }

    document.title = data.meta?.title || 'Rishabh // Signal Feed';
    app.innerHTML = renderDashboard(data);
  } catch (error) {
    renderError(error);
  }
}

main();
