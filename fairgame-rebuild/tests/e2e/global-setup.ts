async function globalSetup() {
  await Promise.all([waitForOk("http://127.0.0.1:5173"), waitForOk("http://127.0.0.1:4000/ready")]);
}

async function waitForOk(url: string) {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError instanceof Error ? lastError : new Error(`${url} was not ready`);
}

export default globalSetup;
