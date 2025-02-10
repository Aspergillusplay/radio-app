// server/websocket.js
import { WebSocketServer } from 'ws';

export default function setupWebSocket(server, { getCurrentTrackIndex, getCurrentTrackStartTime }) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        // При подключении сразу отдаем клиенту актуальную информацию
        const elapsedTime = (Date.now() - getCurrentTrackStartTime()) / 1000;
        ws.send(JSON.stringify({
            type: 'currentTrack',
            trackIndex: getCurrentTrackIndex(),
            elapsedTime: elapsedTime
        }));

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.error('Неверный JSON:', message);
                return;
            }
            if (data.type === 'getCurrentTrack') {
                const elapsedTime = (Date.now() - getCurrentTrackStartTime()) / 1000;
                ws.send(JSON.stringify({
                    type: 'currentTrack',
                    trackIndex: getCurrentTrackIndex(),
                    elapsedTime: elapsedTime
                }));
            }
        });
    });

    return wss;
}
