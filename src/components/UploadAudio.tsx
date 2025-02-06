// UploadAudio.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { Button, Container, Paper, Typography, TextField, MenuItem } from "@mui/material";

interface Artist {
    id: number;
    name: string;
    image?: string;
}

const UploadAudio = () => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [trackName, setTrackName] = useState<string>("");
    const [selectedArtistId, setSelectedArtistId] = useState<string>("");
    const [artists, setArtists] = useState<Artist[]>([]);
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();

    // Загружаем список групп (исполнителей) при монтировании компонента
    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const res = await fetch("http://localhost:3000/api/artists"); // убедитесь, что URL корректный
                if (!res.ok) {
                    throw new Error("Ошибка при загрузке групп");
                }
                const data = await res.json();
                setArtists(data);
            } catch (err) {
                console.error(err);
                setError("Не удалось загрузить список групп");
            }
        };

        fetchArtists();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!audioFile) {
            setError("Please select an audio file");
            return;
        }
        if (!trackName) {
            setError("Please enter track name");
            return;
        }
        if (!selectedArtistId) {
            setError("Please select a group");
            return;
        }

        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("name", trackName);
        formData.append("artistId", selectedArtistId);
        // order можно не передавать, так как сервер его вычислит

        try {
            const response = await fetch("http://localhost:3000/api/tracks", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload audio file");
            }

            navigate("/tracks");
        } catch (err: any) {
            console.error("Error uploading audio file:", err);
            setError("Failed to upload audio file");
        }
    };

    return (
        <div>
            <Header />
            <Container component="main" maxWidth="xs">
                <Paper elevation={3} className="p-8 mt-8">
                    <Typography component="h1" variant="h5" className="mb-4">
                        Upload Audio
                    </Typography>
                    <form onSubmit={handleUpload}>
                        <div className="mb-4">
                            <input
                                type="file"
                                id="audio"
                                name="audio"
                                accept="audio/*"
                                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm ${
                                    error ? "border-red-300" : "border-gray-300"
                                }`}
                                onChange={handleFileChange}
                            />
                        </div>

                        {/* Показываем дополнительные поля, если аудиофайл выбран */}
                        {audioFile && (
                            <>
                                <TextField
                                    label="Название трека"
                                    variant="outlined"
                                    fullWidth
                                    margin="normal"
                                    value={trackName}
                                    onChange={(e) => setTrackName(e.target.value)}
                                />
                                <TextField
                                    select
                                    label="Выберите группу"
                                    variant="outlined"
                                    fullWidth
                                    margin="normal"
                                    value={selectedArtistId}
                                    onChange={(e) => setSelectedArtistId(e.target.value)}
                                >
                                    {artists.map((artist) => (
                                        <MenuItem key={artist.id} value={artist.id}>
                                            {artist.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </>
                        )}

                        {error && (
                            <Typography color="error" variant="body2" className="mt-1">
                                {error}
                            </Typography>
                        )}

                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            fullWidth
                            className="mt-4"
                        >
                            Upload
                        </Button>
                    </form>
                </Paper>
            </Container>
        </div>
    );
};

export default UploadAudio;
