import { Link } from "react-router-dom";
import AuthDetails from "./auth/AuthDetails";
import logo from "../assets/logo.png";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../Firebase";
import {Button} from "@mui/material";

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
                // После получения пользователя из Firebase, получаем дополнительные данные из БД
                fetch(`http://localhost:3000/api/users/${user.uid}`)
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
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div className="text-2xl font-bold">
                    <Link to="/">
                        <img src={logo} alt="Logo" className="h-8" />
                    </Link>
                </div>
                <div className="flex items-center space-x-4">
                    {dbUser?.role === "ADMIN" && (
                        <Link to="/uploadAudio">
                            <Button variant="outlined">
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