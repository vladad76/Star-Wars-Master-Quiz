export type Alignment = 'Jedi' | 'Sith';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // index
  didYouKnow: string;
  imagePrompt: string;
  audioDescription: string;
}

export interface QuizResult {
  playerName: string;
  alignment: Alignment;
  score: number;
  timeInSeconds: number;
  maxStreak: number;
  difficulty: Difficulty;
  timestamp: any;
}

export interface LeaderboardEntry extends QuizResult {
  id: string;
}
