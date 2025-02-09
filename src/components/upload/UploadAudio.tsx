import {useState, useEffect} from "react";
import {Container, Paper, Typography} from "@mui/material";
import Header from "../Header";
import UploadAudioForm from "./UploadAudioForm";
import CreateGroupForm from "./CreateGroupForm";

// Define the Artist type if not already defined
interface Artist {
    id: string;
    name: string;
}

const UploadAudio = () => {
    const [artists, setArtists] = useState<Artist[]>([]);
    const [error, setError] = useState<string>("");

    console.log("check1");
    console.log("import.meta:", import.meta);
    console.log("check2");
    console.log("import.meta.env:", import.meta.env);
    console.log("check3");


    console.log("VITE_BACKEND_URL:", import.meta.env?.VITE_BACKEND_URL);


    // Load the list of artists when the component mounts
    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/artists`);
                if (!res.ok) {
                    throw new Error("Error loading artists");
                }
                const data = await res.json();
                setArtists(data);
            } catch (err) {
                console.error(err);
                setError("Failed to load artist list");
            }
        };

        fetchArtists().then(r => r);
    }, []);

    return (
        <div>
            <Header/>
            <Container component="main" maxWidth="xs">
                <Paper elevation={3} className="p-8 mt-8">
                    <UploadAudioForm artists={artists} setError={setError}/>
                    <CreateGroupForm setArtists={setArtists} artists={artists} setError={setError}/>
                    {error && (
                        <Typography color="error" variant="body2" className="mt-1">
                            {error}
                        </Typography>
                    )}
                </Paper>
            </Container>
        </div>
    );
};

export default UploadAudio;