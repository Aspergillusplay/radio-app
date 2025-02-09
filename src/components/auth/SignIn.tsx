import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle, signInWithFacebook } from "../../Firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Container, TextField, Button, Typography, Paper, Divider, IconButton } from "@mui/material";
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';

const SignIn = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string>("");
    const [passwordErrors, setPasswordErrors] = useState<string>("");
    const [touched, setTouched] = useState<boolean>(false);
    const navigate = useNavigate();

    const validatePassword = (password: string) => {
        if (!password) return "";
        const errors = [];
        if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
        if (!/\d/.test(password)) errors.push("one number");
        if (!/[!@#$%^&*]/.test(password)) errors.push("one special character");
        if (password.length < 6) errors.push("6 characters long");
        return errors.length > 0 ? `Must contain at least ${errors.join(", ")}` : "";
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        if (touched) {
            const errors = validatePassword(newPassword);
            setPasswordErrors(errors);
        }
    };

    const handlePasswordBlur = () => {
        setTouched(true);
        const errors = validatePassword(password);
        setPasswordErrors(errors);
    };

    function login(e: React.FormEvent) {
        e.preventDefault();
        const errors = validatePassword(password);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        signInWithEmailAndPassword(auth, email, password)
            .then((user) => {
                console.log(user);
                setError("");
                setEmail("");
                setPassword("");
                navigate("/app");
            })
            .catch((err) => {
                console.log(err);
                setError("Not correct email or password");
            });
    }

    function handleGoogleSignIn() {
        signInWithGoogle()
            .then((result) => {
                console.log('Firebase auth result:', result);
                const firebaseId = result.user.uid;

                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ firebaseId })
                })
                    .then(response => response.json())
                    .then(data => {
                        console.log('User saved in DB:', data);
                        navigate("/app");
                    })
                    .catch((error) => {
                        console.error('Error saving user in DB:', error);
                        navigate("/app");
                    });
            })
            .catch((error) => {
                console.log(error);
                setError("Google sign-in failed");
            });
    }

    function handleFacebookSignIn() {
        signInWithFacebook()
            .then((result) => {
                console.log(result);
                navigate("/app");
            })
            .catch((error) => {
                console.log(error);
                if (error.code === "auth/popup-closed-by-user") {
                    setError("The popup was closed before completing the sign-in.");
                } else if (error.code === "auth/account-exists-with-different-credential") {
                    setError("An account already exists with a different credential.");
                } else {
                    setError("Facebook sign-in failed");
                }
            });
    }

    return (
        <Container component="main" maxWidth="xs">
            <Paper elevation={6} sx={{ p: 4, mt: 8 }}>
                <Typography component="h1" variant="h5" align="center">
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
                        sx={{ mt: 3, mb: 2 }}
                    >
                        Login
                    </Button>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Button
                            onClick={() => navigate("/signup")}
                            variant="outlined"
                            color="primary"
                            sx={{ width: '48%' }}
                        >
                            Go to Register
                        </Button>
                        <Button
                            onClick={() => navigate("/app")}
                            variant="outlined"
                            color="primary"
                            sx={{ width: '48%' }}
                        >
                            Go to App
                        </Button>
                    </div>
                </form>
                <Divider sx={{ my: 3 }} />
                <div style={{ display: 'flex', justifyContent: 'space-evenly' }}>
                    <IconButton onClick={handleGoogleSignIn} color="primary">
                        <GoogleIcon />
                    </IconButton>
                    <IconButton onClick={handleFacebookSignIn} color="primary">
                        <FacebookIcon />
                    </IconButton>
                </div>
                {error && <Typography color="error">{error}</Typography>}
            </Paper>
        </Container>
    );
};

export default SignIn;