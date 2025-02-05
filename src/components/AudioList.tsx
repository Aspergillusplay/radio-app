import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";

// Define the interface for an artist
interface IArtist {
    id: number;
    name: string;
    image: string;
}

// Define the interface for a track
interface ITrack {
    id: number;
    name: string;
    path: string;
    Artist?: IArtist;
}

const AudioList = () => {
    const navigate = useNavigate();
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/tracks");
                if (!response.ok) {
                    throw new Error("Failed to fetch tracks");
                }
                const data = await response.json();

                // Log to console to ensure data correctness
                console.log("Fetched tracks data:", data);

                setTracks(data);
            } catch (err: any) {
                console.error("Error fetching tracks:", err);
                setError("Не удалось загрузить список треков");
            } finally {
                setLoading(false);
            }
        };

        fetchTracks();
    }, []);

    const handleTrackClick = (index: number) => {
        navigate(`/app?track=${index}`);
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
            <Header />
            <main className="container mx-auto p-4">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Track list</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tracks.map((track, index) => {
                        // Log track name and artist image to ensure they are correct
                        console.log(`Track Name: ${track.name}, Artist Image: ${track.Artist?.image}`);

                        // Ensure the albumArt path is correct
                        const albumImagePath = track.Artist?.image ? `/assets/${track.Artist.image}` : "/assets/defaultAlbumArt.jpg";
                        console.log(`Track ${track.name}: Image path = ${albumImagePath}`);

                        return (
                            <div
                                key={track.id}
                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer"
                                onClick={() => handleTrackClick(index)}
                            >
                                <img
                                    src={albumImagePath}
                                    alt={track.name}
                                    className="w-full h-48 object-cover"
                                />
                                <div className="p-4">
                                    <h2 className="text-lg font-semibold text-gray-800">
                                        {track.Artist?.name}: {track.name}
                                    </h2>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
};

export default AudioList;