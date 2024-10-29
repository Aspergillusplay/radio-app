import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../Firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

const SignUp = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [copyPassword, setCopyPassword] = useState("");
    const [error, setError] = useState<string>("");
    const navigate = useNavigate();

    function register(e: React.FormEvent) {
        e.preventDefault();
        if (copyPassword !== password) {
            setError("Passwords do not match");
            return;
        }
        createUserWithEmailAndPassword(auth, email, password)
            .then((user) => {
                console.log(user);
                setError("");
                setEmail("");
                setPassword("");
                setCopyPassword("");
                navigate("/signin");
            })
            .catch((err) => {
                console.log(err);
                setError("Error creating user");
            });
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center">Create an account</h1>
                <form onSubmit={register} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <input
                        type="password"
                        value={copyPassword}
                        onChange={(e) => setCopyPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button type="submit" className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Register
                    </button>
                    <button type="button" onClick={() => navigate("/signin")} className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                        Go to Login
                    </button>
                    <button type="button" onClick={() => navigate("/app")} className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                        Go to App
                    </button>
                    {error && <p className="text-red-600">{error}</p>}
                </form>
            </div>
        </div>
    );
};

export default SignUp;