import { useState } from "react";
import { Button, TextField, Typography } from "@mui/material";

interface Artist {
    id: string;
    name: string;
}

interface CreateGroupFormProps {
    setArtists: (artists: Artist[]) => void;
    artists: Artist[];
    setError: (error: string) => void;
}

const CreateGroupForm: React.FC<CreateGroupFormProps> = ({ setArtists, artists, setError }) => {
    const [newGroupName, setNewGroupName] = useState<string>("");
    const [newGroupImage, setNewGroupImage] = useState<File | null>(null);

    const handleNewGroupImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewGroupImage(file);
            console.log("Selected group image:", file);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName || !newGroupImage) {
            setError("Please provide group name and image");
            return;
        }

        const formData = new FormData();
        formData.append("name", newGroupName);
        formData.append("image", newGroupImage);

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/artists/upload`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to create group");
            }

            // Refresh the artist list
            const newArtist = await response.json();
            setArtists([...artists, newArtist]);
            setNewGroupName("");
            setNewGroupImage(null);
        } catch (err) {
            console.error("Error creating group:", err);
            setError("Failed to create group");
        }
    };

    return (
        <form onSubmit={handleCreateGroup} className="mt-6">
            <Typography variant="h6" className="mt-4">Create New Group</Typography>
            <TextField
                label="Group Name"
                variant="outlined"
                fullWidth
                margin="normal"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
            />
            <input
                type="file"
                onChange={handleNewGroupImageChange}
                accept="image/*"
                className="mt-1 block w-full px-3 py-2 border rounded-md"
            />

            <Button
                type="submit"
                variant="contained"
                color="secondary"
                fullWidth
                sx={{ mt: 2 }}
            >
                Create Group
            </Button>
        </form>
    );
};

export default CreateGroupForm;