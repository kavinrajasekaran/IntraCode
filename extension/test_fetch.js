try {
  fetch('http://127.0.0.1:3737/api/health', { signal: AbortSignal.timeout(1000) })
    .then(console.log)
    .catch(console.error);
} catch (e) {
  console.log("Sync error:", e);
}
