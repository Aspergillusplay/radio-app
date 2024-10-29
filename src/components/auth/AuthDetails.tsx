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
        <div>
            {authUser ? (
                <div>
                    <h1>Login as {authUser?.email}</h1>
                    <button onClick={userSignOut}>Logout</button>
                </div>
            ) : (
                <button onClick={() => navigate("/signin")}>Please login</button>
            )}
        </div>
    );
};

export default AuthDetails;