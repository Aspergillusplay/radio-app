import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../Firebase";

const AuthDetails = () => {
    const [authUser, setAuthUser] = useState<User | null>(null);
    const navigate = useNavigate();

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

    function userSignOut() {
        auth.signOut()
            .then(() => {
                console.log("User signed out");
                navigate("/signin");
            })
            .catch((err) => console.log(err));
    }

    return (
        <div className="flex items-center space-x-4">
            {authUser ? (
                <div className="flex items-center space-x-2">
                    <span className="text-gray-700">{authUser?.email}</span>
                    <button
                        onClick={userSignOut}
                        className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                        Logout
                    </button>
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