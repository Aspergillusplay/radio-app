import { useState, useRef, useEffect } from "react";
import AudioPlayer from "react-h5-audio-player";
import H5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { stations } from "../stations";

const MusicPlayer = () => {
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isUserSelecting] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const audioRef = useRef<H5AudioPlayer>(null);
    const [elapsedTime, setElapsedTime] = useState<number | null>(null);

    useEffect(() => {
        const savedVolume = localStorage.getItem("player-volume");
        if (savedVolume !== null) {
            setVolume(parseFloat(savedVolume));
        }

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

    const handlePlayPause = async (isPlaying: boolean) => {
        setIsPlaying(isPlaying);
        if (imgRef.current) {
            imgRef.current.style.animationPlayState = isPlaying ? "running" : "paused";
        }

        if (!isPlaying && currentTrackIndex !== null) {
            try {
                const response = await fetch(`http://localhost:3000/current-time?trackIndex=${currentTrackIndex}`);
                const data = await response.json();
                setElapsedTime(data.elapsedTime);
            } catch (error) {
                console.error("Error fetching current time from server:", error);
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
        setCurrentTrackIndex((prevIndex) => (prevIndex !== null ? (prevIndex + 1) % stations.length : 0));
    };

    const handleEnded = () => {
        handleNextTrack();
    };

    return (
        <div className="flex justify-center items-center flex-col h-screen">
            <div className="text-center bg-[aliceblue] rounded-2xl shadow-[0.3rem_0.3rem_8rem_#2563EB]">
                <div className="mb-4 p-5">
                    {currentTrackIndex !== null && (
                        <img
                            ref={imgRef}
                            src={stations[currentTrackIndex].albumArt}
                            alt={stations[currentTrackIndex].name}
                            className={`h-72 w-72 rounded-full shadow-[1px_1px_16px_black] ${
                                isPlaying ? "animate-slow-spin" : ""
                            } sm:h-96 sm:w-96`}
                            style={{ animationPlayState: isPlaying ? "running" : "paused" }}
                        />
                    )}
                </div>
                {currentTrackIndex !== null && (
                    <AudioPlayer
                        ref={audioRef}
                        style={{ borderBottomRightRadius: "20px", borderBottomLeftRadius: "20px" }}
                        src={stations[currentTrackIndex].path}
                        onPlay={() => handlePlayPause(true)}
                        onPause={() => handlePlayPause(false)}
                        header={stations[currentTrackIndex].name}
                        volume={volume}
                        onVolumeChange={handleVolumeChange}
                        autoPlayAfterSrcChange={false}
                        autoPlay={false}
                        listenInterval={1000}
                        onEnded={handleEnded}
                    />
                )}
            </div>
        </div>
    );
};

export default MusicPlayer;