import { WebSocketServer } from 'ws';

export default function setupWebSocket(server, tracks, getNextTrack, getCurrentTrackStartTime, getCurrentTrackIndex) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        const currentTime = Date.now();
        const currentTrackStartTime = getCurrentTrackStartTime();
        const currentTrackIndex = getCurrentTrackIndex();
        const elapsedTime = (currentTime - currentTrackStartTime) / 1000;

        ws.send(JSON.stringify({
            type: 'currentTrack',
            trackIndex: currentTrackIndex,
            elapsedTime: elapsedTime
        }));

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'getCurrentTrack') {
                const currentTime = Date.now();
                const currentTrackStartTime = getCurrentTrackStartTime();
                const currentTrackIndex = getCurrentTrackIndex();
                const elapsedTime = (currentTime - currentTrackStartTime) / 1000;
                ws.send(JSON.stringify({
                    type: 'currentTrack',
                    trackIndex: currentTrackIndex,
                    elapsedTime: elapsedTime
                }));
            }
        });
    });

    setInterval(() => {
        const currentTime = Date.now();
        const currentTrackStartTime = getCurrentTrackStartTime();
        const currentTrackIndex = getCurrentTrackIndex();
        const elapsedTime = (currentTime - currentTrackStartTime) / 1000;
        if (elapsedTime >= tracks[currentTrackIndex].duration) {
            const nextTrack = getNextTrack();
            wss.clients.forEach((client) => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({
                        type: 'currentTrack',
                        trackIndex: getCurrentTrackIndex(),
                        elapsedTime: 0
                    }));
                }
            });
        }
    }, 1000);
}
