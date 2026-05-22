import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Downloads } from './pages/Downloads';
import { HostSignIn } from './pages/HostSignIn';
import { Settings } from './pages/Settings';
import { Episodes } from './pages/Episodes';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<HostSignIn />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/episodes" element={<Episodes />} />
          <Route path="/room/:id" element={<Room />} />
          <Route path="/room/:id/downloads" element={<Downloads />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
