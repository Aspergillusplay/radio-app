// server/websocket.js
import { WebSocketServer } from 'ws';

export default function setupWebSocket(server, { getCurrentTrackIndex, getCurrentTrackStartTime, getTracks }) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('New WebSocket connection established');

        // Send current track info immediately upon connection
        sendCurrentTrackInfo(ws);

        // Handle messages from clients
        ws.on('message', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.error('Invalid JSON received:', message);
                return;
            }

            // Handle client messages
            switch (data.type) {
                case 'getCurrentTrack':
                    sendCurrentTrackInfo(ws);
                    break;

                case 'trackPreloaded':
                    // Client reporting it has preloaded a track
                    console.log(`Client reports track at index ${data.trackIndex} is preloaded`);
                    break;

                case 'requestTrackDuration':
                    // Client requesting track duration
                    sendTrackDuration(ws, data.trackIndex);
                    break;
            }
        });

        // Handle connection close
        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });

    // Function to send track duration to client
    function sendTrackDuration(ws, trackIndex) {
        const tracks = getTracks();
        if (!tracks || !tracks[trackIndex]) return;

        const track = tracks[trackIndex];
        ws.send(JSON.stringify({
            type: 'trackDuration',
            trackIndex: trackIndex,
            trackId: track.id,
            duration: track.duration || null
        }));
    }

    // Function to send current track info to a client
    function sendCurrentTrackInfo(ws) {
        const trackIndex = getCurrentTrackIndex();
        const tracks = getTracks();

        // Calculate elapsed time
        let elapsedTime = (Date.now() - getCurrentTrackStartTime()) / 1000;

        // Check if current track exists and has duration
        if (tracks && tracks.length > trackIndex && tracks[trackIndex]) {
            const currentTrack = tracks[trackIndex];
            const trackDuration = currentTrack.duration;

            // Ensure elapsed time doesn't exceed track duration
            if (trackDuration && elapsedTime > trackDuration) {
                console.log(`Elapsed time (${elapsedTime.toFixed(2)}s) exceeds track duration (${trackDuration}s), capping at track duration`);
                elapsedTime = trackDuration;
            }

            // Send detailed track info
            ws.send(JSON.stringify({
                type: 'currentTrack',
                trackIndex: trackIndex,
                elapsedTime: elapsedTime,
                trackName: currentTrack.name,
                trackDuration: trackDuration,
                trackId: currentTrack.id,
                // Include next tracks info for preloading
                nextTracks: getNextTracksInfo(trackIndex, 3, tracks)
            }));
        } else {
            // Fallback if track not found
            ws.send(JSON.stringify({
                type: 'currentTrack',
                trackIndex: trackIndex,
                elapsedTime: elapsedTime,
                error: 'Track information incomplete'
            }));
        }
    }

    // Helper function to get information about upcoming tracks for preloading
    function getNextTracksInfo(currentIndex, count, tracks) {
        const nextTracks = [];
        for (let i = 1; i <= count; i++) {
            const nextIndex = (currentIndex + i) % tracks.length;
            if (tracks[nextIndex]) {
                nextTracks.push({
                    index: nextIndex,
                    id: tracks[nextIndex].id,
                    path: tracks[nextIndex].path,
                    duration: tracks[nextIndex].duration
                });
            }
        }
        return nextTracks;
    }

    return wss;
}