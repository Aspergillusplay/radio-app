import express from 'express';
import multer from 'multer';
import { Sequelize } from 'sequelize';
import Track from '../models/track.js';
import Artist from '../models/artist.js';
import TrackLike from '../models/likes.js';
import minioClient from '../clients/minioClient.js';
import { reorderTracksByLikes } from '../server.js';

const router = express.Router();

// Helper function to find a track and all its duplicates
async function findTrackAndDuplicates(trackId) {
  // Get the track
  const track = await Track.findByPk(trackId);
  if (!track) return { original: null, duplicates: [], allTracks: [] };

  // If it's a duplicate, find the original track
  let originalTrack;
  if (track.isDuplicate) {
    originalTrack = await Track.findOne({
      where: {
        name: track.name,
        path: track.path,
        isDuplicate: false
      }
    });
  } else {
    originalTrack = track;
  }

  if (!originalTrack) return { original: track, duplicates: [], allTracks: [track] };

  // Find all duplicates of the original track
  const duplicates = await Track.findAll({
    where: {
      name: originalTrack.name,
      path: originalTrack.path,
      id: { [Sequelize.Op.ne]: originalTrack.id } // Not the original
    }
  });

  return {
    original: originalTrack,
    duplicates,
    allTracks: [originalTrack, ...duplicates]
  };
}

// Multer storage configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/flac'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file format'), false);
        }
    }
});

// Route for uploading audio files
router.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file not provided.' });
        }
        const bucketName = 'audio';
        const fileName = req.file.originalname;

        console.log('Uploaded file:', req.file);
        console.log('Form data:', req.body);

        await minioClient.putObject(bucketName, fileName, req.file.buffer, async (err, etag) => {
            if (err) {
                console.error('Error uploading audio file:', err);
                return res.status(500).json({ error: 'Server error during audio upload' });
            }
            console.log('File successfully uploaded to MinIO:', etag);
            res.status(201).json({ message: 'File uploaded successfully' });

            let order;
            if (req.body.order) {
                order = parseInt(req.body.order, 10);
            } else {
                const maxOrder = await Track.max('order') || 0;
                order = maxOrder + 1;
            }

            const trackData = {
                name: req.body.name || req.file.originalname,
                path: fileName,
                order: order,
                likes: 0,
                artistId: req.body.artistId || null,
                isDuplicate: false,
            };

            await Track.create(trackData);
        });
    } catch (error) {
        console.error('Error uploading audio file:', error);
        res.status(500).json({ error: 'Server error during audio upload' });
    }
});

// Route to get tracks with their artists
router.get('/', async (req, res) => {
    try {
        const tracks = await Track.findAll({
            order: [['order', 'ASC']],
            include: {
                model: Artist,
                attributes: ['id', 'name', 'image'],
            }
        });
        res.json(tracks);
    } catch (error) {
        console.error('Error retrieving tracks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stream route with Range support
router.get('/stream/:filename', (req, res) => {
    const bucket = 'audio';
    const filename = req.params.filename;

    minioClient.statObject(bucket, filename, (err, stat) => {
        if (err) {
            console.error(`Error getting metadata for file ${filename}:`, err);
            return res.status(404).json({ error: 'File not found' });
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'audio/mpeg'
            });
            minioClient.getPartialObject(bucket, filename, start, chunkSize, (err, dataStream) => {
                if (err) {
                    console.error(`Error getting partial object ${filename}:`, err);
                    return res.status(500).send(err.message);
                }
                dataStream.pipe(res);
            });
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg'
            });
            minioClient.getObject(bucket, filename, (err, dataStream) => {
                if (err) {
                    console.error(`Error getting file ${filename}:`, err);
                    return res.status(500).send(err.message);
                }
                dataStream.pipe(res);
            });
        }
    });
});

// Modified like route
router.post('/like', async (req, res) => {
    const { TrackId, UserId } = req.body;
    if (!UserId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    try {
        console.log('Received like request:', { TrackId, UserId });

        // Find the track and all its duplicates/original
        const { original, allTracks } = await findTrackAndDuplicates(TrackId);

        if (!original) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Check if user already liked any version of this track
        const existingLike = await TrackLike.findOne({
            where: {
                TrackId: allTracks.map(t => t.id),
                UserId
            }
        });

        if (existingLike) {
            console.log('User already liked this track or its duplicate');
            return res.status(400).json({ error: 'You already liked this track' });
        }

        // Create like entries for all versions of the track
        const likePromises = allTracks.map(t =>
            TrackLike.create({ TrackId: t.id, UserId })
        );
        await Promise.all(likePromises);

        // Increment likes count for all versions
        const updatePromises = allTracks.map(t => {
            t.likes += 1;
            return t.save();
        });
        await Promise.all(updatePromises);

        console.log(`Track and its ${allTracks.length - 1} duplicates liked successfully`);
        res.status(200).json({ message: 'Track liked successfully' });
    } catch (error) {
        console.error('Error processing like request:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Modified unlike route
router.delete('/like', async (req, res) => {
    const { TrackId, UserId } = req.query;
    try {
        // Find the track and all its duplicates/original
        const { original, allTracks } = await findTrackAndDuplicates(TrackId);

        if (!original) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Delete all likes for this user and any version of the track
        const deleted = await TrackLike.destroy({
            where: {
                TrackId: allTracks.map(t => t.id),
                UserId
            }
        });

        if (!deleted) {
            return res.status(400).json({ error: "You haven't liked this track yet" });
        }

        // Decrement likes count for all versions
        const updatePromises = allTracks.map(t => {
            t.likes = Math.max(0, t.likes - 1);
            return t.save();
        });
        await Promise.all(updatePromises);

        console.log(`Track and its ${allTracks.length - 1} duplicates unliked successfully`);
        res.status(200).json({ message: 'Track unliked successfully' });
    } catch (error) {
        console.error('Error processing unlike request:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Modified like status check
router.post('/like/status', async (req, res) => {
    const { TrackId, UserId } = req.body;
    try {
        // Find the track and all its duplicates/original
        const { original, allTracks } = await findTrackAndDuplicates(TrackId);

        if (!original) {
            return res.status(404).json({ error: 'Track not found' });
        }

        // Check if user liked any version of this track
        const existingLike = await TrackLike.findOne({
            where: {
                TrackId: allTracks.map(t => t.id),
                UserId
            }
        });

        res.status(200).json({ isLiked: !!existingLike });
    } catch (error) {
        console.error('Error fetching like status:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Reorder route that calls the new logic in server.js
router.post('/reorder', async (req, res) => {
    try {
        await reorderTracksByLikes();
        const updatedTracks = await Track.findAll({ order: [['order', 'ASC']] });
        res.json(updatedTracks);
    } catch (error) {
        console.error('Error reordering tracks:', error);
        res.status(500).json({ error: 'Failed to reorder tracks' });
    }
});

// Route to delete a track
router.delete('/:id', async (req, res) => {
    try {
        const trackId = req.params.id;
        const track = await Track.findByPk(trackId);
        if (!track) {
            return res.status(404).json({ error: 'Track not found' });
        }
        await track.destroy();
        res.status(200).json({ message: 'Track deleted successfully' });
    } catch (error) {
        console.error('Error deleting track:', error);
        res.status(500).json({ error: 'Failed to delete track' });
    }
});

// Route to set a track as next to play
router.post('/queue-next/:id', async (req, res) => {
    try {
        const trackId = parseInt(req.params.id, 10);
        console.log(`Queuing track ${trackId} as next`);

        // Get current track index from the server state
        // Fix the URL to use the correct port
        const apiBaseUrl = `http://localhost:${process.env.PORT || 3010}`;
        console.log(`Fetching from: ${apiBaseUrl}/current-time`);

        const response = await fetch(`${apiBaseUrl}/current-time`);

        if (!response.ok) {
            console.error(`Failed to get current track info: ${response.status} ${response.statusText}`);
            return res.status(500).json({ error: 'Failed to get current track info' });
        }

        const data = await response.json();
        console.log('Current track data:', data);

        const currentTrackIndex = data.trackIndex;

        if (currentTrackIndex === undefined || currentTrackIndex === null) {
            return res.status(400).json({ error: 'Current track index is not available' });
        }

        // Get all tracks ordered by their current order
        const tracks = await Track.findAll({
            order: [['order', 'ASC']]
        });

        // Find the current playing track and the selected track
        const currentTrack = tracks.find(t => t.order === currentTrackIndex);
        const selectedTrack = tracks.find(t => t.id === trackId);

        if (!currentTrack) {
            return res.status(404).json({ error: 'Current track not found' });
        }

        if (!selectedTrack) {
            return res.status(404).json({ error: 'Selected track not found' });
        }

        // Calculate the new position for the selected track (right after current track)
        const newPosition = currentTrack.order + 1;
        const oldPosition = selectedTrack.order;

        // If selected track is already the next track, no change needed
        if (newPosition === oldPosition) {
            return res.status(200).json({ message: 'Track is already next in queue' });
        }

        // Reorder tracks
        for (const track of tracks) {
            if (track.id === selectedTrack.id) {
                // Move selected track to new position
                track.order = newPosition;
            } else if (
                // If old position was higher than new position, shift tracks between new and old position up
                oldPosition > newPosition &&
                track.order > newPosition &&
                track.order <= oldPosition
            ) {
                track.order += 1;
            }
            // If old position was lower than new position, shift tracks between old and new position down
            else if (
                oldPosition < newPosition &&
                track.order > oldPosition &&
                track.order <= newPosition
            ) {
                track.order -= 1;
            }

            await track.save();
        }

        res.status(200).json({ message: 'Track queued as next to play' });
    } catch (error) {
        console.error('Error queuing track:', error);
        res.status(500).json({ error: 'Failed to queue track' });
    }
});

export default router;