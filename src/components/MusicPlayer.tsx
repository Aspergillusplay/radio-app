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
    // New state to separate what's displayed from what's loading
    const [displayTrackIndex, setDisplayTrackIndex] = useState<number | null>(null);
    const [nextTrackIndex, setNextTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const isManuallyPausedRef = useRef(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [, setFirebaseUserId] = useState<string | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showError, setShowError] = useState(false);
    const playRequestPending = useRef(false);
    const wsRef = useRef<WebSocket | null>(null);
    const pendingTrackChange = useRef(false);

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
        if (displayTrackIndex === null || !dbUser || !dbUser.id) {
            setErrorMessage("Please log in to like tracks");
            setShowError(true);
            return;
        }

        const trackId = tracks[displayTrackIndex].id;
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
        if (tracks.length === 0 || displayTrackIndex === null || !dbUser || !dbUser.id) return;
        const trackId = tracks[displayTrackIndex].id;

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
    }, [displayTrackIndex, tracks, dbUser?.id]);

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
                const initialIndex = d.trackIndex;
                setCurrentTrackIndex(initialIndex);
                setDisplayTrackIndex(initialIndex); // Also set display track on initial load
                setElapsedTime(d.elapsedTime);
                setIsPlaying(true); // Auto-play on initial load
            })
            .catch(e => console.error('Error fetching current time on mount:', e));
    }, [tracks]);

    // Setup WebSocket connection once (not on every track change)
    useEffect(() => {
        // Ensure ws URL ends with /ws for proper proxy routing
        const setupWebsocket = () => {
            const baseUrl = import.meta.env.VITE_WS_URL;
            const wsUrl = baseUrl.endsWith('/ws') ? baseUrl : `${baseUrl.replace(/^http/, 'ws')}/ws`;

            // Close existing connection if any
            if (wsRef.current) {
                wsRef.current.close();
            }

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => console.log('WebSocket connection established');
            ws.onerror = e => console.error('WebSocket error:', e);
            ws.onmessage = ev => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.type === 'currentTrack') {
                        // Queue track change without immediately updating display
                        if (data.trackIndex !== currentTrackIndex) {
                            if (isInitialLoad) {
                                setIsAudioLoading(true);
                            }
                            setNextTrackIndex(data.trackIndex); // Store next track index
                            setCurrentTrackIndex(data.trackIndex); // Update current for audio source
                            setElapsedTime(data.elapsedTime);
                            if (!isManuallyPausedRef.current) setIsPlaying(true);
                        } else if (!isManuallyPausedRef.current) {
                            setElapsedTime(data.elapsedTime);
                            setIsPlaying(true);
                        }
                    }
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            };
            ws.onclose = () => {
                console.log('WebSocket connection closed');
                // Retry connection after a delay
                setTimeout(setupWebsocket, 2000);
            };

            wsRef.current = ws;
        };

        setupWebsocket();

        return () => {
            if (wsRef.current) {
                // Use a local variable to avoid closure issues
                const ws = wsRef.current;
                wsRef.current = null;
                ws.close();
            }
        };
    }, []); // Empty dependency array - only run once on component mount

    // Safely attempt to play audio
    const safePlayAudio = (audio: HTMLAudioElement) => {
        if (playRequestPending.current) return;

        playRequestPending.current = true;
        audio.play()
            .then(() => {
                playRequestPending.current = false;
                setIsInitialLoad(false); // After first successful play, no longer initial load

                // If this was a pending track change and it succeeded, update display track
                if (nextTrackIndex !== null && currentTrackIndex === nextTrackIndex) {
                    setDisplayTrackIndex(nextTrackIndex);
                    setNextTrackIndex(null);
                }
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

    // Sync audio playback position
    useEffect(() => {
        if (
            currentTrackIndex === null ||
            elapsedTime === null ||
            !audioRef.current?.audio.current
        ) return;

        const audio = audioRef.current.audio.current;
        if (!isManuallyPaused) {
            audio.currentTime = elapsedTime;
            if (isPlaying) {
                safePlayAudio(audio);
            }
        }
    }, [currentTrackIndex, elapsedTime, isPlaying, isManuallyPaused]);

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
                setDisplayTrackIndex(d.trackIndex); // Also update display track
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

    // Move to next track
    const handleNextTrack = () => {
        if (tracks.length === 0 || displayTrackIndex === null) return;

        // Don't show loading indicator when switching tracks if already playing
        if (isInitialLoad) {
            setIsAudioLoading(true);
        }

        const nextIndex = (displayTrackIndex + 1) % tracks.length;
        setNextTrackIndex(nextIndex); // Queue the next track
        setCurrentTrackIndex(nextIndex); // Update for audio loading
        setElapsedTime(0);
        setIsManuallyPaused(false);
        isManuallyPausedRef.current = false;
        pendingTrackChange.current = true;
    };

    // Handle when audio is ready to play
    const handleCanPlayThrough = () => {
        setIsAudioLoading(false);

        // If audio is ready to play, update the display track if we have a pending change
        if (nextTrackIndex !== null && currentTrackIndex === nextTrackIndex) {
            if (isPlaying && !isManuallyPausedRef.current) {
                // If playing, try playing first, display will update on successful play
                if (audioRef.current?.audio.current) {
                    safePlayAudio(audioRef.current.audio.current);
                }
            } else {
                // If not playing, update display immediately
                setDisplayTrackIndex(nextTrackIndex);
                setNextTrackIndex(null);
            }
        } else if (isPlaying && !isManuallyPausedRef.current && audioRef.current?.audio.current) {
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
    if (displayTrackIndex === null || tracks.length === 0) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography>No track available</Typography>
            </Box>
        );
    }

    // Use displayTrackIndex for UI, currentTrackIndex for audio source
    const displayTrack = tracks[displayTrackIndex];
    const audioSrc = currentTrackIndex !== null ?
        `${import.meta.env.VITE_BACKEND_URL}/api/tracks/stream/${tracks[currentTrackIndex].path}` :
        '';

    const artistImage = displayTrack.Artist?.image
        ? `${import.meta.env.VITE_MINIO_URL}/images/${displayTrack.Artist.image}`
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
                        alt={displayTrack.Artist?.name || 'Unknown Artist'}
                        className="mx-auto h-48 w-48 sm:h-64 sm:w-64 md:h-72 md:w-72 rounded-full shadow-xl animate-slow-spin cursor-pointer"
                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                        onClick={toggleHeaderVisibility}
                    />
                </Box>

                <Typography variant="h5" fontWeight="bold">
                    {displayTrack.Artist?.name || 'Unknown Artist'}
                </Typography>
                <Typography variant="subtitle1" color="textSecondary" mb={4}>
                    {displayTrack.name}
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
                    onEnded={handleNextTrack}
                    onError={() => handleNextTrack()}
                    onLoadStart={() => {
                        // Only show loading indicator on initial load, not on track switch
                        if (isInitialLoad) {
                            setIsAudioLoading(true);
                        }
                    }}
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
                {/* Only show loading indicator on initial load */}
                {isAudioLoading && isInitialLoad && (
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