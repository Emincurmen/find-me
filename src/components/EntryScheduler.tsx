import React, { useState, useEffect } from 'react';
import { isAfter, parseISO } from 'date-fns';

interface EntrySchedulerProps {
  onStart: () => void;
}

export const EntryScheduler: React.FC<EntrySchedulerProps> = ({ onStart }) => {
  const [targetTime, setTargetTime] = useState<string>('');
  const [canStart, setCanStart] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!targetTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const target = parseISO(targetTime);
      
      if (isAfter(now, target) || targetTime === '') {
        setCanStart(true);
        setTimeRemaining('');
        clearInterval(interval);
      } else {
        const diff = target.getTime() - now.getTime();
        const minutes = Math.floor(diff / 1000 / 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeRemaining(`${minutes}m ${seconds}s`);
        setCanStart(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  const handleBegin = () => {
    onStart();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#fcfbf9] text-gray-900 font-sans">
      <div className="max-w-md w-full bg-white p-8 shadow-sm rounded-xl border border-gray-100 text-center">
        <h1 className="font-serif text-3xl mb-4 text-[#1d2a44]">Vefa'ya Giden Yol</h1>
        <p className="text-gray-500 mb-8 italic">Bir yolculuk başlıyor...</p>

        <div className="mb-6 text-left">
          <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Zamanı Belirle</label>
          <input 
            type="datetime-local" 
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-[#1d2a44] focus:border-[#1d2a44] bg-gray-50"
          />
        </div>

        {targetTime && !canStart && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md mb-6">
            <p className="text-sm text-gray-500">Turun başlamasına kalan süre</p>
            <p className="text-2xl font-mono text-[#1d2a44] font-bold">{timeRemaining}</p>
          </div>
        )}

        <button 
          onClick={handleBegin}
          disabled={!targetTime || !canStart}
          className={`w-full py-4 rounded-md font-medium transition-all ${
             (!targetTime || !canStart) 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-[#1d2a44] text-white hover:bg-[#121c2d] shadow-lg'
          }`}
        >
          {(!targetTime || !canStart) ? 'Zaman Gelmedi' : 'Hikayeye Başla'}
        </button>
      </div>
    </div>
  );
};
