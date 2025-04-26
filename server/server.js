import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';
import artistsRoutes from './routes/artists.js';
import wishesRoutes from './routes/wishes.js';
import Track from './models/track.js'; // Track model from the database (ensure it has the "isDuplicate" field)
import minioClient from './clients/minioClient.js';
import { parseStream } from 'music-metadata'; // For audio metadata

const app = express();
const port = 3010;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

app.use('/api/tracks', tracksRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/artists', artistsRoutes);
app.use('/api/wishes', wishesRoutes);

const startDatabase = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startDatabase();

// Compute track duration using metadata from MinIO
async function computeTrackDuration(track) {
    return new Promise((resolve) => {
        const bucket = 'audio';
        minioClient.getObject(bucket, track.path, async (err, stream) => {
            if (err) {
                console.error(`Error getting file ${track.path} from MinIO:`, err);
                resolve(null);
                return;
            }
            try {
                const metadata = await parseStream(stream, null, { duration: true });
                resolve(metadata.format.duration);
            } catch (parseErr) {
                console.error(`Error parsing metadata for track ${track.name}:`, parseErr);
                resolve(null);
            }
        });
    });
}

// Load tracks from the database and compute duration if not set
async function loadTracks() {
    const tracksFromDB = await Track.findAll({ order: [['order', 'ASC']] });
    const newTracks = tracksFromDB.map(track => track.get({ plain: true }));
    for (const track of newTracks) {
        if (!track.duration) {
            const duration = await computeTrackDuration(track);
            track.duration = (duration && duration > 0) ? Math.floor(duration) : 200;
            console.log(`Track "${track.name}" duration: ${track.duration} sec.`);
        } else {
            console.log(`Track "${track.name}" duration: ${track.duration} sec.`);
        }
    }
    return newTracks;
}

// Reset orders for original tracks
async function resetTrackOrders() {
    const tracks = await Track.findAll({ where: { isDuplicate: false } });
    for (const track of tracks) {
        track.order = 0; // or some default value instead of null
        await track.save();
    }
    console.log('Original track orders reset');
}

// New reorder function: deletes old duplicates, creates new duplicates for Groups A and B,
// then assigns new order values based on a randomized distribution that meets the following rules:
//   - Block 1: All original tracks from Group A (shuffled randomly).
//   - Block 2: Group B originals (shuffled) + a random half of Group A duplicates.
//   - Block 3: Group C originals (shuffled) + Group B duplicates (shuffled) + the remaining Group A duplicates.
// This ensures Group A originals are always first, Group B originals appear before any Group B duplicates or Group C tracks,
// and duplicates of Group A are evenly and randomly distributed between the later blocks.
export async function reorderTracksByLikes() {
    try {
        // Delete previously generated duplicate records (if the field exists)
        try {
            const deletedCount = await Track.destroy({ where: { isDuplicate: true } });
            console.log(`Deleted ${deletedCount} old duplicate tracks.`);
        } catch (delError) {
            console.error("Error deleting duplicates. Ensure 'isDuplicate' exists in your model.", delError);
            throw delError;
        }

        // Reset order for original tracks only
        await resetTrackOrders();
        try {
            const originalTracks = await Track.findAll({ where: { isDuplicate: false } });
            for (const track of originalTracks) {
                track.order = null;
                await track.save();
            }
            console.log("Original track orders reset.");
        } catch (resetError) {
            console.error("Error resetting track orders", resetError);
            throw resetError;
        }

        // Retrieve all original tracks sorted by likes in descending order
        let tracks = await Track.findAll({ where: { isDuplicate: false }, order: [['likes', 'DESC']] });
        if (tracks.length === 0) {
            console.error("No original tracks found for reordering.");
            return;
        }

        const total = tracks.length;
        // Calculate group sizes: Group A = top 30% (min 1), Group B = next 30% (min 1), Group C = remainder
        const groupACount = Math.floor(total * 0.3) || 1;
        const groupBCount = Math.floor(total * 0.3) || 1;
        const groupCCount = total - groupACount - groupBCount;
        console.log(`Total tracks: ${total}. Group sizes: A=${groupACount}, B=${groupBCount}, C=${groupCCount}`);

        // Divide tracks into groups based on their ranking by likes
        const groupA = tracks.slice(0, groupACount);
        const groupB = tracks.slice(groupACount, groupACount + groupBCount);
        const groupC = tracks.slice(groupACount + groupBCount);

        // Update the "group" field for each track
        for (let track of groupA) {
            track.group = 'A';
            await track.save();
        }
        for (let track of groupB) {
            track.group = 'B';
            await track.save();
        }
        for (let track of groupC) {
            track.group = 'C';
            await track.save();
        }
        console.log("Track groups updated.");

        // Helper function to shuffle an array (Fisher–Yates algorithm)
        function shuffleArray(array) {
            const arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        // Shuffle original tracks within each group
        const originalA = shuffleArray(groupA);
        const originalB = shuffleArray(groupB);
        const originalC = shuffleArray(groupC);

        // Create duplicates for Group A (2 copies) and Group B (1 copy) as new records
        const duplicateA1 = [];
        const duplicateA2 = [];
        for (const track of groupA) {
            try {
                const dup1 = await Track.create({
                    name: track.name,
                    path: track.path,
                    order: null,
                    likes: track.likes,
                    artistId: track.artistId,
                    group: track.group,
                    isDuplicate: true,
                });
                duplicateA1.push(dup1);
                const dup2 = await Track.create({
                    name: track.name,
                    path: track.path,
                    order: null,
                    likes: track.likes,
                    artistId: track.artistId,
                    group: track.group,
                    isDuplicate: true,
                });
                duplicateA2.push(dup2);
            } catch (dupError) {
                console.error("Error creating duplicate for Group A track:", track.name, dupError);
                throw dupError;
            }
        }

        const duplicateB = [];
        for (const track of groupB) {
            try {
                const dup = await Track.create({
                    name: track.name,
                    path: track.path,
                    order: null,
                    likes: track.likes,
                    artistId: track.artistId,
                    group: track.group,
                    isDuplicate: true,
                });
                duplicateB.push(dup);
            } catch (dupError) {
                console.error("Error creating duplicate for Group B track:", track.name, dupError);
                throw dupError;
            }
        }

        // Shuffle duplicates for Group B
        const shuffledDupB = shuffleArray(duplicateB);
        // For Group A duplicates, randomly assign each duplicate to block2 or block3
        const allDupA = [...duplicateA1, ...duplicateA2];
        const dupA_Block2 = [];
        const dupA_Block3 = [];
        for (const dup of allDupA) {
            if (Math.random() < 0.5) {
                dupA_Block2.push(dup);
            } else {
                dupA_Block3.push(dup);
            }
        }

        // Build final play queue:
        // Block 1: Group A originals (must be first)
        const block1 = originalA;

        // Block 2: Group B originals + randomly assigned Group A duplicates
        const block2 = shuffleArray([...originalB, ...dupA_Block2]);

        // Block 3: Group C originals + Group B duplicates + remaining Group A duplicates
        const block3 = shuffleArray([...originalC, ...shuffledDupB, ...dupA_Block3]);

        // Final queue is a concatenation of the three blocks
        const finalQueue = [...block1, ...block2, ...block3];

        // Reassign new sequential order values starting at 1 for all tracks in the final queue
        let order = 1;
        for (let track of finalQueue) {
            track.order = order++;
            await track.save();
        }
        console.log("Tracks reordered by likes and groups successfully.");
    } catch (error) {
        console.error("Error in reorderTracksByLikes:", error);
        throw error;
    }
}

let currentTrackIndex = 0;
let currentTrackStartTime = Date.now();
let trackSwitchTimeout = null;
let wssInstance = null;

// Function to broadcast current track info to all clients
function broadcastCurrentTrack() {
    const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
    if (wssInstance) {
        wssInstance.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({
                    type: 'currentTrack',
                    trackIndex: currentTrackIndex,
                    elapsedTime: elapsedTime
                }));
            }
        });
    }
}

// Function to start playing a track by its index
async function startTrack(index) {
    currentTrackIndex = index;
    currentTrackStartTime = Date.now();
    broadcastCurrentTrack();

    if (trackSwitchTimeout) clearTimeout(trackSwitchTimeout);
    let tracks = await loadTracks();

    // Reorder tracks if the current index exceeds the list length
    if (currentTrackIndex >= tracks.length) {
        await reorderTracksByLikes();
        tracks = await loadTracks();
        currentTrackIndex = 0;
    }

    const currentTrack = tracks[currentTrackIndex];
    if (!currentTrack) {
        console.error(`No track found for index ${currentTrackIndex}`);
        return;
    }

    // Add a small buffer to the duration to ensure complete playback
    // This prevents the next track signal from coming too early
    const durationWithBuffer = (currentTrack.duration || 200) + 3; // 3-second buffer
    const delay = durationWithBuffer * 1000;

    console.log(
        `Now playing "${currentTrack.name}" (order: ${currentTrack.order}) with duration ${currentTrack.duration} sec. Adding 3-sec buffer. Next track in ${delay} ms.`
    );

    trackSwitchTimeout = setTimeout(async () => {
        let nextIndex = currentTrackIndex + 1;

        if (nextIndex >= tracks.length) {
            // Call the reorder route when the last track finishes
            try {
                const response = await fetch(`${process.env.VITE_BACKEND_URL}/api/tracks/reorder`, {
                    method: 'POST',
                });
                if (!response.ok) {
                    throw new Error('Failed to reorder tracks');
                }
                const updatedTracks = await response.json();
                console.log('Tracks reordered:', updatedTracks);
                tracks = updatedTracks;
                nextIndex = 0;
            } catch (error) {
                console.error('Error reordering tracks:', error);
            }
        }
        startTrack(nextIndex);
    }, delay);
}

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

wssInstance = setupWebSocket(server, {
    getCurrentTrackIndex: () => currentTrackIndex,
    getCurrentTrackStartTime: () => currentTrackStartTime,
});

startTrack(0);

app.get('/current-time', (req, res) => {
    const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
    res.json({ trackIndex: currentTrackIndex, elapsedTime });
});
