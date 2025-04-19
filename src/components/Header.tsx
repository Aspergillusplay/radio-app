import { Link } from "react-router-dom";
import AuthDetails from "./auth/AuthDetails";
import logo from "../assets/logo.png";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";
import { Button } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

interface HeaderProps {
    additionalButton?: React.ReactNode;
}

interface DbUser {
    firebaseId: string;
    role: "USER" | "ADMIN";
    createdAt?: string;
    updatedAt?: string;
}

const Header = ({ additionalButton }: HeaderProps) => {
    const [dbUser, setDbUser] = useState<DbUser | null>(null);

    useEffect(() => {
        const listener = onAuthStateChanged(auth, (user) => {
            if (user) {
                // After getting user from Firebase, fetch additional data from the database
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/${user.uid}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Failed to fetch user from DB");
                        }
                        return response.json();
                    })
                    .then((data: DbUser) => {
                        setDbUser(data);
                    })
                    .catch((error) => {
                        console.error("Error fetching DB user:", error);
                    });
            } else {
                setDbUser(null);
            }
        });
        return () => listener();
    }, []);

    return (
        <header className="bg-white shadow-sm">
            <div className="container mx-auto flex justify-between items-center px-4 py-4">
                <Link to="/" className="flex items-center">
                    <img src={logo} alt="Logo" className="h-8 mr-3" />
                    <span className="text-xl font-bold text-gray-800">Vortex FM</span>
                </Link>

                <div className="flex items-center gap-4">
                    {dbUser?.role === "ADMIN" && (
                        <Link to="/uploadAudio" className="no-underline">
                            <Button
                                variant="contained"
                                startIcon={<CloudUploadIcon />}
                                sx={{
                                    background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
                                    borderRadius: '8px',
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 8px rgba(37, 117, 252, 0.2)',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: '0 6px 12px rgba(37, 117, 252, 0.4)',
                                        background: 'linear-gradient(135deg, #7c1ff0 0%, #3485fc 100%)',
                                    }
                                }}
                            >
                                Upload Audio
                            </Button>
                        </Link>
                    )}
                    {additionalButton}
                    <AuthDetails />
                </div>
            </div>
        </header>
    );
};

export default Header;