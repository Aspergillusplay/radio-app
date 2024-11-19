import { stations } from "../stations";
import {useNavigate } from "react-router-dom";
import Header from "./Header";

const AudioList = () => {
    const navigate = useNavigate();

    const handleTrackClick = (index: number) => {
        navigate(`/app?track=${index}`);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <Header/>
            <main className="container mx-auto p-4">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Track list</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stations.map((station, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer"
                            onClick={() => handleTrackClick(index)}
                        >
                            <img
                                src={station.albumArt}
                                alt={station.name}
                                className="w-full h-48 object-cover"
                            />
                            <div className="p-4">
                                <h2 className="text-lg font-semibold text-gray-800">{station.name}</h2>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default AudioList;