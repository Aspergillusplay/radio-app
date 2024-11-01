import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {auth, signInWithGoogle} from "../../Firebase";
import {createUserWithEmailAndPassword} from "firebase/auth";

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
                    <button type="submit"
                            className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Register
                    </button>
                    <button type="button" onClick={() => navigate("/signin")}
                            className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                        Go to Login
                    </button>
                    <button type="button" onClick={() => navigate("/app")}
                            className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                        Go to App
                    </button>
                </form>
                <hr className="my-6 border-gray-300 w-full"/>
                <div className="flex justify-evenly">
                    <button type="button" onClick={handleGoogleSignIn}
                            className="w-16 h-16 text-white border hover:bg-blue-50 rounded-lg flex items-center justify-center">
                        <img src="/icon-google.svg" alt="Google icon" className="w-10 h-10"/>
                    </button>
                    <button type="button" onClick={handleGoogleSignIn}
                            className="w-16 h-16 text-white border hover:bg-blue-50 rounded-lg flex items-center justify-center">
                        <img src="/icon-google.svg" alt="Google icon" className="w-10 h-10"/>
                    </button>
                    <button type="button" onClick={handleGoogleSignIn}
                            className="w-16 h-16 text-white border hover:bg-blue-50 rounded-lg flex items-center justify-center">
                        <img src="/icon-google.svg" alt="Google icon" className="w-10 h-10"/>
                    </button>
                </div>
                {error && <p className="text-red-600">{error}</p>}
            </div>
        </div>
    );
};

export default SignUp;