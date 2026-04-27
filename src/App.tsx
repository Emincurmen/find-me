import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { EntryScheduler } from './components/EntryScheduler';
import { ExperienceView } from './components/ExperienceView';
import { AdminDashboard } from './components/AdminDashboard';

// Tek kullanıcı için sabit tur ID'si
export const TOUR_ID = 'main_tour';

// Sayfa yenilenince "başlandı mı?" bilgisini localStorage'da tut
const STARTED_KEY = 'find_me_started';

const App: React.FC = () => {
  const [started, setStarted] = useState<boolean>(() => {
    return localStorage.getItem(STARTED_KEY) === 'true';
  });

  const handleStart = () => {
    localStorage.setItem(STARTED_KEY, 'true');
    setStarted(true);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            !started ? (
              <EntryScheduler onStart={handleStart} />
            ) : (
              <ExperienceView tourId={TOUR_ID} />
            )
          }
        />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
