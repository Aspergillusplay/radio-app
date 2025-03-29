import React, {useEffect, useState, useRef} from "react";
import {useNavigate} from "react-router-dom";
import {auth} from "../../Firebase";
import Header from "../Header";
import {
    Typography,
    Paper,
    Button,
    TextField,
    Snackbar,
    Alert,
    Container,
    Box,
    Avatar,
    Divider,
} from "@mui/material";
import {updateProfile, updatePassword, onAuthStateChanged} from "firebase/auth";
import {User} from "firebase/auth";

const UserProfile = () => {
    const [user, setUser] = useState<User | null>(null);
    const [nickname, setNickname] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordErrors, setPasswordErrors] = useState("");
    const [touched, setTouched] = useState(false);
    const [isGoogleOrFacebookUser, setIsGoogleOrFacebookUser] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");
    const [newProfileImage, setNewProfileImage] = useState<File | null>(null);
    const [profileImageName, setProfileImageName] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setNickname(currentUser.displayName || "");
                const providerId = currentUser.providerData[0]?.providerId;
                setIsGoogleOrFacebookUser(providerId === "google.com" || providerId === "facebook.com");
            } else {
                navigate("/signin");
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const validatePassword = (password: string) => {
        if (!password) return "";
        const errors = [];
        if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
        if (!/\d/.test(password)) errors.push("one number");
        if (!/[!@#$%^&*]/.test(password)) errors.push("one special character");
        if (password.length < 6) errors.push("at least 6 characters");
        return errors.length > 0 ? `Password must contain: ${errors.join(", ")}` : "";
    };

    const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pwd = e.target.value;
        setNewPassword(pwd);
        if (touched) {
            const errors = validatePassword(pwd);
            setPasswordErrors(errors);
        }
        setConfirmPassword("");
    };

    const handleNewPasswordBlur = () => {
        setTouched(true);
        const errors = validatePassword(newPassword);
        setPasswordErrors(errors);
    };

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            setSnackbarMessage("Passwords do not match");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
            return;
        }
        const errors = validatePassword(newPassword);
        if (errors) {
            setPasswordErrors(errors);
            return;
        }
        if (user) {
            try {
                await updatePassword(user, newPassword);
                setSnackbarMessage("Password updated successfully");
                setSnackbarSeverity("success");
                setSnackbarOpen(true);
                setNewPassword("");
                setConfirmPassword("");
                setPasswordErrors("");
                setTouched(false);
            } catch (error) {
                console.error("Error updating password:", error);
                setSnackbarMessage("Error updating password");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
            }
        }
    };

    const handleNicknameChange = async () => {
        if (user) {
            try {
                await updateProfile(user, {displayName: nickname});
                await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.uid}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({login: nickname}),
                });
                setSnackbarMessage("Nickname updated successfully");
                setSnackbarSeverity("success");
                setSnackbarOpen(true);
            } catch (error) {
                console.error("Error updating nickname:", error);
                setSnackbarMessage("Error updating nickname");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
            }
        }
    };

    const handleProfileImageUpload = async () => {
        if (user && newProfileImage) {
            const formData = new FormData();
            formData.append("image", newProfileImage);

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/users/upload-profile-image?firebaseId=${user.uid}`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to upload profile image");
                }
                const data = await response.json();
                const newImageUrl = data.imageUrl;

                await updateProfile(user, {photoURL: newImageUrl});
                setUser({...user, photoURL: newImageUrl});
                setSnackbarMessage("Profile image updated successfully");
                setSnackbarSeverity("success");
                setSnackbarOpen(true);
                setNewProfileImage(null);
                setProfileImageName("");
            } catch (error) {
                console.error("Error updating profile image:", error);
                setSnackbarMessage("Error updating profile image");
                setSnackbarSeverity("error");
                setSnackbarOpen(true);
            }
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
            setNewProfileImage(file);
            setProfileImageName(file.name);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    if (!user) {
        return null;
    }

    return (
        <Box
            sx={{minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)"}}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <Header/>
            <Container maxWidth="sm" sx={{py: 4}}>
                <Paper elevation={4} sx={{p: 4, borderRadius: 2}}>
                    <Box sx={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <Avatar
                            src={
                                user.photoURL ||
                                "https://via.placeholder.com/150?text=No+Image"
                            }
                            alt="Profile"
                            sx={{width: 120, height: 120, mb: 2}}
                        />
                        <Typography variant="h5" gutterBottom>
                            {user.displayName || user.email}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {user.email}
                        </Typography>
                    </Box>

                    <Divider sx={{my: 3}}/>

                    <Box component="form">
                        <TextField
                            label="Nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            fullWidth
                            margin="normal"
                        />
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleNicknameChange}
                            sx={{mt: 1, mb: 3}}
                        >
                            Update Nickname
                        </Button>

                        {!isGoogleOrFacebookUser && (
                            <>
                                <TextField
                                    label="New Password"
                                    type="password"
                                    value={newPassword}
                                    onChange={handleNewPasswordChange}
                                    onBlur={handleNewPasswordBlur}
                                    fullWidth
                                    margin="normal"
                                    error={!!passwordErrors}
                                    helperText={passwordErrors}
                                />
                                {newPassword && !passwordErrors && (
                                    <TextField
                                        label="Confirm Password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        fullWidth
                                        margin="normal"
                                    />
                                )}
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={handlePasswordChange}
                                    sx={{mt: 1, mb: 3}}
                                    disabled={!!passwordErrors || newPassword !== confirmPassword || !newPassword || !confirmPassword}
                                >
                                    Update Password
                                </Button>
                            </>
                        )}

                        <Box
                            sx={{
                                border: "2px dashed",
                                borderColor: "grey.300",
                                borderRadius: 1,
                                p: 2,
                                textAlign: "center",
                                mb: 2
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Typography variant="body1" gutterBottom>
                                Drag and drop an image
                            </Typography>
                            {profileImageName && (
                                <Typography variant="caption" display="block">
                                    Selected file: {profileImageName}
                                </Typography>
                            )}
                        </Box>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleProfileImageUpload}
                            disabled={!newProfileImage}
                            sx={{mb: 3}}
                        >
                            Update Profile Image
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate("/app")}
                        >
                            Back to Home
                        </Button>
                    </Box>
                </Paper>
            </Container>
            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{width: "100%"}}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default UserProfile;