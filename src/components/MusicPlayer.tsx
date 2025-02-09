import { useState, useRef, useEffect } from "react";
import AudioPlayer from "react-h5-audio-player";
import H5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { IconButton } from "@mui/material";
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
    likes: number;
}

const MusicPlayer = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    // Изначально currentTrackIndex не задан, чтобы потом задать его из состояния сервера
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isUserSelecting] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<H5AudioPlayer>(null);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState<boolean>(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);

    const handleLikeToggle = async () => {
        if (currentTrackIndex === null) return;
        const trackId = tracks[currentTrackIndex].id;
        const userId = 1;

        try {
            let response;
            if (isLiked) {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${trackId}&UserId=${userId}`, {
                    method: 'DELETE',
                });
            } else {
                response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ TrackId: trackId, UserId: userId }),
                });
            }
            if (!response.ok) {
                throw new Error('Failed to update like status');
            }
            setIsLiked(!isLiked);
        } catch (error) {
            console.error('Error updating like status:', error);
        }
    };

    // Получение лайка для текущего трека
    useEffect(() => {
        if (tracks.length > 0 && currentTrackIndex !== null) {
            const trackId = tracks[currentTrackIndex].id;
            const userId = 1;
            const fetchLikeStatus = async () => {
                try {
                    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ TrackId: trackId, UserId: userId }),
                    });
                    if (!response.ok) {
                        throw new Error('Failed to fetch like status');
                    }
                    const data = await response.json();
                    setIsLiked(data.isLiked);
                } catch (error) {
                    console.error('Error fetching like status:', error);
                }
            };
            fetchLikeStatus();
        }
    }, [currentTrackIndex, tracks]);

    // Загружаем сохранённый уровень громкости
    useEffect(() => {
        const savedVolume = localStorage.getItem("player-volume");
        if (savedVolume !== null) {
            setVolume(parseFloat(savedVolume));
        }
    }, []);

    // Получаем список треков
    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tracks`);
                if (!response.ok) {
                    throw new Error("Failed to fetch tracks");
                }
                const data = await response.json();
                setTracks(data);
            } catch (err: unknown) {
                console.error("Error fetching tracks:", err);
                setTracksError("Failed to load track list");
            } finally {
                setLoadingTracks(false);
            }
        };
        fetchTracks();
    }, []);

    // После загрузки треков запрашиваем у сервера актуальное состояние воспроизведения
    useEffect(() => {
        if (tracks.length > 0) {
            fetch(`${import.meta.env.VITE_BACKEND_URL}/current-time`)
                .then(res => res.json())
                .then(data => {
                    setCurrentTrackIndex(data.trackIndex);
                    setElapsedTime(data.elapsedTime);
                })
                .catch(err => console.error("Error fetching current time on mount:", err));
        }
    }, [tracks]);

    // Подключаем WebSocket (порт изменён на 3010)
    useEffect(() => {
        const ws = new WebSocket("ws://localhost:3010");
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

    // При изменении currentTrackIndex или elapsedTime синхронизируем аудиоэлемент
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

    // При нажатии Play запрашиваем актуальное состояние воспроизведения с сервера
    const handlePlayPause = async (playing: boolean) => {
        setIsPlaying(playing);
        if (imgRef.current) {
            imgRef.current.style.animationPlayState = playing ? "running" : "paused";
        }
        if (playing) {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/current-time`,
                    { mode: "cors" }
                );
                if (!response.ok) {
                    console.error(`HTTP error! status: ${response.status}`);
                    return;
                }
                const data = await response.json();
                setCurrentTrackIndex(data.trackIndex);
                setElapsedTime(data.elapsedTime);
                if (audioRef.current && audioRef.current.audio.current) {
                    const audio = audioRef.current.audio.current;
                    audio.currentTime = data.elapsedTime;
                    audio.play().catch((err) => console.error("Error during playback:", err));
                }
            } catch (error) {
                console.error("Error fetching current time from server:", error);
            }
        } else if (audioRef.current && audioRef.current.audio.current) {
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
        if (tracks.length > 0 && currentTrackIndex !== null) {
            setCurrentTrackIndex((prevIndex) =>
                (prevIndex! + 1) % tracks.length
            );
        }
    };

    const handleEnded = () => {
        handleNextTrack();
    };

    if (loadingTracks) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p>Loading tracks...</p>
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
                <p>No track selected or track list is empty</p>
            </div>
        );
    }

    const currentArtistImage = tracks[currentTrackIndex].Artist?.image
        ? `http://localhost:9000/images/${tracks[currentTrackIndex].Artist.image}`
        : "http://localhost:9000/images/defaultAlbumArt.jpg";
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
                        className={`h-72 w-72 rounded-full shadow-[1px_1px_16px_black] animate-slow-spin sm:h-96 sm:w-96`}
                        style={{ animationPlayState: "running" }}
                    />
                </div>
                <h2 className="text-xl font-bold mb-4">{`${currentArtistName}: ${currentTrackName}`}</h2>
                <div className="flex items-center justify-center">
                    <AudioPlayer
                        ref={audioRef}
                        className="custom-audio-player"
                        style={{ borderBottomRightRadius: "20px", borderBottomLeftRadius: "20px" }}
                        src={`${import.meta.env.VITE_BACKEND_URL}/api/tracks/stream/${tracks[currentTrackIndex].path}`}
                        onPlay={() => handlePlayPause(true)}
                        onPause={() => handlePlayPause(false)}
                        volume={volume}
                        onVolumeChange={handleVolumeChange}
                        autoPlayAfterSrcChange={true}
                        autoPlay={true}
                        listenInterval={1000}
                        onEnded={handleEnded}
                        // При загрузке метаданных аудио устанавливаем позицию согласно server elapsedTime
                        onLoadedMetaData={() => {
                            if (audioRef.current && audioRef.current.audio.current && elapsedTime !== null) {
                                audioRef.current.audio.current.currentTime = elapsedTime;
                            }
                        }}
                        showSkipControls={false}
                        showJumpControls={false}
                        customAdditionalControls={[
                            <IconButton onClick={handleLikeToggle} key="like-button">
                                {isLiked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
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
