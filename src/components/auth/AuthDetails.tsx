import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../Firebase";
import userIcon from "../../assets/user-icon.svg";

const AuthDetails = () => {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthUser(user);
            } else {
                setAuthUser(null);
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
                            </div>
                            <button
                                onClick={userSignOut}
                                className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-red-300 rounded-b-lg"
                            >
                                Logout
                            </button>
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