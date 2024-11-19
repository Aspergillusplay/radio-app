import { Link } from "react-router-dom";
import AuthDetails from "./auth/AuthDetails.tsx";
import logo from "../assets/logo.png";

interface HeaderProps {
    additionalButton?: React.ReactNode;
}

const Header = ({ additionalButton }: HeaderProps) => {
    return (
        <header className="bg-white shadow-md">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div className="text-2xl font-bold">
                    <Link to="/">
                        <img src={logo} alt="Logo" className="h-8" />
                    </Link>
                </div>
                <div className="flex items-center space-x-4">
                    {additionalButton}
                    <AuthDetails />
                </div>
            </div>
        </header>
    );
};

export default Header;