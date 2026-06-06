export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  favoriteTeam: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  code: string;
  currentMatch: string;
  createdAt: string;
}

export interface Player {
  userId: string;
  displayName: string;
  photoURL: string;
  favoriteTeam: string;
  dosesOwed: number;
  dosesDrunk: number;
  updatedAt: string;
}

export interface Bet {
  id: string;
  roomId: string;
  title: string;
  options: string[];
  betValue: number;
  status: "open" | "resolved";
  votes: Record<string, number>; // Maps userId -> selected option index
  winnerOption?: number;
  creatorId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  type: "chat" | "drinking" | "system"; // drinking/system for automatic alerts
  createdAt: string;
}
