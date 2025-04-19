import { useEffect, useState, useRef } from "react";
import Header from "./Header";
import {
    IconButton, Card, CardMedia, CardContent, Typography, Grid, Box, 
    CircularProgress, Snackbar, Alert, Button, Dialog, DialogActions, 
    DialogContent, DialogContentText, DialogTitle
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import { onAuthStateChanged } from "firebase/auth";
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
    isLiked?: boolean;
    likes?: number;
}

interface DbUser {
    id: number;
    firebaseId: string;
    role: "USER" | "ADMIN";
    createdAt?: string;
    updatedAt?: string;
}

interface WebSocketMessage {
    type: string;
    trackIndex: number;
    elapsedTime: number;
}

const AudioList = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [, setFirebaseUserId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [showError, setShowError] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    
    // New state for Play Next feature
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [selectedTrackToQueue, setSelectedTrackToQueue] = useState<ITrack | null>(null);

    // Handle API errors - fixed ESLint warning by using unknown instead of any
    const handleApiError = (message: string, error: unknown) => {
        console.error(message, error);
        setErrorMessage(`${message}. Please try again.`);
        setShowError(true);
    };

    // Close error snackbar
    const handleCloseError = () => {
        setShowError(false);
    };

    // Extracted fetchTracks function to be called independently
    const fetchTracks = async () => {
        try {
            console.log("Fetching tracks...");
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks`);
            if (!response.ok) {
                throw new Error("Failed to fetch tracks");
            }
            const data = await response.json();
            console.log("Tracks data received:", data.length, "tracks");

            // Only fetch like status if we have a dbUser with ID
            if (dbUser && dbUser.id) {
                console.log("User is logged in, fetching like statuses for DB user ID:", dbUser.id);
                const tracksWithLikes = await Promise.all(
                    data.map(async (track: ITrack) => {
                        try {
                            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    TrackId: track.id,
                                    UserId: dbUser.id
                                }),
                            });

                            if (!res.ok) {
                                console.error(`Error response from like/status for track ${track.id}:`,
                                    res.status, res.statusText);
                                return { ...track, isLiked: false };
                            }

                            const likeData = await res.json();
                            return { ...track, isLiked: likeData.isLiked };
                        } catch (error) {
                            console.error(`Error fetching like status for track ${track.id}:`, error);
                            return { ...track, isLiked: false };
                        }
                    })
                );
                console.log("Fetched tracks with like statuses:", tracksWithLikes);
                setTracks(tracksWithLikes);
            } else {
                console.log("No database user ID, setting tracks without like status");
                setTracks(data.map((track: ITrack) => ({ ...track, isLiked: false })));
            }

            // Fetch current track info
            fetchCurrentTrackInfo();
        } catch (err) {
            console.error("Error fetching tracks:", err);
            setError("Failed to fetch tracks");
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentTrackInfo = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/current-time`);
            if (!response.ok) {
                throw new Error("Failed to fetch current track info");
            }
            const data = await response.json();
            setCurrentTrackIndex(data.trackIndex);
            setIsPlaying(true);
        } catch (error) {
            console.error("Error fetching current track info:", error);
        }
    };

    useEffect(() => {
        const setupWebsocket = () => {
            try {
                const wsUrl = `${import.meta.env.VITE_BACKEND_URL.replace('http', 'ws')}/`;
                console.log("Setting up WebSocket connection to:", wsUrl);
                const ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log("WebSocket connection established");
                    ws.send(JSON.stringify({ type: 'getCurrentTrack' }));
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data) as WebSocketMessage;
                        if (message.type === 'currentTrack') {
                            setCurrentTrackIndex(message.trackIndex);
                            setIsPlaying(true);
                        }
                    } catch (error) {
                        console.error("Error processing WebSocket message:", error);
                    }
                };

                ws.onerror = (error) => {
                    console.error("WebSocket error:", error);
                };

                ws.onclose = () => {
                    console.log("WebSocket connection closed");
                };

                wsRef.current = ws;
            } catch (error) {
                console.error("Error setting up WebSocket:", error);
            }
        };

        console.log("Setting up auth listener");
        const listener = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Firebase user logged in:", user.uid);
                setFirebaseUserId(user.uid);

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.uid}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Failed to fetch user from DB");
                        }
                        return response.json();
                    })
                    .then((data: DbUser) => {
                        console.log("Database user data received:", data);
                        setDbUser(data);
                        fetchTracks();
                        setupWebsocket();
                    })
                    .catch((error) => {
                        console.error("Error fetching DB user:", error);
                        fetchTracks();
                        setupWebsocket();
                    });
            } else {
                console.log("No user logged in");
                setFirebaseUserId(null);
                setDbUser(null);
                fetchTracks();
                setupWebsocket();
            }
        });

        return () => {
            listener();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [dbUser?.id]);

    const handleLikeToggle = async (index: number) => {
        if (!dbUser || !dbUser.id) {
            setErrorMessage("Please log in to like tracks");
            setShowError(true);
            return;
        }

        const track = tracks[index];
        console.log(`Toggling like for track ${track.id}, current status: ${track.isLiked}, using DB user ID: ${dbUser.id}`);

        try {
            let response;
            if (track.isLiked) {
                console.log(`Removing like for track ${track.id}, DB userId: ${dbUser.id}`);
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${track.id}&UserId=${dbUser.id}`, {
                    method: "DELETE",
                });
            } else {
                console.log(`Adding like for track ${track.id}, DB userId: ${dbUser.id}`);
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ TrackId: track.id, UserId: dbUser.id }),
                });
            }

            if (!response.ok) {
                console.error("Error response:", response.status, response.statusText);
                const errorText = await response.text().catch(() => "Unknown error");
                console.error("Error details:", errorText);
                throw new Error("Failed to update like status");
            }

            // Find all potential duplicates of this track by name and path
            const currentTrack = tracks[index];
            const isNowLiked = !currentTrack.isLiked;
            const likeChange = isNowLiked ? 1 : -1;

            // Update all tracks with matching name/path (duplicates)
            const updatedTracks = tracks.map(t => {
                if (t.name === currentTrack.name && t.path === currentTrack.path) {
                    return {
                        ...t,
                        isLiked: isNowLiked,
                        likes: (t.likes || 0) + likeChange
                    };
                }
                return t;
            });

            setTracks(updatedTracks);

            // Refresh all tracks data from server to ensure consistent state
            fetchTracks();
        } catch (error) {
            handleApiError("Error updating like status", error);
        }
    };

    const handleDeleteTrack = async (index: number) => {
        const track = tracks[index];
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/${track.id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Failed to delete track");
            }
            const updatedTracks = tracks.filter((_, i) => i !== index);
            setTracks(updatedTracks);
        } catch (error) {
            handleApiError("Error deleting track", error);
        }
    };

    // New function to open the queue confirmation dialog
    const openQueueConfirmation = (track: ITrack) => {
        setSelectedTrackToQueue(track);
        setConfirmDialogOpen(true);
    };

    // New function to handle queuing a track to play next
    const handleQueueNext = async (track: ITrack) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/queue-next/${track.id}`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to queue track');
            }

            // Success notification
            setErrorMessage(`"${track.name}" will play next`);
            setShowError(true);

            // Refresh tracks to get updated order
            fetchTracks();

        } catch (error) {
            handleApiError('Error queuing track', error);
        }

        // Close the dialog
        setConfirmDialogOpen(false);
        setSelectedTrackToQueue(null);
    };

    if (loading) {
        return (
            <Box
              sx={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 3
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  position: "relative",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <CircularProgress
                  size={60}
                  thickness={2.5}
                  sx={{
                    color: "primary.main",
                    opacity: 0.8
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    position: "absolute",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "primary.light",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontWeight: 400,
                  letterSpacing: 0.5,
                  opacity: 0.9
                }}
              >
                Loading tracks...
              </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <Box
            sx={{ minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}
        >
            <Header />
            <main className="container mx-auto p-4">
                <Typography variant="h4" component="h1" gutterBottom>
                    Track list
                </Typography>
                <Grid container spacing={4}>
                    {tracks.map((track, index) => {
                        const albumImagePath = track.Artist?.image
                            ? `${import.meta.env.VITE_MINIO_URL}/images/${track.Artist.image}`
                            : `${import.meta.env.VITE_MINIO_URL}/images/defaultAlbumArt.jpg`;

                        const isCurrentTrack = index === currentTrackIndex;
                        const imageClasses = isCurrentTrack
                            ? `animated-border ${isPlaying ? 'playing' : ''}`
                            : '';

                        return (
                            <Grid item xs={12} sm={6} lg={4} key={track.id}>
                                <Card className="hover:shadow-lg transition cursor-pointer">
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={albumImagePath}
                                        alt={track.name}
                                        className={imageClasses}
                                        style={{ width: '100%', height: '350px', objectFit: 'cover' }}
                                    />
                                    <CardContent className="relative flex flex-col justify-between">
                                        <div className="flex flex-row justify-between items-center w-full">
                                            <Typography variant="h6" component="h2">
                                                {track.Artist?.name}: {track.name}
                                            </Typography>
                                            <div className="flex">
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLikeToggle(index);
                                                    }}
                                                    disabled={!dbUser || !dbUser.id}
                                                >
                                                    {track.isLiked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                                                </IconButton>
                                                {dbUser?.role === "ADMIN" && (
                                                    <IconButton
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTrack(index);
                                                        }}
                                                        className="hover:text-red-500"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                )}
                                            </div>
                                        </div>
                                        <Box className="flex justify-between items-center mt-2">
                                            <Typography variant="body2" color="textSecondary">
                                                Likes: {track.likes}
                                            </Typography>
                                            {isCurrentTrack ? (
                                                <Typography
                                                    variant="body2"
                                                    className="py-1 px-2 bg-blue-100 rounded-md"
                                                    sx={{ fontWeight: 500 }}
                                                >
                                                    Now Playing
                                                </Typography>
                                            ) : (
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<QueueMusicIcon />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openQueueConfirmation(track);
                                                    }}
                                                    className="play-next-button"
                                                    sx={{
                                                        borderRadius: '12px',
                                                        textTransform: 'none',
                                                        fontSize: '0.75rem',
                                                        py: 0.5,
                                                    }}
                                                >
                                                    Play Next
                                                </Button>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </main>

            {/* Play Next confirmation dialog */}
            <Dialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
            >
                <DialogTitle>Queue Track</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedTrackToQueue && (
                            <>
                                Set "{selectedTrackToQueue.name}" to play next?
                                This will reorder the playlist queue.
                            </>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => selectedTrackToQueue && handleQueueNext(selectedTrackToQueue)}
                        variant="contained"
                        color="primary"
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={showError} autoHideDuration={6000} onClose={handleCloseError}>
                <Alert onClose={handleCloseError} severity={errorMessage?.includes('will play next') ? "success" : "error"} sx={{ width: '100%' }}>
                    {errorMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AudioList;