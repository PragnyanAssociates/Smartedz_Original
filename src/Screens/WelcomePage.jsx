import { useNavigate } from 'react-router-dom';
import vspngoLogo from "../assets/vpsnewlogo.png";
import schoolImage from "../assets/schoolcover.jpg";

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col xl:flex-row bg-white overflow-x-hidden">
      <div className="flex w-full flex-col justify-between bg-gray-50 px-6 py-4 sm:px-12 xl:w-1/2 z-10 shadow-xl min-h-[50vh] xl:min-h-screen">
        <div className="flex-1 flex flex-col justify-center max-w-lg w-full">
          <img src={vspngoLogo} alt="Logo" className="h-20 w-auto mb-4 object-contain" />
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            Welcome to the Future of School Management
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            Unified platform for resources, students, and institutional operations.
          </p>
          <div className="pt-6">
            <button
              onClick={() => navigate('/login')}
              className="bg-indigo-600 px-8 py-3.5 text-white rounded-full font-semibold hover:bg-indigo-700 transition-all"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
      <div className="relative w-full flex-1 xl:w-1/2">
        <img src={schoolImage} className="absolute inset-0 h-full w-full object-cover" alt="School" />
      </div>
    </div>
  );
}