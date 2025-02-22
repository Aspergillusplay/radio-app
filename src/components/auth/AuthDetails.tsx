import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../Firebase";
import userIcon from "../../assets/user-icon.svg";
import { Button } from "@mui/material";

interface DbUser {
    firebaseId: string;
    role: "USER" | "ADMIN";
    createdAt?: string;
    updatedAt?: string;
}

const AuthDetails = () => {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [dbUser, setDbUser] = useState<DbUser | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthUser(user);
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
                setAuthUser(null);
                setDbUser(null);
            }
        });
        return () => listener();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    function userSignOut() {
        auth.signOut()
            .then(() => {
                console.log("User signed out");
                navigate("/signin");
            })
            .catch((err) => console.log(err));
    }

    return (
        <div className="relative flex items-center space-x-4">
            {authUser ? (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center"
                    >
                        <img
                            src={userIcon}
                            alt="User Icon"
                            className="h-10 w-10 hover:opacity-75"
                        />
                    </button>
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                            <div className="px-4 py-2 text-gray-700">
                                {authUser.displayName || authUser.email}
                                {dbUser && (
                                    <span className="ml-2 text-sm text-gray-500">
                                        ({dbUser.role})
                                    </span>
                                )}
                            </div>
                            <Button
                                onClick={() => navigate("/tracks")}
                                className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                            >
                                Track list
                            </Button>
                            <Button
                                onClick={() => navigate("/wish")}
                                className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                            >
                                Make a wish
                            </Button>
                            <Button
                                onClick={userSignOut}
                                className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-red-300 rounded-b-lg"
                            >
                                Logout
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => navigate("/signin")}
                    className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                    Please login
                </button>
            )}
        </div>
    );
};

export default AuthDetails;
