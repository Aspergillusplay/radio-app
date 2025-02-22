import {useEffect, useState} from "react";
import Header from "./Header";
import {IconButton, Card, CardMedia, CardContent, Typography, Grid} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

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
}

const AudioList = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    // Fetch the list of tracks from the backend
    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks`);
                if (!response.ok) {
                    throw new Error("Failed to fetch tracks");
                }
                const data = await response.json();

                // For each track, fetch the like status
                const userId = 1;
                const tracksWithLikes = await Promise.all(
                    data.map(async (track: ITrack) => {
                        try {
                            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({TrackId: track.id, UserId: userId}),
                            });
                            if (!res.ok) {
                                throw new Error("Failed to fetch like status");
                            }
                            const likeData = await res.json();
                            return {...track, isLiked: likeData.isLiked};
                        } catch (error) {
                            console.error(`Error fetching like status for track ${track.id}:`, error);
                            return {...track, isLiked: false};
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

        fetchTracks();
    }, []);

    // Функция для переключения лайка у конкретного трека
    const handleLikeToggle = async (index: number) => {
        const track = tracks[index];
        const userId = 1; // user ID
        try {
            let response;
            if (track.isLiked) {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${track.id}&UserId=${userId}`, {
                    method: "DELETE",
                });
            } else {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({TrackId: track.id, UserId: userId}),
                });
            }
            if (!response.ok) {
                throw new Error("Failed to update like status");
            }
            // Set the updated like status in the local state
            const updatedTracks = [...tracks];
            updatedTracks[index].isLiked = !updatedTracks[index].isLiked;
            setTracks(updatedTracks);
        } catch (error) {
            console.error("Error updating like status:", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p>Загрузка...</p>
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
        <div className="min-h-screen bg-gray-100">
    <Header/>
    <main className="container mx-auto p-4">
        <Typography variant="h4" component="h1" gutterBottom>
            Track list
        </Typography>
        <Grid container spacing={4}>
            {tracks.map((track, index) => {
                const albumImagePath = track.Artist?.image
                    ? `http://localhost:9000/images/${track.Artist.image}`
                    : "http://localhost:9000/images/defaultAlbumArt.jpg";
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
                            <CardContent className="relative flex flex-row justify-between items-center">
                                <Typography variant="h6" component="h2">
                                    {track.Artist?.name}: {track.name}
                                </Typography>
                                <IconButton
                                    className="absolute top-0 right-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLikeToggle(index);
                                    }}
                                >
                                    {track.isLiked ? <FavoriteIcon color="error"/> : <FavoriteBorderIcon/>}
                                </IconButton>
                            </CardContent>
                        </Card>
                    </Grid>
                );
            })}
        </Grid>
    </main>
</div>
    );
};

export default AudioList;
