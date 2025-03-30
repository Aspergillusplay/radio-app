import { useState, useRef, useEffect } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { IconButton } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from '@mui/icons-material/Favorite';
// import RefreshIcon from '@mui/icons-material/Refresh';
import classNames from 'classnames';

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
    order?: number;
}

const MusicPlayer = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState<boolean>(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);
    const isManuallyPausedRef = useRef(false);

    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<AudioPlayer>(null);

    useEffect(() => {
        isManuallyPausedRef.current = isManuallyPaused;
    }, [isManuallyPaused]);

    const handleLikeToggle = async () => {
        if (currentTrackIndex === null) return;
        const trackId = tracks[currentTrackIndex].id;
        const userId = 1;
        try {
            let response;
            if (isLiked) {
                response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like?TrackId=${trackId}&UserId=${userId}`,
                    { method: 'DELETE' }
                );
            } else {
                response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ TrackId: trackId, UserId: userId }),
                    }
                );
            }
            if (!response.ok) {
                throw new Error('Failed to update like status');
            }
            setIsLiked(!isLiked);
        } catch (error) {
            console.error('Error updating like status:', error);
        }
    };

    useEffect(() => {
        if (tracks.length > 0 && currentTrackIndex !== null) {
            const trackId = tracks[currentTrackIndex].id;
            const userId = 1;
            const fetchLikeStatus = async () => {
                try {
                    const response = await fetch(
                        `${import.meta.env.VITE_BACKEND_URL}/api/tracks/like/status`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ TrackId: trackId, UserId: userId }),
                        }
                    );
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

    useEffect(() => {
        const savedVolume = localStorage.getItem("player-volume");
        if (savedVolume !== null) {
            setVolume(parseFloat(savedVolume));
        }
    }, []);

    useEffect(() => {
        const fetchTracks = async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_BACKEND_URL}/api/tracks`
                );
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

    useEffect(() => {
        const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}`);
        ws.onopen = () => {
            console.log("WebSocket connection established");
        };
        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "currentTrack") {
                if (data.trackIndex !== currentTrackIndex) {
                    setCurrentTrackIndex(data.trackIndex);
                    setElapsedTime(data.elapsedTime);
                    if (!isManuallyPausedRef.current) {
                        setIsPlaying(true);
                    }
                } else if (!isManuallyPausedRef.current) {
                    setElapsedTime(data.elapsedTime);
                    setIsPlaying(true);
                }
            }
        };
        ws.onclose = () => {
            console.log("WebSocket connection closed. Reconnecting...");
        };
        return () => {
            ws.close();
        };
    }, [currentTrackIndex]);

    useEffect(() => {
        if (
            currentTrackIndex !== null &&
            elapsedTime !== null &&
            audioRef.current &&
            audioRef.current.audio.current
        ) {
            const audio = audioRef.current.audio.current;
            if (!isManuallyPaused) {
                audio.currentTime = elapsedTime;
                if (isPlaying && audio.paused) {
                    audio.play().catch((err) =>
                        console.error("Error during playback:", err)
                    );
                }
            }
        }
    }, [currentTrackIndex, elapsedTime, isPlaying, isManuallyPaused]);

    const handlePlayPause = async (playing: boolean) => {
        setIsPlaying(playing);
        if (imgRef.current) {
            imgRef.current.style.animationPlayState = playing ? "running" : "paused";
        }
        if (playing) {
            setIsManuallyPaused(false);
            isManuallyPausedRef.current = false;
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
                    audio.play().catch((err) =>
                        console.error("Error during playback:", err)
                    );
                }
            } catch (error) {
                console.error("Error fetching current time from server:", error);
            }
        } else {
            setIsManuallyPaused(true);
            isManuallyPausedRef.current = true;
            if (audioRef.current && audioRef.current.audio.current) {
                const audio = audioRef.current.audio.current;
                setElapsedTime(audio.currentTime);
            }
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
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            setCurrentTrackIndex(nextIndex);
            setElapsedTime(0);
            setIsManuallyPaused(false);
            isManuallyPausedRef.current = false;
        }
    };

    // const handleReorderTracks = async () => {
    //     try {
    //         const response = await fetch(
    //             `${import.meta.env.VITE_BACKEND_URL}/api/tracks/reorder`,
    //             { method: "POST" }
    //         );
    //         if (!response.ok) {
    //             throw new Error("Failed to reorder tracks");
    //         }
    //         const updatedTracks = await response.json();
    //         setTracks(updatedTracks);
    //         setCurrentTrackIndex(0);
    //         setElapsedTime(0);
    //     } catch (error) {
    //         console.error("Error reordering tracks:", error);
    //     }
    // };

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
                <p>Нет выбранного трека или список треков пуст</p>
            </div>
        );
    }

    const currentArtistImage = tracks[currentTrackIndex].Artist?.image
        ? `${import.meta.env.VITE_MINIO_PORT}/images/${tracks[currentTrackIndex].Artist.image}`
        : `${import.meta.env.VITE_MINIO_PORT}/images/defaultAlbumArt.jpg`;
    const currentTrackName = tracks[currentTrackIndex].name;
    const currentArtistName =
        tracks[currentTrackIndex].Artist?.name || "Unknown Artist";

    return (
        <div
            className={classNames("min-h-screen flex justify-center items-center p-4", {
                "animate-gradient": isPlaying,
                "bg-gradient-to-br from-blue-100 to-blue-300": !isPlaying
            })}
            style={{animationPlayState: isPlaying ? "running" : "paused"}}
        >
            <div
                className="bg-white bg-opacity-80 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
                <div className="mb-6">
                    <img
                        ref={imgRef}
                        src={currentArtistImage}
                        alt={currentArtistName}
                        className="mx-auto h-64 w-64 sm:h-72 sm:w-72 rounded-full shadow-xl animate-slow-spin"
                        style={{animationPlayState: isPlaying ? "running" : "paused"}}
                    />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {currentArtistName}
                </h2>
                <p className="text-gray-600 mb-4">{currentTrackName}</p>
                <AudioPlayer
                    ref={audioRef}
                    className="custom-audio-player"
                    style={{
                        borderRadius: "1rem",
                        background: "rgba(255, 255, 255, 0.9)",
                    }}
                    src={`${import.meta.env.VITE_BACKEND_URL}/api/tracks/stream/${tracks[currentTrackIndex].path}`}
                    onPlay={() => handlePlayPause(true)}
                    onPause={() => handlePlayPause(false)}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                    autoPlayAfterSrcChange={true}
                    autoPlay={true}
                    listenInterval={1000}
                    onEnded={handleNextTrack}
                    onError={(e) => {
                        console.error("Audio playback error:", e);
                        handleNextTrack();
                    }}
                    onLoadedMetaData={() => {
                        if (
                            audioRef.current &&
                            audioRef.current.audio.current &&
                            elapsedTime !== null &&
                            !isManuallyPaused
                        ) {
                            audioRef.current.audio.current.currentTime = elapsedTime;
                        }
                    }}
                    showSkipControls={false}
                    showJumpControls={false}
                    customAdditionalControls={[
                        <IconButton onClick={handleLikeToggle} key="like-button">
                            {isLiked ? (
                                <FavoriteIcon color="error"/>
                            ) : (
                                <FavoriteBorderIcon/>
                            )}
                        </IconButton>,
                        // <IconButton onClick={handleReorderTracks} key="reorder-button">
                        //     <RefreshIcon/>
                        // </IconButton>
                    ]}
                    customProgressBarSection={[]}
                />
            </div>
        </div>
    );
};

export default MusicPlayer;