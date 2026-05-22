import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Home } from './pages/Home';
import { Room } from './pages/Room';
import { Downloads } from './pages/Downloads';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<Room />} />
          <Route path="/room/:id/downloads" element={<Downloads />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
