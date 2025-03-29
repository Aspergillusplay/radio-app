import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle, signInWithFacebook } from "../../Firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
    Container,
    TextField,
    Button,
    Typography,
    Paper,
    Divider,
    IconButton,
    Box,
    Grid
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import FacebookIcon from "@mui/icons-material/Facebook";

const SignIn = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [passwordErrors, setPasswordErrors] = useState("");
    const [touched, setTouched] = useState(false);
    const navigate = useNavigate();

    const validatePassword = (password: string): string => {
        if (!password) return "";
        const errors = [];
        if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
        if (!/\d/.test(password)) errors.push("one number");
        if (!/[!@#$%^&*]/.test(password)) errors.push("one special character");
        if (password.length < 6) errors.push("6 characters long");
        return errors.length > 0 ? `Must contain at least ${errors.join(", ")}` : "";
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        if (touched) {
            const errors = validatePassword(newPassword);
            setPasswordErrors(errors);
        }
    };

    const handlePasswordBlur = (): void => {
        setTouched(true);
        const errors = validatePassword(password);
        setPasswordErrors(errors);
    };

    const login = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const errors = validatePassword(password);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                setError("");
                setEmail("");
                setPassword("");
                navigate("/app");
            })
            .catch(() => {
                setError("Not correct email or password");
            });
    };

    const handleGoogleSignIn = (): void => {
        signInWithGoogle()
            .then((result) => {
                const firebaseId = result.user.uid;
                const displayName = result.user.displayName;
                const email = result.user.email;

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ firebaseId, displayName, email }),
                })
                    .then(() => {
                        navigate("/app");
                    })
                    .catch(() => {
                        navigate("/app");
                    });
            })
            .catch(() => {
                setError("Google sign-in failed");
            });
    };

    const handleFacebookSignIn = (): void => {
        signInWithFacebook()
            .then((result) => {
                const firebaseId = result.user.uid;
                const displayName = result.user.displayName;
                const email = result.user.email;

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ firebaseId, displayName, email }),
                })
                    .then(() => {
                        navigate("/app");
                    })
                    .catch(() => {
                        navigate("/app");
                    });
            })
            .catch(() => {
                setError("Facebook sign-in failed");
            });
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
            }}
        >
            <Container maxWidth="sm">
                <Paper elevation={8} sx={{ p: 4, borderRadius: 2 }}>
                    <Typography component="h1" variant="h4" align="center" gutterBottom>
                        Login
                    </Typography>
                    <form onSubmit={login} noValidate>
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={handlePasswordChange}
                            onBlur={handlePasswordBlur}
                            error={!!passwordErrors}
                            helperText={passwordErrors}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color="primary"
                            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: "1rem" }}
                        >
                            Login
                        </Button>
                    </form>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Button
                                onClick={() => navigate("/signup")}
                                fullWidth
                                variant="outlined"
                                color="primary"
                            >
                                Go to Register
                            </Button>
                        </Grid>
                        <Grid item xs={6}>
                            <Button
                                onClick={() => navigate("/app")}
                                fullWidth
                                variant="outlined"
                                color="primary"
                            >
                                Go to App
                            </Button>
                        </Grid>
                    </Grid>
                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
                        <IconButton onClick={handleGoogleSignIn} color="primary" size="large">
                            <GoogleIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton onClick={handleFacebookSignIn} color="primary" size="large">
                            <FacebookIcon fontSize="inherit" />
                        </IconButton>
                    </Box>
                    {error && (
                        <Typography color="error" sx={{ mt: 2 }} align="center">
                            {error}
                        </Typography>
                    )}
                </Paper>
            </Container>
        </Box>
    );
};

export default SignIn;