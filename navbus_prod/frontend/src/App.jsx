import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Splash from './pages/Splash';
import { Login, Register } from './pages/Auth';
import LocationPermission from './pages/LocationPermission';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import BusTracking from './pages/BusTracking';
import DriverDashboard from './pages/DriverDashboard';
import RouteDetail from './pages/RouteDetail';

function ProtectedRoute({ children, driverOnly = false }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" />;
  if (driverOnly && user.role !== 'driver') return <Navigate to="/home" />;
  if (!driverOnly && user.role === 'driver') return <Navigate to="/driver" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/location-permission" element={<LocationPermission />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
      <Route path="/bus/:id" element={<ProtectedRoute><BusTracking /></ProtectedRoute>} />
      <Route path="/route/:id" element={<ProtectedRoute><RouteDetail /></ProtectedRoute>} />
      <Route path="/driver" element={<ProtectedRoute driverOnly><DriverDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
