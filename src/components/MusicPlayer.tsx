import {useState, useRef, useEffect} from "react";
import AudioPlayer from "react-h5-audio-player";
import H5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import {IconButton} from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from '@mui/icons-material/Favorite';

interface IArtist {
    id: number;
    name: string;
    image: string;
}

interface ITrack {
    id: number;
    name: string;
    path: string;
    Artist?: IArtist;
}

const MusicPlayer = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5); // default 50%
    const [isUserSelecting] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<H5AudioPlayer>(null);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState<boolean>(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);

    const handleLikeToggle = () => {
        setIsLiked(!isLiked);
    };

    useEffect(() => {
        const savedVolume = localStorage.getItem("player-volume");
        if (savedVolume !== null) {
            setVolume(parseFloat(savedVolume));
        }
    }, []);

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch("http://localhost:3000/api/tracks");
                if (!response.ok) {
                    throw new Error("Failed to fetch tracks");
                }
                const data = await response.json();
                setTracks(data);
                if (data.length > 0) {
                    setCurrentTrackIndex(0);
                }
            } catch (err: unknown) {
                console.error("Error fetching tracks:", err);
                setTracksError("Не удалось загрузить список треков");
            } finally {
                setLoadingTracks(false);
            }
        };

        fetchTracks();
    }, []);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:3000");

        ws.onopen = () => {
            console.log("WebSocket connection established");
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "currentTrack" && !isUserSelecting) {
                setCurrentTrackIndex(data.trackIndex);
                setElapsedTime(data.elapsedTime);
                setIsPlaying(true);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket connection closed. Reconnecting...");
        };

        return () => {
            ws.close();
        };
    }, [isUserSelecting]);

    useEffect(() => {
        if (
            currentTrackIndex !== null &&
            elapsedTime !== null &&
            audioRef.current &&
            audioRef.current.audio.current
        ) {
            const audio = audioRef.current.audio.current;
            audio.currentTime = elapsedTime;
            if (isPlaying && audio.paused) {
                audio.play().catch((err) => console.error("Error during playback:", err));
            }
        }
    }, [currentTrackIndex, elapsedTime, isPlaying]);

    const handlePlayPause = async (playing: boolean) => {
        setIsPlaying(playing);
        if (imgRef.current) {
            imgRef.current.style.animationPlayState = playing ? "running" : "paused";
        }
        if (playing && currentTrackIndex !== null) {
            try {
                const response = await fetch(
                    `http://localhost:3000/current-time?trackIndex=${currentTrackIndex}`,
                    {mode: "cors"}
                );
                if (!response.ok) {
                    if (response.status === 400) {
                        console.error("Invalid track index.");
                    } else {
                        console.error(`HTTP error! status: ${response.status}`);
                    }
                    return;
                }
                const data = await response.json();
                setElapsedTime(data.elapsedTime);
                if (audioRef.current && audioRef.current.audio.current) {
                    const audio = audioRef.current.audio.current;
                    audio.currentTime = data.elapsedTime;
                    audio.play().catch((err) => console.error("Error during playback:", err));
                }
            } catch (error) {
                console.error("Error fetching current time from server:", error);
            }
        } else if (!playing && audioRef.current && audioRef.current.audio.current) {
            const audio = audioRef.current.audio.current;
            setElapsedTime(audio.currentTime);
        }
    };

    const handleVolumeChange = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const newVolume = target.volume;
        setVolume(newVolume);
        localStorage.setItem("player-volume", newVolume.toString());
    };

    const handleNextTrack = () => {
        setCurrentTrackIndex((prevIndex) =>
            prevIndex !== null && tracks.length > 0 ? (prevIndex + 1) % tracks.length : 0
        );
    };

    const handleEnded = () => {
        handleNextTrack();
    };

    if (loadingTracks) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>Загрузка треков...</p>
            </div>
        );
    }

    if (tracksError) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>{tracksError}</p>
            </div>
        );
    }

    if (currentTrackIndex === null || tracks.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>Трек не выбран или список треков пуст</p>
            </div>
        );
    }

    const currentArtistImage = tracks[currentTrackIndex].Artist?.image
        ? `/assets/${tracks[currentTrackIndex].Artist.image}`
        : "/assets/defaultAlbumArt.jpg";

    const currentTrackName = tracks[currentTrackIndex].name;
    const currentArtistName = tracks[currentTrackIndex].Artist?.name || "Unknown Artist";

    return (
        <div className="flex justify-center items-center flex-col h-screen">
            <div className="text-center bg-[aliceblue] rounded-2xl shadow-[0.3rem_0.3rem_8rem_#2563EB]">
                <div className="mb-4 p-5">
                    <img
                        ref={imgRef}
                        src={currentArtistImage}
                        alt={currentArtistName}
                        className={`h-72 w-72 rounded-full shadow-[1px_1px_16px_black] ${isPlaying ? "animate-slow-spin" : ""} sm:h-96 sm:w-96`}
                        style={{animationPlayState: isPlaying ? "running" : "paused"}}
                    />
                </div>
                <h2 className="text-xl font-bold mb-4">{`${currentArtistName}: ${currentTrackName}`}</h2>
                <div className="flex items-center justify-center">
                    <AudioPlayer
                        ref={audioRef}
                        className="custom-audio-player"
                        style={{borderBottomRightRadius: "20px", borderBottomLeftRadius: "20px"}}
                        src={tracks[currentTrackIndex].path}
                        onPlay={() => handlePlayPause(true)}
                        onPause={() => handlePlayPause(false)}
                        volume={volume}
                        onVolumeChange={handleVolumeChange}
                        autoPlayAfterSrcChange={true}
                        autoPlay={true}
                        listenInterval={1000}
                        onEnded={handleEnded}
                        showSkipControls={false}
                        showJumpControls={false}
                        customAdditionalControls={[
                            <IconButton onClick={handleLikeToggle} key="like-button">
                                {isLiked ? <FavoriteIcon color="error"/> : <FavoriteBorderIcon/>}
                            </IconButton>
                        ]}
                        customProgressBarSection={[]}
                    />
                </div>
            </div>
        </div>
    );
};

export default MusicPlayer;