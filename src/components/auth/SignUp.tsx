import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle, signInWithFacebook } from "../../Firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

const SignUp = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [copyPassword, setCopyPassword] = useState("");
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

    const register = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        if (copyPassword !== password) {
            setError("Passwords do not match");
            return;
        }
        const errors = validatePassword(password);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        createUserWithEmailAndPassword(auth, email, password)
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
                    .then(response => response.json())
                    .then(() => {
                        setError("");
                        setEmail("");
                        setPassword("");
                        setCopyPassword("");
                        navigate("/signin");
                    })
                    .catch(() => {
                        navigate("/signin");
                    });
            })
            .catch(() => {
                setError("Error creating user");
            });
    };

    const handleGoogleSignIn = (): void => {
        signInWithGoogle()
            .then((result) => {
                const firebaseId = result.user.uid;

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ firebaseId }),
                })
                    .then(response => response.json())
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

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ firebaseId }),
                })
                    .then(response => response.json())
                    .then(() => {
                        navigate("/app");
                    })
                    .catch(() => {
                        navigate("/app");
                    });
            })
            .catch((error) => {
                if (error.code === "auth/popup-closed-by-user") {
                    setError("The popup was closed before completing the sign-in.");
                } else if (error.code === "auth/account-exists-with-different-credential") {
                    setError("An account already exists with a different credential.");
                } else {
                    setError("Facebook sign-in failed");
                }
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
                p: 2
            }}
        >
            <Container maxWidth="sm">
                <Paper elevation={8} sx={{ p: 4, borderRadius: 2 }}>
                    <Typography component="h1" variant="h4" align="center" gutterBottom>
                        Create an Account
                    </Typography>
                    <form onSubmit={register} noValidate>
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
                            autoComplete="new-password"
                            value={password}
                            onChange={handlePasswordChange}
                            onBlur={handlePasswordBlur}
                            error={!!passwordErrors}
                            helperText={passwordErrors}
                        />
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            name="copyPassword"
                            label="Confirm Password"
                            type="password"
                            id="copyPassword"
                            autoComplete="new-password"
                            value={copyPassword}
                            onChange={(e) => setCopyPassword(e.target.value)}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color="primary"
                            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: "1rem" }}
                        >
                            Register
                        </Button>
                    </form>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <Button
                                onClick={() => navigate("/signin")}
                                fullWidth
                                variant="outlined"
                                color="primary"
                            >
                                Login
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

export default SignUp;