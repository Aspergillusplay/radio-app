import { useEffect, useState } from "react";
import Header from "./Header";
import {IconButton, Card, CardMedia, CardContent, Typography, Grid, Box} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import DeleteIcon from "@mui/icons-material/Delete";
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
    firebaseId: string;
    role: "USER" | "ADMIN";
    createdAt?: string;
    updatedAt?: string;
}

const AudioList = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [dbUser, setDbUser] = useState<DbUser | null>(null);

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks`);
                if (!response.ok) {
                    throw new Error("Failed to fetch tracks");
                }
                const data = await response.json();

                const userId = 1;
                const tracksWithLikes = await Promise.all(
                    data.map(async (track: ITrack) => {
                        try {
                            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ TrackId: track.id, UserId: userId }),
                            });
                            if (!res.ok) {
                                throw new Error("Failed to fetch like status");
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
            } catch (err: any) {
                console.error("Error fetching tracks:", err);
                setError("Failed to fetch tracks");
            } finally {
                setLoading(false);
            }
        };

        const listener = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.uid}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Failed to fetch user from DB");
                        }
                        return response.json();
                    })
                    .then((data: DbUser) => {
                        setDbUser(data);
                        fetchTracks();
                    })
                    .catch((error) => {
                        console.error("Error fetching DB user:", error);
                    });
            } else {
                setDbUser(null);
                fetchTracks();
            }
        });

        return () => listener();
    }, []);

    const handleLikeToggle = async (index: number) => {
        const track = tracks[index];
        const userId = 1;
        try {
            let response;
            if (track.isLiked) {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${track.id}&UserId=${userId}`, {
                    method: "DELETE",
                });
            } else {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ TrackId: track.id, UserId: userId }),
                });
            }
            if (!response.ok) {
                throw new Error("Failed to update like status");
            }
            const updatedTracks = [...tracks];
            updatedTracks[index].isLiked = !updatedTracks[index].isLiked;
            updatedTracks[index].likes = track.isLiked ? track.likes! + 1 : track.likes! - 1;
            setTracks(updatedTracks);
        } catch (error) {
            console.error("Error updating like status:", error);
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
            console.error("Error deleting track:", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p>Loading...</p>
            </div>
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
                            ? `${import.meta.env.VITE_MINIO_PORT}/images/${track.Artist.image}`
                            : `${import.meta.env.VITE_MINIO_PORT}/images/defaultAlbumArt.jpg`;
                        return (
                            <Grid item xs={12} sm={6} lg={4} key={track.id}>
                                <Card className="hover:shadow-lg transition cursor-pointer">
                                    <CardMedia
                                        component="img"
                                        height="200"
                                        image={albumImagePath}
                                        alt={track.name}
                                        style={{ width: '100%', height: '350px', objectFit: 'cover' }}
                                    />
                                    <CardContent className="relative flex flex-col justify-between items-start">
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
                                                >
                                                    {track.isLiked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                                                </IconButton>
                                                {dbUser?.role === "ADMIN" && (
                                                    <IconButton
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTrack(index);
                                                        }} className="hover:text-red-500"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                )}
                                            </div>
                                        </div>
                                        <Typography variant="body2" color="textSecondary" className="mt-2">
                                            Likes: {track.likes}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            </main>
        </Box>
    );
};

export default AudioList;