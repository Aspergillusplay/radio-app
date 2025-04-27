import express from 'express';
import cors from 'cors';
import http from 'http';
import setupWebSocket from './websocket.js';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';
import artistsRoutes from './routes/artists.js';
import wishesRoutes from './routes/wishes.js';
import Track from './models/track.js';
import minioClient from './clients/minioClient.js';
import { parseStream } from 'music-metadata';

const app = express();
const port = 3010;

// Track cache: stores loaded tracks for faster access
let loadedTracks = [];

// Cache for preloaded track metadata
const preloadedTracksCache = new Map();

// Track playback state
let currentTrackIndex = 0;
let currentTrackStartTime = Date.now();
let trackSwitchTimeout = null;
let wssInstance = null;

// Preload status tracking (to avoid duplicate preloads)
const preloadingStatus = new Map();

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

// Initialize database connection
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

/**
 * Computes track duration by analyzing audio metadata from MinIO
 * @param {Object} track - Track object with path property
 * @returns {Promise<number|null>} - Duration in seconds or null if error
 */
async function computeTrackDuration(track) {
    // Check if we already have this track's metadata cached
    const cacheKey = `duration:${track.path}`;
    if (preloadedTracksCache.has(cacheKey)) {
        console.log(`Using cached duration for ${track.name}: ${preloadedTracksCache.get(cacheKey)} sec`);
        return preloadedTracksCache.get(cacheKey);
    }

    return new Promise((resolve) => {
        const bucket = 'audio';
        minioClient.getObject(bucket, track.path, async (err, stream) => {
            if (err) {
                console.error(`Error getting file ${track.path} from MinIO:`, err);
                resolve(null);
                return;
            }
            try {
                console.log(`Parsing metadata for track: ${track.name}`);
                const metadata = await parseStream(stream, null, { duration: true });
                const duration = metadata.format.duration;

                // Cache the result for future use
                if (duration) {
                    preloadedTracksCache.set(cacheKey, duration);
                }

                resolve(duration);
            } catch (parseErr) {
                console.error(`Error parsing metadata for track ${track.name}:`, parseErr);
                resolve(null);
            }
        });
    });
}

/**
 * Preloads track metadata for faster future access
 * @param {number} trackIndex - Index of track to preload
 * @param {number} count - Number of tracks to preload (default: 2)
 */
async function preloadTrackMetadata(trackIndex, count = 2) {
    if (!loadedTracks.length) return;

    // Create an array of track indices to preload
    const indicesToPreload = [];
    for (let i = 0; i < count; i++) {
        const index = (trackIndex + i) % loadedTracks.length;
        indicesToPreload.push(index);
    }

    // Start preloading all tracks in parallel
    await Promise.all(indicesToPreload.map(async (index) => {
        const track = loadedTracks[index];
        if (!track) return;

        // Skip if already preloading or preloaded
        const preloadKey = `preload:${track.id}`;
        if (preloadingStatus.get(preloadKey) === 'loading' ||
            preloadingStatus.get(preloadKey) === 'loaded') {
            return;
        }

        // Mark as loading
        preloadingStatus.set(preloadKey, 'loading');

        // Preload duration if not available
        if (!track.duration) {
            console.log(`Preloading metadata for track: ${track.name} (index: ${index})`);
            try {
                const duration = await computeTrackDuration(track);
                if (duration) {
                    // Update in memory
                    track.duration = Math.floor(duration);

                    // Update in database if needed
                    const dbTrack = await Track.findByPk(track.id);
                    if (dbTrack && !dbTrack.duration) {
                        dbTrack.duration = track.duration;
                        await dbTrack.save();
                        console.log(`Updated duration for track ${track.name}: ${track.duration}s`);
                    }
                }
            } catch (error) {
                console.error(`Error preloading metadata for ${track.name}:`, error);
            }
        }

        // Mark as loaded
        preloadingStatus.set(preloadKey, 'loaded');

        // Notify clients that this track is preloaded
        broadcastTrackPreloaded(index);
    }));
}

/**
 * Broadcasts to all clients that a specific track has been preloaded
 * @param {number} trackIndex - Index of preloaded track
 */
function broadcastTrackPreloaded(trackIndex) {
    if (!wssInstance) return;

    const track = loadedTracks[trackIndex];
    if (!track) return;

    wssInstance.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
                type: 'trackPreloaded',
                trackIndex: trackIndex,
                trackId: track.id,
                trackDuration: track.duration || null
            }));
        }
    });
}

/**
 * Loads tracks from database and computes durations if needed
 * @returns {Promise<Array>} - Array of track objects
 */
async function loadTracks() {
    const tracksFromDB = await Track.findAll({ order: [['order', 'ASC']] });
    const newTracks = tracksFromDB.map(track => track.get({ plain: true }));

    for (const track of newTracks) {
        if (!track.duration) {
            const duration = await computeTrackDuration(track);
            track.duration = (duration && duration > 0) ? Math.floor(duration) : 200;
            console.log(`Track "${track.name}" duration: ${track.duration} sec.`);

            // Update duration in the database
            const dbTrack = await Track.findByPk(track.id);
            if (dbTrack) {
                dbTrack.duration = track.duration;
                await dbTrack.save();
            }
        } else {
            console.log(`Track "${track.name}" duration: ${track.duration} sec.`);
        }
    }

    // Save tracks in memory for quick access
    loadedTracks = newTracks;

    // Start preloading the next tracks
    if (newTracks.length > 0 && currentTrackIndex !== null) {
        preloadTrackMetadata(currentTrackIndex, 3);
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
                    duration: track.duration, // Copy duration to duplicate
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
                    duration: track.duration, // Copy duration to duplicate
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
                    duration: track.duration, // Copy duration to duplicate
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

        // Clear preloading status after reordering
        preloadingStatus.clear();

        // Reload tracks after reordering
        await loadTracks();
    } catch (error) {
        console.error("Error in reorderTracksByLikes:", error);
        throw error;
    }
}

/**
 * Broadcasts current track info to all connected clients
 */
function broadcastCurrentTrack() {
    if (!wssInstance) return;

    // Get current track
    const currentTrack = loadedTracks[currentTrackIndex];
    if (!currentTrack) return;

    // Calculate elapsed time
    let elapsedTime = (Date.now() - currentTrackStartTime) / 1000;

    // Ensure elapsed time doesn't exceed track duration
    if (currentTrack.duration && elapsedTime > currentTrack.duration) {
        // If elapsed time exceeds duration, cap it at duration
        elapsedTime = currentTrack.duration;

        // If we've exceeded the track duration, schedule the next track
        if (!trackSwitchTimeout) {
            console.log(`Track ${currentTrack.name} has finished, scheduling next track`);
            scheduleNextTrack();
        }
    }

    // Broadcast to all connected clients
    wssInstance.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({
                type: 'currentTrack',
                trackIndex: currentTrackIndex,
                elapsedTime: elapsedTime,
                trackDuration: currentTrack.duration || null,
                trackId: currentTrack.id
            }));
        }
    });
}

/**
 * Schedules the next track to play when current track ends
 */
function scheduleNextTrack() {
    if (trackSwitchTimeout) {
        clearTimeout(trackSwitchTimeout);
    }

    // Get current track and its duration
    if (!loadedTracks || loadedTracks.length === 0 || currentTrackIndex >= loadedTracks.length) {
        console.warn("Cannot schedule next track: track list is empty or index out of bounds");
        return;
    }

    const currentTrack = loadedTracks[currentTrackIndex];
    if (!currentTrack) {
        console.error(`No track found at index ${currentTrackIndex}`);
        return;
    }

    // Get track duration (with a small buffer to ensure complete playback)
    const trackDuration = (currentTrack.duration || 200) + 1;
    const currentElapsedTime = (Date.now() - currentTrackStartTime) / 1000;

    // Calculate remaining time before next track
    let remainingTime = trackDuration - currentElapsedTime;
    if (remainingTime <= 0) {
        // If we've already passed the track duration, switch immediately
        console.log(`Track ${currentTrack.name} has already finished, switching immediately`);
        playNextTrack();
        return;
    }

    console.log(`Scheduling next track in ${remainingTime.toFixed(2)} seconds`);
    trackSwitchTimeout = setTimeout(playNextTrack, remainingTime * 1000);
}

/**
 * Plays the next track in sequence
 */
async function playNextTrack() {
    let nextTrackIndex = currentTrackIndex + 1;

    // If we've reached the end of the playlist, either loop or reorder
    if (nextTrackIndex >= loadedTracks.length) {
        console.log("End of playlist reached, reordering tracks");
        await reorderTracksByLikes();
        nextTrackIndex = 0;
    }

    // Start the next track
    startTrack(nextTrackIndex);
}

/**
 * Starts playing a track by its index
 * @param {number} index - Index of track to start playing
 */
async function startTrack(index) {
    // Ensure tracks are loaded
    if (loadedTracks.length === 0) {
        await loadTracks();
    }

    // Validate track index
    if (index >= loadedTracks.length) {
        console.error(`Invalid track index: ${index}, max is ${loadedTracks.length - 1}`);
        index = 0;
    }

    console.log(`Starting track at index ${index}: "${loadedTracks[index]?.name}"`);

    // Update current track info
    currentTrackIndex = index;
    currentTrackStartTime = Date.now();

    // Broadcast to all clients
    broadcastCurrentTrack();

    // Preload upcoming tracks
    preloadTrackMetadata(index + 1, 3);

    // Schedule the next track
    scheduleNextTrack();
}

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize WebSocket server with extended interface
wssInstance = setupWebSocket(httpServer, {
    getCurrentTrackIndex: () => currentTrackIndex,
    getCurrentTrackStartTime: () => currentTrackStartTime,
    getTracks: () => loadedTracks
});

// Start HTTP server
httpServer.listen(port, async () => {
    console.log(`Server running at http://localhost:${port}`);

    // Load tracks at startup
    await loadTracks();

    // Start playing from the first track
    startTrack(0);

    // Set up periodic broadcast to keep clients in sync (every 10 seconds)
    setInterval(broadcastCurrentTrack, 10000);
});

// REST API endpoint to get current track info
app.get('/current-time', (req, res) => {
    // Get current track
    const currentTrack = loadedTracks[currentTrackIndex];
    if (!currentTrack) {
        return res.status(404).json({ error: 'No track currently playing' });
    }

    // Calculate elapsed time
    let elapsedTime = (Date.now() - currentTrackStartTime) / 1000;

    // Ensure elapsed time doesn't exceed track duration
    if (currentTrack.duration && elapsedTime > currentTrack.duration) {
        elapsedTime = currentTrack.duration;
    }

    res.json({
        trackIndex: currentTrackIndex,
        elapsedTime,
        trackDuration: currentTrack.duration || null,
        trackName: currentTrack.name,
        trackId: currentTrack.id
    });
});

// REST API endpoint to get information about preloaded tracks
app.get('/tracks/preloaded-status', (req, res) => {
    const preloadInfo = Array.from(preloadingStatus.entries()).reduce((acc, [key, value]) => {
        if (key.startsWith('preload:')) {
            const trackId = key.split(':')[1];
            acc[trackId] = value;
        }
        return acc;
    }, {});

    res.json(preloadInfo);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    if (trackSwitchTimeout) {
        clearTimeout(trackSwitchTimeout);
    }
    httpServer.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});