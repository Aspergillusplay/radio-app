import { useState, useRef, useEffect } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { CircularProgress, IconButton, Typography, Box, Snackbar, Alert } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from '@mui/icons-material/Favorite';
import classNames from 'classnames';
import { auth } from "../Firebase";

interface IArtist {
    id: number;
    name: string;
    image: string;
}

interface ITrack {
    id: number;
    name: string;
    path: string;
    Artist?: IArtist;
    likes: number;
    order?: number;
}

interface DbUser {
    id: number; // Database user ID
    firebaseId: string;
    role: "USER" | "ADMIN";
    createdAt?: string;
    updatedAt?: string;
}

const MusicPlayer = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const isManuallyPausedRef = useRef(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [, setFirebaseUserId] = useState<string | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showError, setShowError] = useState(false);
    const playRequestPending = useRef(false);
    const wsRef = useRef<WebSocket | null>(null);

    // Track preloading state
    const preloadedTracks = useRef<Map<number, HTMLAudioElement>>(new Map());
    const currentPreloadingIndex = useRef<number | null>(null);

    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<AudioPlayer>(null);

    // Keep the manual pause flag in ref for callbacks
    useEffect(() => {
        isManuallyPausedRef.current = isManuallyPaused;
    }, [isManuallyPaused]);

    // Handle API errors
    const handleApiError = (message: string, error: unknown) => {
        console.error(message, error);
        setErrorMessage(`${message}. Please try again.`);
        setShowError(true);
    };

    // Close error snackbar
    const handleCloseError = () => {
        setShowError(false);
    };

    // Advanced preloading system that maintains a map of preloaded tracks
    const preloadTrack = (trackIndex: number) => {
        if (!tracks.length || trackIndex < 0 || trackIndex >= tracks.length) return;

        // Don't preload if already preloading this track
        if (currentPreloadingIndex.current === trackIndex) return;

        // Don't preload if already preloaded
        if (preloadedTracks.current.has(trackIndex)) return;

        const track = tracks[trackIndex];
        console.log(`Starting preload for track: ${track.name} (index: ${trackIndex})`);

        currentPreloadingIndex.current = trackIndex;

        const audio = new Audio();
        audio.preload = "auto";
        audio.volume = 0;

        // Track loading events
        audio.addEventListener('canplaythrough', () => {
            console.log(`Track preloaded successfully: ${track.name} (index: ${trackIndex})`);
            preloadedTracks.current.set(trackIndex, audio);
            currentPreloadingIndex.current = null;

            // Start preloading the next track in sequence
            preloadTrack((trackIndex + 1) % tracks.length);
        });

        audio.addEventListener('error', (e) => {
            console.error(`Error preloading track ${track.name}:`, e);
            currentPreloadingIndex.current = null;
        });

        const audioSrc = `${import.meta.env.VITE_BACKEND_URL}/api/tracks/stream/${track.path}`;
        audio.src = audioSrc;
        audio.load();
    };

    // Initialize preloading when track list is available
    useEffect(() => {
        if (!tracks.length || currentTrackIndex === null) return;

        // Preload next track
        const nextIndex = (currentTrackIndex + 1) % tracks.length;
        preloadTrack(nextIndex);

        // Also preload the track after next for even smoother experience
        const nextNextIndex = (currentTrackIndex + 2) % tracks.length;
        setTimeout(() => {
            preloadTrack(nextNextIndex);
        }, 1000);

        // Cleanup function
        return () => {
            preloadedTracks.current.forEach((audio) => {
                audio.pause();
                audio.src = '';
            });
            preloadedTracks.current.clear();
        };
    }, [currentTrackIndex, tracks]);

    // Set up authentication listener
    useEffect(() => {
        console.log("Setting up auth listener in MusicPlayer");
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Firebase user logged in:", user.uid);
                setFirebaseUserId(user.uid);

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.uid}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Failed to fetch user data");
                        }
                        return response.json();
                    })
                    .then((data: DbUser) => {
                        console.log("Database user data received:", data);
                        setDbUser(data);
                    })
                    .catch((error) => {
                        console.error("Error fetching DB user:", error);
                        setDbUser(null);
                    });
            } else {
                console.log("No user logged in");
                setFirebaseUserId(null);
                setDbUser(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Toggle header visibility
    const toggleHeaderVisibility = () => {
        setIsHeaderVisible(v => !v);
    };

    // Handle like/unlike track
    const handleLikeToggle = async () => {
        if (currentTrackIndex === null || !dbUser || !dbUser.id) {
            setErrorMessage("Please log in to like tracks");
            setShowError(true);
            return;
        }

        const trackId = tracks[currentTrackIndex].id;
        console.log(`Toggling like for track ${trackId}, using DB user ID: ${dbUser.id}`);

        try {
            let response;
            if (isLiked) {
                console.log(`Removing like for track ${trackId}, DB userId: ${dbUser.id}`);
                response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${trackId}&UserId=${dbUser.id}`,
                    {
                        method: "DELETE",
                    }
                );
            } else {
                console.log(`Adding like for track ${trackId}, DB userId: ${dbUser.id}`);
                response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ TrackId: trackId, UserId: dbUser.id }),
                    }
                );
            }
            if (!response.ok) {
                console.error("Error response:", response.status, response.statusText);
                const errorText = await response.text().catch(() => "Unknown error");
                console.error("Error details:", errorText);
                throw new Error("Failed to update like status");
            }
            setIsLiked(l => !l);
        } catch (err) {
            handleApiError("Error updating like status", err);
        }
    };

    // Show/hide header element outside React tree
    useEffect(() => {
        const header = document.querySelector('header');
        if (header) header.setAttribute('style', `display: ${isHeaderVisible ? 'block' : 'none'}`);
    }, [isHeaderVisible]);

    // Fetch like status for the current track
    useEffect(() => {
        if (tracks.length === 0 || currentTrackIndex === null || !dbUser || !dbUser.id) return;
        const trackId = tracks[currentTrackIndex].id;

        (async () => {
            try {
                console.log(`Checking like status for track ${trackId} with DB userId: ${dbUser.id}`);
                const res = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ TrackId: trackId, UserId: dbUser.id }),
                    }
                );
                if (!res.ok) {
                    console.error("Error response:", res.status, res.statusText);
                    const errorText = await res.text().catch(() => "Unknown error");
                    console.error("Error details:", errorText);
                    throw new Error('Failed to fetch like status');
                }
                const data = await res.json();
                setIsLiked(data.isLiked);
            } catch (e) {
                console.error('Error fetching like status:', e);
            }
        })();
    }, [currentTrackIndex, tracks, dbUser?.id]);

    // Restore saved volume
    useEffect(() => {
        const saved = localStorage.getItem('player-volume');
        if (saved !== null) setVolume(parseFloat(saved));
    }, []);

    // Load tracks list
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks`);
                if (!res.ok) throw new Error('Failed to fetch tracks');
                const data: ITrack[] = await res.json();
                setTracks(data);
            } catch (e) {
                console.error('Error fetching tracks:', e);
                setTracksError('Failed to load track list');
            } finally {
                setLoadingTracks(false);
            }
        })();
    }, []);

    // On initial tracks load, fetch current playback info
    useEffect(() => {
        if (tracks.length === 0) return;
        fetch(`${import.meta.env.VITE_BACKEND_URL}/current-time`)
            .then(r => r.json())
            .then(d => {
                setCurrentTrackIndex(d.trackIndex);
                setElapsedTime(d.elapsedTime);
                setIsPlaying(true); // Auto-play on initial load
            })
            .catch(e => console.error('Error fetching current time on mount:', e));
    }, [tracks]);

    // Setup WebSocket connection
    useEffect(() => {
        const setupWebsocket = () => {
            const apiBase = import.meta.env.VITE_BACKEND_URL.replace(/\/$/, "");
            const wsUrl = apiBase.replace(/^http/, 'ws') + '/api/';
            console.log('Connecting WebSocket to', wsUrl);

            wsRef.current?.close();
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => console.log('WebSocket connection established');
            ws.onerror = e => console.error('WebSocket error:', e);
            ws.onmessage = ev => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.type === 'currentTrack') {
                        // If track changed
                        if (data.trackIndex !== currentTrackIndex) {
                            // Check if we have this track preloaded
                            const hasPreloaded = preloadedTracks.current.has(data.trackIndex);
                            console.log(`Track change detected. Preloaded: ${hasPreloaded ? "Yes" : "No"}`);

                            // Show loading only if not preloaded
                            if (!hasPreloaded) {
                                setIsAudioLoading(true);
                            }
                        }

                        // Update track info from server
                        setCurrentTrackIndex(data.trackIndex);
                        setElapsedTime(data.elapsedTime);

                        // Play if not manually paused
                        if (!isManuallyPausedRef.current) {
                            setIsPlaying(true);
                        }

                        // Start preloading next tracks immediately
                        if (tracks.length > 0) {
                            const nextIndex = (data.trackIndex + 1) % tracks.length;
                            preloadTrack(nextIndex);
                        }
                    }
                } catch (err) {
                    console.error('Error handling WebSocket message:', err);
                }
            };
            ws.onclose = () => {
                console.log('WebSocket closed — retrying in 2s');
                setTimeout(setupWebsocket, 2000);
            };

            wsRef.current = ws;
        };

        setupWebsocket();
        return () => { wsRef.current?.close(); wsRef.current = null; };
    }, []);

    // Safely attempt to play audio
    const safePlayAudio = (audio: HTMLAudioElement) => {
        if (playRequestPending.current) return;

        playRequestPending.current = true;
        audio.play()
            .then(() => {
                playRequestPending.current = false;
            })
            .catch(e => {
                playRequestPending.current = false;
                // Only log non-abort errors as real errors
                if (e.name !== 'AbortError') {
                    console.error('Play error:', e);
                } else {
                    console.log('Play request was aborted due to new load request');
                }
            });
    };

    // Sync audio playback position with optimized preloading
    useEffect(() => {
        if (currentTrackIndex === null || elapsedTime === null) return;

        // Check if we have the track preloaded
        if (preloadedTracks.current.has(currentTrackIndex)) {
            console.log(`Using preloaded track at index ${currentTrackIndex}`);

            // Get preloaded audio
            const preloadedAudio = preloadedTracks.current.get(currentTrackIndex)!;

            // If we have an audio player reference, update its src from preloaded audio
            if (audioRef.current?.audio.current) {
                const currentAudio = audioRef.current.audio.current;

                // Only set src if it's different (avoid unnecessary reloading)
                if (currentAudio.src !== preloadedAudio.src) {
                    currentAudio.src = preloadedAudio.src;
                }

                // Set the current time and play state
                currentAudio.currentTime = elapsedTime;
                if (isPlaying && !isManuallyPausedRef.current) {
                    setIsAudioLoading(false); // Immediately mark as not loading since we've preloaded
                    safePlayAudio(currentAudio);
                }
            }

            // Remove the used preloaded track
            preloadedTracks.current.delete(currentTrackIndex);
        } else if (audioRef.current?.audio.current) {
            // No preloaded track, fallback to normal loading
            const audio = audioRef.current.audio.current;

            if (!isManuallyPaused) {
                audio.currentTime = elapsedTime;
                if (isPlaying) {
                    safePlayAudio(audio);
                }
            }
        }

        // Start preloading the next tracks immediately
        if (tracks.length > 0) {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            preloadTrack(nextIndex);

            // Preload the track after next for even smoother experience
            setTimeout(() => {
                const nextNextIndex = (currentTrackIndex + 2) % tracks.length;
                preloadTrack(nextNextIndex);
            }, 500);
        }
    }, [currentTrackIndex, elapsedTime, isPlaying, isManuallyPaused, tracks.length]);

    // Handle play/pause actions
    const handlePlayPause = async (play: boolean) => {
        setIsPlaying(play);
        if (imgRef.current) imgRef.current.style.animationPlayState = play ? 'running' : 'paused';
        if (play) {
            setIsManuallyPaused(false);
            isManuallyPausedRef.current = false;
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/current-time`);
                if (!res.ok) return;
                const d = await res.json();

                setCurrentTrackIndex(d.trackIndex);
                setElapsedTime(d.elapsedTime);

                const audio = audioRef.current?.audio.current;
                if (audio) {
                    audio.currentTime = d.elapsedTime;
                    safePlayAudio(audio);
                }
            } catch (e) {
                console.error('Error during play fetch:', e);
            }
        } else {
            setIsManuallyPaused(true);
            isManuallyPausedRef.current = true;
            const audio = audioRef.current?.audio.current;
            if (audio) setElapsedTime(audio.currentTime);
        }
    };

    // Volume change handler
    const handleVolumeChange = (e: Event) => {
        const newVolume = (e.target as HTMLAudioElement).volume;
        setVolume(newVolume);
        localStorage.setItem('player-volume', newVolume.toString());
    };

    // Handle audio ready to play
    const handleCanPlayThrough = () => {
        setIsAudioLoading(false);

        // If ready to play and should be playing, play it
        if (isPlaying && !isManuallyPausedRef.current && audioRef.current?.audio.current) {
            safePlayAudio(audioRef.current.audio.current);
        }
    };

    // Render loading state
    if (loadingTracks) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={60} thickness={2.5} />
            </Box>
        );
    }

    // Render error state
    if (tracksError) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography>{tracksError}</Typography>
            </Box>
        );
    }

    // Render if no tracks or index invalid
    if (currentTrackIndex === null || tracks.length === 0) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography>No track available</Typography>
            </Box>
        );
    }

    const currentTrack = tracks[currentTrackIndex];
    const audioSrc = `${import.meta.env.VITE_BACKEND_URL}/api/tracks/stream/${currentTrack.path}`;

    const artistImage = currentTrack.Artist?.image
        ? `${import.meta.env.VITE_MINIO_URL}/images/${currentTrack.Artist.image}`
        : `${import.meta.env.VITE_MINIO_URL}/images/defaultAlbumArt.jpg`;

    return (
        <div
            className={classNames("min-h-screen flex justify-center items-center p-4", {
                "animate-gradient": isPlaying,
                "bg-gradient-to-br from-blue-100 to-blue-300": !isPlaying
            })}
            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
        >
            <Box
                className="bg-white bg-opacity-50 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full text-center"
            >
                <Box mb={6}>
                    <img
                        ref={imgRef}
                        src={artistImage}
                        alt={currentTrack.Artist?.name || 'Unknown Artist'}
                        className="mx-auto h-48 w-48 sm:h-64 sm:w-64 md:h-72 md:w-72 rounded-full shadow-xl animate-slow-spin cursor-pointer"
                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                        onClick={toggleHeaderVisibility}
                    />
                </Box>

                <Typography variant="h5" fontWeight="bold">
                    {currentTrack.Artist?.name || 'Unknown Artist'}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary" mb={4}>
                    {currentTrack.name}
                </Typography>

                <AudioPlayer
                    ref={audioRef}
                    className="custom-audio-player m-0"
                    style={{
                        borderRadius: "1rem",
                        background: "rgba(255, 255, 255, 0.9)",
                    }}
                    src={audioSrc}
                    onPlay={() => handlePlayPause(true)}
                    onPause={() => handlePlayPause(false)}
                    onCanPlayThrough={handleCanPlayThrough}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    autoPlayAfterSrcChange={true}
                    autoPlay={!isManuallyPaused}
                    listenInterval={1000}
                    onLoadStart={() => setIsAudioLoading(true)}
                    onLoadedMetaData={() => {
                        if (audioRef.current?.audio.current && elapsedTime !== null && !isManuallyPaused) {
                            audioRef.current.audio.current.currentTime = elapsedTime;
                        }
                    }}
                    showSkipControls={false}
                    showJumpControls={false}
                    customAdditionalControls={[
                        <IconButton
                            onClick={handleLikeToggle}
                            key="like-button"
                            disabled={!dbUser || !dbUser.id}
                        >
                            {isLiked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                        </IconButton>
                    ]}
                    customProgressBarSection={[]}
                />
                {isAudioLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Box>

            <Snackbar open={showError} autoHideDuration={6000} onClose={handleCloseError}>
                <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default MusicPlayer;