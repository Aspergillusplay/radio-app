import { useState } from "react";
import { Button, TextField, Typography, MenuItem } from "@mui/material";
import { useNavigate } from "react-router-dom";

interface Artist {
    id: string;
    name: string;
}

interface UploadAudioFormProps {
    artists: Artist[];
    setError: (error: string) => void;
}

const UploadAudioForm: React.FC<UploadAudioFormProps> = ({ artists, setError }) => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [trackName, setTrackName] = useState<string>("");
    const [selectedArtistId, setSelectedArtistId] = useState<string>("");
    const [error] = useState<string>(""); // Rename to setErrorState
    const navigate = useNavigate();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
            console.log("Selected audio file:", file);
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

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/upload`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload audio file");
            }

            navigate("/tracks");
        } catch (err: unknown) {
            console.error("Error uploading audio file:", err);
            setError("Failed to upload audio file");
        }
    };

    return (
        <form onSubmit={handleUpload}>
            <Typography component="h1" variant="h5" className="mb-4">
                Upload Audio
            </Typography>
            <div>
                <input
                    type="file"
                    id="audio"
                    name="audio"
                    accept="audio/*"
                    className={`mt-4 block w-full px-3 py-2 border rounded-md shadow-sm ${error ? "border-red-300" : "border-gray-300"}`}
                    onChange={handleFileChange}
                />
            </div>

            {audioFile && (
                <>
                    <TextField
                        label="Track Name"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        value={trackName}
                        onChange={(e) => setTrackName(e.target.value)}
                    />
                    <TextField
                        select
                        label="Select Group"
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

            <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 2 }}
            >
                Upload
            </Button>
        </form>
    );
};

export default UploadAudioForm;