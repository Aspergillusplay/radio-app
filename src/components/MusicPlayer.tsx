import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { stations } from "../stations.ts";
import { useState, useRef, useEffect } from "react";

const MusicPlayer = () => {
    const [station, setStation] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const savedVolume = localStorage.getItem('player-volume');
        if (savedVolume !== null) {
            setVolume(parseFloat(savedVolume));
        }
    }, []);

    const handleClickNext = () => {
        setStation((currentTrack) => currentTrack < stations.length - 1 ? currentTrack + 1 : 0);
    }

    const handleClickPrevious = () => {
        setStation((currentTrack) => currentTrack > 0 ? currentTrack - 1 : stations.length - 1);
    }

    const handlePlayPause = (isPlaying: boolean) => {
        setIsPlaying(isPlaying);
        if (imgRef.current) {
            if (isPlaying) {
                imgRef.current.style.animationPlayState = 'running';
            } else {
                imgRef.current.style.animationPlayState = 'paused';
            }
        }
    }

    const handleVolumeChange = (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const newVolume = target.volume;
        setVolume(newVolume);
        localStorage.setItem('player-volume', newVolume.toString());
    }

    return (
        <div className="flex justify-center items-center flex-col h-screen">
            <div className="text-center bg-[aliceblue] rounded-2xl shadow-[0.3rem_0.3rem_8rem_#2563EB]">
                <div className="mb-4 p-5">
                    <img
                        ref={imgRef}
                        src={stations[station].albumArt}
                        alt={stations[station].name}
                        className={`rounded-full shadow-[1px_1px_16px_black] ${isPlaying ? 'animate-slow-spin' : ''}`}
                        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                    />
                </div>
                <AudioPlayer
                    style={{ borderBottomRightRadius: "20px", borderBottomLeftRadius: "20px" }}
                    src={stations[station].path}
                    onClickNext={handleClickNext}
                    onClickPrevious={handleClickPrevious}
                    showSkipControls={true}
                    showJumpControls={false}
                    showFilledVolume={true}
                    onPlay={() => handlePlayPause(true)}
                    onPause={() => handlePlayPause(false)}
                    header={stations[station].name}
                    volume={volume}
                    onVolumeChange={handleVolumeChange}
                />
            </div>
        </div>
    );
};

export default MusicPlayer;