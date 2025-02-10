import { useState, useRef, useEffect } from "react";
import AudioPlayer from "react-h5-audio-player";
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
    order?: number;
}

const MusicPlayer = () => {
    const [tracks, setTracks] = useState<ITrack[]>([]);
    // Изначально currentTrackIndex не задан, чтобы потом задать его из состояния сервера
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);
    const [loadingTracks, setLoadingTracks] = useState<boolean>(true);
    const [tracksError, setTracksError] = useState<string>("");
    const [isLiked, setIsLiked] = useState(false);
    // Флаг, показывающий, что пользователь вручную поставил плеер на паузу
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);
    // Реф для хранения текущего состояния ручной паузы (чтобы быть актуальным внутри WS-обработчика)
    const isManuallyPausedRef = useRef(false);

    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<AudioPlayer>(null);

    // Обновляем ref при изменении isManuallyPaused
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

    // Получаем лайк для текущего трека
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

    // Подключаем WebSocket для синхронизации (порт – 3010)
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
            if (data.type === "currentTrack") {
                // Если сервер сообщил о новом треке, всегда обновляем индекс,
                // а elapsedTime обновляем только если это не тот же трек или если плеер не на паузе.
                if (data.trackIndex !== currentTrackIndex) {
                    setCurrentTrackIndex(data.trackIndex);
                    setElapsedTime(data.elapsedTime);
                    // Если пользователь не поставил плеер на паузу, включаем воспроизведение.
                    if (!isManuallyPausedRef.current) {
                        setIsPlaying(true);
                    }
                } else if (!isManuallyPausedRef.current) {
                    // Если трек тот же, обновляем elapsedTime, если плеер не на паузе.
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

    // Синхронизируем аудиоэлемент с данными (текущий тайм и состояние воспроизведения)
    useEffect(() => {
        if (
            currentTrackIndex !== null &&
            elapsedTime !== null &&
            audioRef.current &&
            audioRef.current.audio.current
        ) {
            const audio = audioRef.current.audio.current;
            // Если плеер не находится в ручной паузе, синхронизируем время и запускаем воспроизведение
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

    // Обработчик нажатия кнопки Play/Pause
    const handlePlayPause = async (playing: boolean) => {
        setIsPlaying(playing);
        if (imgRef.current) {
            imgRef.current.style.animationPlayState = playing ? "running" : "paused";
        }
        if (playing) {
            setIsManuallyPaused(false);
            // Обновляем ref
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
            // При нажатии паузы фиксируем текущее время и отмечаем, что это ручная пауза.
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

    // При завершении воспроизведения трека – переходим к следующему
    const handleNextTrack = () => {
        if (tracks.length > 0 && currentTrackIndex !== null) {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            setCurrentTrackIndex(nextIndex);
            // При смене трека сбрасываем elapsedTime и сбрасываем ручную паузу (автоматический запуск нового трека)
            setElapsedTime(0);
            setIsManuallyPaused(false);
            isManuallyPausedRef.current = false;
        }
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
    const currentArtistName =
        tracks[currentTrackIndex].Artist?.name || "Unknown Artist";

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
                        style={{
                            borderBottomRightRadius: "20px",
                            borderBottomLeftRadius: "20px",
                        }}
                        // Используем stream-эндпоинт для воспроизведения
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
                            // Если произошла ошибка (например, недоступен скачанный трек), переходим к следующему
                            handleNextTrack();
                        }}
                        // При загрузке метаданных аудио устанавливаем позицию согласно server elapsedTime
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
                                    <FavoriteIcon color="error" />
                                ) : (
                                    <FavoriteBorderIcon />
                                )}
                            </IconButton>,
                        ]}
                        customProgressBarSection={[]}
                    />
                </div>
            </div>
        </div>
    );
};

export default MusicPlayer;
