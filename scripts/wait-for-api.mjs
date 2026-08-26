const healthUrl = process.env.API_HEALTH_URL || 'http://localhost:5001/api/health';
const timeoutMs = Number(process.env.API_STARTUP_TIMEOUT_MS || 30_000);
const startedAt = Date.now();
let isReady = false;

while (Date.now() - startedAt < timeoutMs) {
    try {
        const response = await fetch(healthUrl);
        if (response.ok) {
            console.log(`[Startup] API ready at ${healthUrl}`);
            isReady = true;
            break;
        }
    } catch {
        // The API process is still starting; retry without printing proxy noise.
    }

    await new Promise(resolve => setTimeout(resolve, 250));
}

if (!isReady) {
    console.error(`[Startup] API did not become ready within ${timeoutMs}ms: ${healthUrl}`);
    process.exitCode = 1;
}
