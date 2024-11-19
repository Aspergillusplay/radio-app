import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import MusicPlayer from "./components/MusicPlayer";
import SignUp from "./components/auth/SignUp";
import SignIn from "./components/auth/SignIn";
import Header from "./components/Header";
import AudioList from "./components/AudioList";

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/signup" />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/app" element={<AppWithAuthDetails />} />
                <Route path="/tracks" element={<AudioList />} />
            </Routes>
        </Router>
    );
};

const AppWithAuthDetails = () => {
    return (
        <div className="bg-gray-100">
            <Header />
            <MusicPlayer />
        </div>
    );
};

export default App;
