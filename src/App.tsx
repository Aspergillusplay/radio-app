import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import MusicPlayer from "./components/MusicPlayer";
import SignUp from "./components/auth/SignUp";
import SignIn from "./components/auth/SignIn";
import AuthDetails from "./components/auth/AuthDetails";

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/signup" />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/app" element={<AppWithAuthDetails />} />
            </Routes>
        </Router>
    );
};

const AppWithAuthDetails = () => {
    return (
        <div>
            <AuthDetails />
            <MusicPlayer />
        </div>
    );
};

export default App;