import {useState} from "react";
import {Button, TextField, Typography, MenuItem, Snackbar, Alert} from "@mui/material";

interface Artist {
    id: string;
    name: string;
}

interface UploadAudioFormProps {
    artists: Artist[];
    setError: (error: string) => void;
}

const UploadAudioForm: React.FC<UploadAudioFormProps> = ({artists, setError}) => {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [trackName, setTrackName] = useState<string>("");
    const [selectedArtistId, setSelectedArtistId] = useState<string>("");
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

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

            setSnackbarMessage("Audio file uploaded successfully");
            setSnackbarSeverity("success");
            setSnackbarOpen(true);

            // Clear input fields
            setAudioFile(null);
            setTrackName("");
            setSelectedArtistId("");
        } catch (err: unknown) {
            console.error("Error uploading audio file:", err);
            setSnackbarMessage("Failed to upload audio file");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
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
                    className={`mt-4 block w-full px-3 py-2 border rounded-md shadow-sm border-gray-300`}
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
                sx={{mt: 2}}
            >
                Upload
            </Button>

            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{width: "100%"}}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </form>
    );
};

export default UploadAudioForm;