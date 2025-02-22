import { useEffect, useState } from "react";
import Header from "./Header";
import { List, ListItem, Divider, Typography, TextField, Button, Paper } from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";

interface Wish {
    id: number;
    content: string;
    createdAt: string;
    updatedAt: string;
    UserId: number;
    User?: {
        firebaseId: string;
        role: "USER" | "ADMIN";
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



    return (
            <div className="min-h-screen bg-gray-100">
                <Header/>
                <main className="container mx-auto p-4">
                    <Typography variant="h4" gutterBottom>
                        Make a wish
                    </Typography>
                    <form onSubmit={handleSubmit} style={{marginBottom: "16px"}}>
                        <TextField
                            label="Write your wish..."
                            variant="outlined"
                            fullWidth
                            value={wish}
                            onChange={(e) => setWish(e.target.value)}
                        />
                        <Button type="submit" variant="contained" color="primary" style={{marginTop: "8px"}}>
                            Submit
                        </Button>
                    </form>
                    {loading ? (
                        <Typography>Loading wishes...</Typography>
                    ) : (
                        Object.keys(groupedWishes).map((userId) => {
                            const userWishes = groupedWishes[userId];
                            const displayName = firebaseUser && firebaseUser.uid === userId
                                ? (firebaseUser.displayName || firebaseUser.email)
                                : userId;
                            return (
                                <Paper key={userId} style={{marginBottom: "16px", padding: "8px"}}>
                                    <Typography variant="h6" style={{color: getColorForUser(userId)}}>
                                        {displayName}
                                    </Typography>
                                    <List>
                                        {userWishes.map((w, index) => (
                                            <div key={w.id}>
                                                <ListItem>
                                                    <Typography>{w.content}</Typography>
                                                </ListItem>
                                                {index < userWishes.length - 1 && (
                                                    <Divider variant="middle" component="li"/>
                                                )}
                                            </div>
                                        ))}
                                    </List>
                                </Paper>
                            );
                        })
                    )}
                </main>
            </div>
        );
    };

    export default WishPage;
