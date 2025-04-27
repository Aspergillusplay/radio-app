// server/websocket.js
import { WebSocketServer } from 'ws';

export default function setupWebSocket(server, { getCurrentTrackIndex, getCurrentTrackStartTime, getTracks }) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        // При подключении сразу отдаем клиенту актуальную информацию
        sendCurrentTrackInfo(ws);

        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.error('Неверный JSON:', message);
                return;
            }
            if (data.type === 'getCurrentTrack') {
                sendCurrentTrackInfo(ws);
            }
        });
    });

    function sendCurrentTrackInfo(ws) {
        const trackIndex = getCurrentTrackIndex();
        let elapsedTime = (Date.now() - getCurrentTrackStartTime()) / 1000;

        // Получаем список треков и длительность текущего трека
        const tracks = getTracks();

        // Проверяем, что трек существует и имеет длительность
        if (tracks && tracks.length > trackIndex && tracks[trackIndex] && tracks[trackIndex].duration) {
            const trackDuration = tracks[trackIndex].duration;

            // Если elapsedTime превышает длительность трека, ограничиваем его
            if (elapsedTime > trackDuration) {
                elapsedTime = trackDuration - 0.1; // Оставляем немного времени до конца трека
                console.log(`Время воспроизведения (${elapsedTime.toFixed(2)}s) превысило длительность трека (${trackDuration}s), установлено в конец трека`);
            }
        }

        ws.send(JSON.stringify({
            type: 'currentTrack',
            trackIndex: trackIndex,
            elapsedTime: elapsedTime
        }));
    }

    return wss;
}