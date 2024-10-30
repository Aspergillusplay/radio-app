import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, signInWithGoogle } from "../../Firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

const SignIn = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();

    function login(e: React.FormEvent) {
        e.preventDefault();
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
                console.log(result);
                navigate("/app");
            })
            .catch((error) => {
                console.log(error);
                setError("Google sign-in failed");
            });
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center">Login</h1>
                <form onSubmit={login} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                    <button type="submit"
                            className="w-full px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700">
                        Login
                    </button>
                    <button type="button" onClick={() => navigate("/signup")}
                            className="w-full px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50">
                        Go to Register
                    </button>
                    <button type="button" onClick={() => navigate("/app")}
                            className="w-full px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50">
                        Go to App
                    </button>
                    <button type="button" onClick={handleGoogleSignIn}
                            className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-500 flex items-center justify-center">
                        <img src="/icon-google.svg" alt="Google icon" className="w-6 h-6 mr-2" />
                        Sign in with Google
                    </button>
                    {error && <p className="text-red-600">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default SignIn;