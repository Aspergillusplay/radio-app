import { useEffect, useState } from "react";
import Header from "./Header";
import {
  Typography, TextField, Button, Paper, IconButton, Box,
  Container, Card, CardContent, CardHeader, Divider,
  Avatar, Chip, Fade, CircularProgress, Slide
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";
import dayjs from "dayjs";
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';

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
    const [submitting, setSubmitting] = useState(false);

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

        setSubmitting(true);
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
        } finally {
            setSubmitting(false);
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
            <Container maxWidth="md" sx={{ pt: 4, pb: 8 }}>
                <Paper
                    elevation={6}
                    sx={{
                        p: 4,
                        borderRadius: 3,
                        mb: 4,
                        background: "rgba(255, 255, 255, 0.95)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 8px 32px rgba(31, 38, 135, 0.2)"
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                        <Typography variant="h4" fontWeight={600}>
                            Make a Wish
                        </Typography>
                    </Box>

                    <form onSubmit={handleSubmit}>
                        <TextField
                            label="What do you wish for?"
                            variant="outlined"
                            fullWidth
                            value={wish}
                            onChange={(e) => setWish(e.target.value)}
                            multiline
                            rows={2}
                            placeholder="Write your wish here..."
                            sx={{
                                mb: 2,
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                    "&.Mui-focused fieldset": {
                                        borderColor: "#5B247A",
                                    },
                                },
                                "& .MuiInputLabel-root.Mui-focused": {
                                    color: "#5B247A"
                                }
                            }}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            disabled={submitting || !wish.trim()}
                            endIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                        >
                            {submitting ? 'Sending...' : 'Submit Wish'}
                        </Button>
                    </form>
                </Paper>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress sx={{ color: 'white' }} />
                    </Box>
                ) : (
                    Object.keys(groupedWishes).length === 0 ||
                    Object.values(groupedWishes).every(wishes => wishes.length === 0) ? (
                        <Paper
                            elevation={3}
                            sx={{
                                p: 4,
                                borderRadius: 3,
                                textAlign: 'center',
                                background: "rgba(255, 255, 255, 0.9)"
                            }}
                        >
                            <Typography variant="h6" color="text.secondary">No wishes found yet. Be the first to make a wish!</Typography>
                        </Paper>
                    ) : (
                        Object.keys(groupedWishes).sort((a, b) => {
                            const aIsCurrentUser = firebaseUser && firebaseUser.uid === a;
                            const bIsCurrentUser = firebaseUser && firebaseUser.uid === b;
                            if (aIsCurrentUser && !bIsCurrentUser) return -1;
                            if (!aIsCurrentUser && bIsCurrentUser) return 1;
                            return 0;
                        }).map((userId, userIndex) => {
                            const userWishes = groupedWishes[userId];
                            const displayName = userWishes[0]?.User?.login;
                            const role = userWishes[0]?.User?.role;
                            const isCurrentUser = firebaseUser && firebaseUser.uid === userId;
                            const userColor = getColorForUser(userId);

                            return (
                                <Fade in key={userId} timeout={300 + userIndex * 150}>
                                    <Card
                                        sx={{
                                            mb: 3,
                                            borderRadius: 3,
                                            overflow: "visible",
                                            background: isCurrentUser
                                                ? "rgba(255, 255, 255, 0.95)"
                                                : "rgba(255, 255, 255, 0.9)",
                                            boxShadow: isCurrentUser
                                                ? '0 8px 24px rgba(91, 36, 122, 0.25)'
                                                : '0 4px 16px rgba(0, 0, 0, 0.1)',
                                            position: "relative"
                                        }}
                                    >
                                        {isCurrentUser && (
                                            <Chip
                                                label="Your Wishes"
                                                sx={{
                                                    position: "absolute",
                                                    top: -12,
                                                    right: 16,
                                                    bgcolor: userColor,
                                                    color: "white",
                                                    fontWeight: 600
                                                }}
                                            />
                                        )}
                                        <CardHeader
                                            avatar={
                                                <Avatar sx={{ bgcolor: userColor }}>
                                                    {displayName?.charAt(0).toUpperCase() || "?"}
                                                </Avatar>
                                            }
                                            title={
                                                <Typography variant="h6" sx={{ fontWeight: 600 }} className="px-2">
                                                    {isCurrentUser ? "You" : displayName}
                                                </Typography>
                                            }
                                            subheader={
                                                <Chip
                                                    label={role}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: role === "ADMIN" ? "rgba(91, 36, 122, 0.1)" : "rgba(27, 206, 223, 0.1)",
                                                        color: role === "ADMIN" ? "#5B247A" : "#1BCEDF",
                                                        fontWeight: 500,
                                                        fontSize: 11
                                                    }}
                                                />
                                            }
                                        />
                                        <CardContent sx={{ pt: 0 }}>
                                            {userWishes.map((w, index) => (
                                                <Slide
                                                    direction="right"
                                                    in
                                                    mountOnEnter
                                                    key={w.id}
                                                    timeout={200 + index * 100}
                                                >
                                                    <Box>
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems: "flex-start",
                                                                py: 1.5,
                                                                "&:hover": {
                                                                    "& .delete-button": {
                                                                        opacity: 1,
                                                                        visibility: "visible"
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <Typography
                                                                sx={{
                                                                    flex: 1,
                                                                    fontSize: "16px",
                                                                    lineHeight: 1.5
                                                                }}
                                                            >
                                                                {w.content}
                                                            </Typography>

                                                            <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{ fontSize: 12, mr: 1 }}
                                                                >
                                                                    {dayjs(w.createdAt).format('DD.MM.YYYY HH:mm')}
                                                                </Typography>
                                                                <IconButton
                                                                    onClick={() => handleDelete(w.id)}
                                                                    size="small"
                                                                    className="delete-button"
                                                                    sx={{
                                                                        color: "error.main",
                                                                        opacity: 0.4,
                                                                        visibility: "visible",
                                                                        transition: "opacity 0.2s",
                                                                        "&:hover": {
                                                                            bgcolor: "rgba(211, 47, 47, 0.1)"
                                                                        }
                                                                    }}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Box>
                                                        </Box>
                                                        {index < userWishes.length - 1 && (
                                                            <Divider sx={{ opacity: 0.6 }} />
                                                        )}
                                                    </Box>
                                                </Slide>
                                            ))}
                                        </CardContent>
                                    </Card>
                                </Fade>
                            );
                        })
                    )
                )}
            </Container>
        </Box>
    );
};

export default WishPage;