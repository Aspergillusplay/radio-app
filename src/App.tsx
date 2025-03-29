import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import MusicPlayer from "./components/MusicPlayer";
import SignUp from "./components/auth/SignUp";
import SignIn from "./components/auth/SignIn";
import Header from "./components/Header";
import AudioList from "./components/AudioList";
import UploadAudio from "./components/upload/UploadAudio.tsx";
import WishPage from "./components/WishPage.tsx";
import UserProfile from "./components/auth/UserProfile.tsx";

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/app" />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/app" element={<AppWithAuthDetails />} />
                <Route path="/tracks" element={<AudioList />} />
                <Route path="/uploadAudio" element={<UploadAudio />} />
                <Route path="/wish" element={<WishPage />} />
                <Route path="/profile" element={<UserProfile />} />
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