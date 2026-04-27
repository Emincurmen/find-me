export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  theme: string;
  historicalTeaser: string;
  videoUrl: string; // Placeholder for AI MP4 video
  poem: string[];
  trackId: string; // Placeholder for Spotify embed track ID
  externalMapLink: string;
};

export const STORY_STOPS: Stop[] = [
  {
    id: "cibali",
    name: "Cibali Kapısı",
    lat: 41.0258,
    lng: 28.9587,
    theme: "Surları Aşmak",
    historicalTeaser: "Haliç'in serin rüzgarıyla fısıldayan kadim surların gölgesinde ilk adım...",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    poem: [
      "Bir kapı aralanır geçmişe,",
      "Surlar fısıldar adını denize.",
      "Aşılmaz denen ne varsa hayatta,",
      "Yıkılır sevgiyle inanca."
    ],
    trackId: "4pt5fDVTg5GhEvEtLZ9zAW", // Clarinet placeholder
    externalMapLink: "https://maps.apple.com/?q=41.0258,28.9587"
  },
  {
    id: "bozdogan",
    name: "Bozdoğan Kemeri",
    lat: 41.0163,
    lng: 28.9542,
    theme: "Köprüler Kurmak",
    historicalTeaser: "İki kıtayı değil, zamanı ve kalpleri birbirine bağlayan tarihi kemerler...",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    poem: [
      "Taş üstüne taş koymuş zaman,",
      "Suları taşımış sevda bağından.",
      "Ne köprüler yıkıldı ömürden,",
      "Bizim köprümüz sağlam kalpten."
    ],
    trackId: "3n3Ppam7vgaBg1Esqf1Icy", // Piano placeholder
    externalMapLink: "https://maps.apple.com/?q=41.0163,28.9542"
  },
  {
    id: "vefa",
    name: "Vefa",
    lat: 41.0155,
    lng: 28.9592,
    theme: "Vefa ve Sadakat",
    historicalTeaser: "Sadece bir semt adı değil, insanın insanla olan ebedi sözleşmesi...",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    poem: [
      "Vefa sadece bir semt değil,",
      "Kalbe kazınmış ebedi bir sözdür.",
      "Yollar biter, menzil görünür,",
      "En güzel hediye bu ömürdür."
    ],
    trackId: "6pMQN5Mmb0vH27E4x729Yk", // Cello placeholder
    externalMapLink: "https://maps.apple.com/?q=41.0155,28.9592"
  }
];
