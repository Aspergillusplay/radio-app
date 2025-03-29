import { useEffect, useState } from "react";
import Header from "./Header";
import {List, ListItem, Divider, Typography, TextField, Button, Paper, IconButton, Box} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";
import dayjs from "dayjs";
import DeleteIcon from '@mui/icons-material/Delete';

interface Wish {
    id: number;
    content: string;
    createdAt: string;
    updatedAt: string;
    UserId: number;
    User?: {
        firebaseId: string;
        role: "USER" | "ADMIN";
        login: string;
    };
}

type GroupedWishes = {
    [key: string]: Wish[];
};

const colors = [
    "#e57373", "#f06292", "#ba68c8", "#9575cd", "#7986cb",
    "#64b5f6", "#4fc3f7", "#4dd0e1", "#4db6ac", "#81c784",
    "#aed581", "#dce775", "#fff176", "#ffd54f", "#ffb74d",
    "#ff8a65", "#a1887f", "#90a4ae"
];

function getColorForUser(userId: string) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

const WishPage = () => {
    const [wish, setWish] = useState("");
    const [groupedWishes, setGroupedWishes] = useState<GroupedWishes>({});
    const [firebaseUser, setFirebaseUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchWishes = async (firebaseId: string) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/wishes?firebaseId=${firebaseId}`
            );
            const data = await response.json();
            setGroupedWishes(data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching wishes:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (firebaseUser) {
            fetchWishes(firebaseUser.uid);
        }
    }, [firebaseUser]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!wish.trim() || !firebaseUser) return;
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/wishes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firebaseId: firebaseUser.uid,
                    content: wish,
                    nickname: firebaseUser.displayName || firebaseUser.email
                }),
            });
            if (!response.ok) {
                throw new Error("Error submitting wish");
            }
            await response.json();
            fetchWishes(firebaseUser.uid);
            setWish("");
        } catch (error) {
            console.error("Error posting wish:", error);
        }
    };

    const handleDelete = async (wishId: number) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/wishes/${wishId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error("Error deleting wish");
            }
            fetchWishes(firebaseUser.uid);
        } catch (error) {
            console.error("Error deleting wish:", error);
        }
    };

    return (
        <Box
            sx={{ minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" }}
        >
            <Header />
            <main className="container mx-auto p-4">
                <Typography variant="h4" gutterBottom>
                    Make a wish
                </Typography>
                <form onSubmit={handleSubmit} style={{ marginBottom: "16px" }}>
                    <TextField
                        label="Write your wish..."
                        variant="outlined"
                        fullWidth
                        value={wish}
                        onChange={(e) => setWish(e.target.value)}
                    />
                    <Button type="submit" variant="contained" color="primary" style={{ marginTop: "8px" }}>
                        Submit
                    </Button>
                </form>
                {loading ? (
                    <Typography>Loading wishes...</Typography>
                ) : (
                    Object.keys(groupedWishes).length === 0 ? (
                        <Typography>No wishes found.</Typography>
                    ) : (
                        Object.keys(groupedWishes).map((userId) => {
                            const userWishes = groupedWishes[userId];
                            const displayName = userWishes[0]?.User?.login;
                            const role = userWishes[0]?.User?.role;
                            const isCurrentUser = firebaseUser && firebaseUser.uid === userId;
                            return (
                                <Paper key={userId} style={{ marginBottom: "16px", padding: "8px" }}>
                                    {!isCurrentUser && (
                                        <Typography variant="h6" style={{ color: getColorForUser(userId) }}>
                                            {displayName} ({role})
                                        </Typography>
                                    )}
                                    <List>
                                        {userWishes.map((w, index) => (
                                            <div key={w.id}>
                                                <ListItem>
                                                    <Typography>{w.content}</Typography>
                                                    <Typography variant="body2" color="textSecondary" style={{ marginLeft: "auto" }}>
                                                        {dayjs(w.createdAt).format('DD.MM.YYYY HH:mm')}
                                                    </Typography>
                                                    <IconButton onClick={() => handleDelete(w.id)} color="error">
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </ListItem>
                                                {index < userWishes.length - 1 && (
                                                    <Divider variant="middle" component="li" />
                                                )}
                                            </div>
                                        ))}
                                    </List>
                                </Paper>
                            );
                        }).sort((a, b) => {
                            const aIsCurrentUser = firebaseUser && firebaseUser.uid === a.key;
                            const bIsCurrentUser = firebaseUser && firebaseUser.uid === b.key;
                            if (aIsCurrentUser && !bIsCurrentUser) return -1;
                            if (!aIsCurrentUser && bIsCurrentUser) return 1;
                            return 0;
                        })
                    )
                )}
            </main>
        </Box>
    );
};

export default WishPage;