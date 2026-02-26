const http = require('http');

const WEBHOOK_URL = 'http://localhost:3000/api/webhook';

const SESSION_ID = 'test-session-' + Date.now();
const USER_ID = 'user-abc-123';
const ITEM_ID = 'item-xyz-789';

const basePayload = {
    ServerId: "my-jellyfin-server",
    ServerName: "Jellyfin Server",
    ServerVersion: "10.8.10",
    PluginVersion: "1.0.0.0",
    UserId: USER_ID,
    UserName: "Mael",
    ItemId: ITEM_ID,
    ItemName: "Big Buck Bunny",
    ItemType: "Movie",
    SessionId: SESSION_ID,
    ClientName: "Jellyfin Web",
    DeviceName: "Chrome",
    IpAddress: "192.168.1.50",
};

async function sendEvent(eventType, additionalData = {}) {
    const payload = JSON.stringify({
        ...basePayload,
        NotificationType: eventType,
        ...additionalData,
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
    };

    return new Promise((resolve, reject) => {
        const req = http.request(WEBHOOK_URL, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[${eventType}] Status: ${res.statusCode} - Response:`, data);
                resolve(data);
            });
        });

        req.on('error', (e) => {
            console.error(`[${eventType}] Request error:`, e.message);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

async function runTest() {
    console.log('--- Starting Webhook Test ---');

    // 1. PlaybackStart
    console.log('\nSending PlaybackStart...');
    await sendEvent("PlaybackStart", {
        PlayMethod: "Transcode",
        VideoCodec: "h264",
        AudioCodec: "aac",
        TranscodeFps: "45.5",
        Bitrate: "4000000",
        PlaybackPositionTicks: 0,
    });

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    // 2. PlaybackProgress
    console.log('\nSending PlaybackProgress...');
    await sendEvent("PlaybackProgress", {
        PlayMethod: "Transcode",
        VideoCodec: "h264",
        AudioCodec: "aac",
        TranscodeFps: "46.2",
        Bitrate: "4000000",
        PlaybackPositionTicks: 20000000, // ticks (10,000 ticks = 1 ms) -> 2 seconds
    });

    // Wait 2 seconds
    await new Promise(r => setTimeout(r, 2000));

    // 3. PlaybackStop
    console.log('\nSending PlaybackStop...');
    await sendEvent("PlaybackStop", {
        PlayMethod: "Transcode",
        PlaybackPositionTicks: 40000000, // 4 seconds
    });

    console.log('\n--- Test Completed ---');
}

runTest();
