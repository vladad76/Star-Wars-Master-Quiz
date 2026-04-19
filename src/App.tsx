import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Shield, 
  Zap, 
  Timer, 
  Terminal, 
  ChevronRight, 
  RotateCcw, 
  Download, 
  Trash2, 
  Lock, 
  Info,
  CheckCircle2,
  XCircle,
  Sword,
  Skull,
  Upload
} from 'lucide-react';
import { generateQuizQuestions } from './services/geminiService';
import { Question, Difficulty, Alignment, LeaderboardEntry, QuizResult } from './types';

// Constants
const ADMIN_PASSWORD = "AlsysSW001";
const QUESTIONS_PER_RUN = 10;
const SESSION_EXCLUSION_KEY = "sw_seen_questions";
const MAX_SESSION_HISTORY = 240; // 10 questions * 24 sessions

// ASCII Art Assets
const X_WING_ASCII = `
      _                                     _
     / \\                                   / \\
    |   |                                 |   |
    |   |_________________________________|   |
   /     \\           / _ \\               /     \\
  /       \\_________/ / \\ \\_____________/       \\
 /         \\        | | | |            /         \\
/___________\\_______| |_| |___________/___________\\
                    \\     /
                     \\___/
`;

const TIE_FIGHTER_ASCII = `
   /|   |\\
  / |   | \\
 |  |   |  |
 |  |[O]|  |
 |  |   |  |
  \\ |   | /
   \\|   |/
`;

const IMPERIAL_CREST = `
      ______
   /        \\
  /  _    _  \\
 |  | |  | |  |
 |  |_|  |_|  |
  \\    __    /
   \\________/
`;

const REBEL_CREST = `
     .   .
      \\ /
    -- O --
      / \\
     '   '
`;

// Helper Components
const StarBackdrop = () => {
  const stars = useMemo(() => Array.from({ length: 150 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: `${Math.random() * 3}px`,
    duration: `${Math.random() * 5 + 5}s`,
    delay: `${Math.random() * 5}s`,
  })), []);

  return (
    <div className="stars-container">
      {stars.map(star => (
        <div 
          key={star.id} 
          className="star" 
          style={{ 
            top: star.top, 
            left: star.left, 
            width: star.size, 
            height: star.size,
            animationDuration: star.duration,
            animationDelay: star.delay
          }} 
        />
      ))}
    </div>
  );
};

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<'HOME' | 'LOBBY' | 'LOADING' | 'QUIZ' | 'FEEDBACK' | 'RESULTS' | 'LEADERBOARD' | 'ADMIN'>('HOME');
  const [playerName, setPlayerName] = useState('');
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [adminPass, setAdminPass] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Load Leaderboard
  const fetchLeaderboard = useCallback((diff: Difficulty) => {
    const key = `sw_archive_${diff.toLowerCase()}`;
    const data = localStorage.getItem(key);
    if (data) {
      const entries = JSON.parse(data) as LeaderboardEntry[];
      setLeaderboard(entries.sort((a, b) => b.score - a.score || a.timeInSeconds - b.timeInSeconds).slice(0, 20));
    } else {
      setLeaderboard([]);
    }
  }, []);

  useEffect(() => {
    if (gameState === 'LEADERBOARD' || gameState === 'HOME') {
      fetchLeaderboard(difficulty);
    }
  }, [gameState, difficulty, fetchLeaderboard]);

  // Quiz Logic
  const startQuiz = async () => {
    if (!playerName || !alignment) return;
    setGameState('LOADING');
    
    try {
      const seenIdsRaw = localStorage.getItem(SESSION_EXCLUSION_KEY);
      const seenIds = seenIdsRaw ? JSON.parse(seenIdsRaw) : [];
      
      const newQuestions = await generateQuizQuestions(difficulty, seenIds);
      setQuestions(newQuestions);
      
      // Update historical seen IDs
      const updatedSeenIds = [...new Set([...newQuestions.map(q => q.id), ...seenIds])].slice(0, MAX_SESSION_HISTORY);
      localStorage.setItem(SESSION_EXCLUSION_KEY, JSON.stringify(updatedSeenIds));

      setCurrentIdx(0);
      setScore(0);
      setStreak(0);
      setMaxStreak(0);
      setStartTime(Date.now());
      setGameState('QUIZ');
    } catch (error) {
      alert("Failed to hyperjump to questions. Please try again.");
      setGameState('HOME');
    }
  };

  const handleAnswer = (optionIdx: number) => {
    const isCorrect = optionIdx === questions[currentIdx].correctAnswer;
    setLastAnswerCorrect(isCorrect);
    
    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(Math.max(maxStreak, newStreak));
      // Exponential streak bonus
      const points = 100 * (1 + (newStreak * 0.5));
      setScore(prev => Math.round(prev + points));
    } else {
      setStreak(0);
    }
    
    setGameState('FEEDBACK');
  };

  const nextQuestion = () => {
    if (currentIdx < QUESTIONS_PER_RUN - 1) {
      setCurrentIdx(prev => prev + 1);
      setGameState('QUIZ');
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    setFinalTime(duration);
    setGameState('RESULTS');

    // Save to LocalStorage
    const key = `sw_archive_${difficulty.toLowerCase()}`;
    const data = localStorage.getItem(key);
    const entries = data ? JSON.parse(data) : [];
    
    const newEntry = {
      id: crypto.randomUUID(),
      playerName,
      alignment,
      score,
      timeInSeconds: duration,
      maxStreak,
      difficulty,
      timestamp: new Date().toISOString()
    };
    
    const updatedEntries = [...entries, newEntry];
    localStorage.setItem(key, JSON.stringify(updatedEntries));
    fetchLeaderboard(difficulty);
  };

  const resetGame = () => {
    setGameState('HOME');
    setQuestions([]);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
  };

  // Admin Logic
  const handleAdminAuth = () => {
    if (adminPass === ADMIN_PASSWORD) {
      setIsAdminMode(true);
      setGameState('ADMIN');
    } else {
      alert("Encryption code rejected. Intruder alert!");
    }
  };

  const clearLeaderboard = () => {
    if (!window.confirm("Danger: This will wipe the Galactic Archives for this sector. Proceed?")) return;
    const key = `sw_archive_${difficulty.toLowerCase()}`;
    localStorage.removeItem(key);
    fetchLeaderboard(difficulty);
  };

  const importArchive = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        const key = `sw_archive_${difficulty.toLowerCase()}`;
        localStorage.setItem(key, JSON.stringify(data));
        fetchLeaderboard(difficulty);
        alert("Sector data merged successfully.");
      } catch (err) {
        alert("Corrupted data transmission.");
      }
    };
    reader.readAsText(file);
  };

  const exportArchive = () => {
    const data = JSON.stringify(leaderboard, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `galactic_archive_${difficulty.toLowerCase()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      <StarBackdrop />

      {/* Hero Header */}
      <AnimatePresence mode="wait">
        {(gameState === 'HOME' || gameState === 'LOBBY') && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="text-center mb-12"
          >
            <h1 className="text-6xl font-black starwars-yellow italic starwars-glow mb-2 uppercase tracking-tighter">
              Star Wars
            </h1>
            <h2 className="text-2xl font-mono text-white opacity-80 uppercase tracking-widest">
              Master Quiz
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full max-w-5xl rounded-2xl overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {gameState === 'HOME' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 glass flex flex-col items-center"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 w-full">
                <div className="flex flex-col gap-6">
                  <div className="space-y-2">
                    <label className="stat-label">Galactic Identity</label>
                    <input 
                      type="text" 
                      placeholder="Enter Pilot Name..." 
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="stat-label">Difficulty Sector</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                        <button 
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`p-3 rounded-lg border text-xs font-bold transition-all ${difficulty === d ? 'bg-amber-500 text-black border-amber-500' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="stat-label">Choose Your Path</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setAlignment('Jedi')}
                        className={`p-6 rounded-xl border flex flex-col items-center gap-3 transition-all ${alignment === 'Jedi' ? 'jedi-glow bg-blue-500/10' : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'}`}
                      >
                        <Sword className={`w-8 h-8 ${alignment === 'Jedi' ? 'accent-jedi' : 'text-slate-600'}`} />
                        <span className={`font-bold tracking-widest uppercase ${alignment === 'Jedi' ? 'accent-jedi' : 'text-slate-400'}`}>Jedi</span>
                      </button>
                      <button 
                        onClick={() => setAlignment('Sith')}
                        className={`p-6 rounded-xl border flex flex-col items-center gap-3 transition-all ${alignment === 'Sith' ? 'sith-glow bg-red-500/10' : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'}`}
                      >
                        <Skull className={`w-8 h-8 ${alignment === 'Sith' ? 'accent-sith' : 'text-slate-600'}`} />
                        <span className={`font-bold tracking-widest uppercase ${alignment === 'Sith' ? 'accent-sith' : 'text-slate-400'}`}>Sith</span>
                      </button>
                    </div>
                  </div>

                  <button 
                    disabled={!playerName || !alignment}
                    onClick={startQuiz}
                    className="mt-4 galactic-button w-full bg-amber-500 text-black py-4 rounded-lg font-black text-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Launch Mission <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col gap-4 border-l border-white/5 pl-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                      <Trophy className="w-3 h-3 text-amber-500" /> Leaderboard: {difficulty}
                    </h3>
                    <div className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded font-bold">{difficulty.toUpperCase()}</div>
                  </div>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
                      <div key={entry.id} className={`leaderboard-row ${i === 0 ? 'bg-blue-500/10 font-bold' : ''}`}>
                        <div className={`text-[11px] font-mono opacity-50 ${i === 0 ? 'accent-jedi' : ''}`}>{String(i + 1).padStart(2, '0')}</div>
                        <div className={`font-bold truncate pr-2 ${entry.alignment === 'Jedi' ? 'accent-jedi' : 'accent-sith'}`}>{entry.playerName}</div>
                        <div className="text-[12px] font-mono text-right">{entry.score.toLocaleString()}</div>
                        <div className="text-[11px] opacity-50 text-right">x{entry.maxStreak}</div>
                      </div>
                    )) : (
                      <div className="text-center py-20 opacity-30 italic text-sm">Archives empty in this sector...</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-12 flex gap-4">
                <button 
                  onClick={() => {
                    const pass = prompt("Enter Sudo Encryption Code:");
                    if (pass === ADMIN_PASSWORD) {
                      setGameState('ADMIN');
                    } else if (pass !== null) {
                      alert("Encryption code rejected. Intruder alert!");
                    }
                  }}
                  className="text-[10px] uppercase tracking-widest opacity-30 hover:opacity-100 flex items-center gap-2"
                >
                  <Lock className="w-3 h-3" /> System Admin
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'LOADING' && (
            <motion.div 
              key="loading"
              className="p-20 flex flex-col items-center justify-center gap-6"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-yellow-400 animate-pulse" />
                </div>
              </div>
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-yellow-400 animate-pulse">Calculating Hyperjump...</p>
              <p className="text-xs opacity-50 max-w-sm text-center">Consulting the Jedi Archives for the most challenging trivia in the galaxy.</p>
            </motion.div>
          )}

          {gameState === 'QUIZ' && questions.length > 0 && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col md:grid md:grid-cols-[1fr_300px] min-h-[500px] gap-4 p-4"
            >
              <div className="glass jedi-glow p-8 flex flex-col gap-6 relative">
                <div className="absolute top-6 right-6">
                  {streak >= 1 && <div className="streak-badge">STREAK x{streak}</div>}
                </div>
                
                <div className="flex flex-col">
                  <div className={`text-[12px] font-bold mb-2 uppercase tracking-widest ${alignment === 'Jedi' ? 'accent-jedi' : 'accent-sith'}`}>
                    QUESTION {String(currentIdx + 1).padStart(2, '0')} / {QUESTIONS_PER_RUN} • {difficulty.toUpperCase()} MODE
                  </div>
                  <h3 className="text-3xl font-light leading-tight text-white mb-8">{questions[currentIdx].text}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questions[currentIdx].options.map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => handleAnswer(i)}
                      className="glass p-5 hover:bg-white/5 transition-all text-left text-sm font-medium flex items-center gap-3 group"
                    >
                      <span className="opacity-30 font-mono text-[10px]">0{i+1}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="glass p-4 aspect-square flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                  <div className="text-center p-4 relative z-10">
                    <div className="stat-label mb-2">Visual Feed</div>
                    <p className="text-[10px] font-mono italic opacity-40 leading-relaxed overflow-hidden line-clamp-6">
                      "{questions[currentIdx].imagePrompt}"
                    </p>
                  </div>
                </div>
                <div className="glass p-5 flex flex-col gap-3">
                  <div className="stat-label flex items-center gap-2">
                    <Timer className="w-3 h-3" /> Audio Descriptor
                  </div>
                  <p className="text-xs italic text-slate-400 leading-relaxed">
                    "{questions[currentIdx].audioDescription}"
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'FEEDBACK' && (
            <motion.div 
              key="feedback"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-12 flex flex-col items-center gap-8 text-center"
            >
              <div className="relative">
                {lastAnswerCorrect ? (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500 shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                  >
                    <CheckCircle2 className="w-10 h-10 accent-jedi" />
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500 shadow-[0_0_20px_rgba(255,0,60,0.2)]"
                  >
                    <XCircle className="w-10 h-10 accent-sith" />
                  </motion.div>
                )}
              </div>

              <div className="space-y-1">
                <h2 className={`text-3xl font-bold uppercase tracking-tight ${lastAnswerCorrect ? 'accent-jedi' : 'accent-sith'}`}>
                  {lastAnswerCorrect ? 'Excellent, Padawan!' : 'Connection Severed...'}
                </h2>
                <div className="stat-label">Correct: {questions[currentIdx].options[questions[currentIdx].correctAnswer]}</div>
              </div>

              <div className="max-w-2xl glass p-8 border-l-4 border-blue-500 relative text-left">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">💡</span>
                  <span className="stat-label !opacity-100 font-bold text-white">Did You Know?</span>
                </div>
                <p className="text-[15px] leading-relaxed text-slate-300 italic">
                  {questions[currentIdx].didYouKnow}
                </p>
              </div>

              <button 
                onClick={nextQuestion}
                className="galactic-button bg-blue-500 text-black py-4 px-12 rounded-lg font-bold flex items-center gap-2 group"
              >
                Continue Mission <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {gameState === 'RESULTS' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 flex flex-col md:grid md:grid-cols-[1fr_320px] gap-8"
            >
              <div className="flex flex-col gap-8">
                <div className="space-y-2">
                  <h2 className="text-5xl font-black uppercase tracking-tighter accent-jedi">Mission Compiled</h2>
                  <p className="stat-label">{playerName} // Rank: {alignment === 'Jedi' ? 'Jedi Grand Master' : 'Sith Emperor'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-6">
                    <div className="stat-label mb-2">Final Score</div>
                    <div className="text-3xl font-bold">{score.toLocaleString()}</div>
                  </div>
                  <div className="glass p-6">
                    <div className="stat-label mb-2">Max Streak</div>
                    <div className="text-3xl font-bold accent-jedi">x{maxStreak}</div>
                  </div>
                  <div className="glass p-6">
                    <div className="stat-label mb-2">Total Time</div>
                    <div className="text-3xl font-bold text-blue-400">{finalTime.toFixed(1)}s</div>
                  </div>
                  <div className="glass p-6">
                    <div className="stat-label mb-2">Difficulty</div>
                    <div className="text-3xl font-bold opacity-80">{difficulty.toUpperCase()}</div>
                  </div>
                </div>

                <div className="mt-auto">
                  <button 
                    onClick={resetGame}
                    className="galactic-button w-full bg-white text-black py-4 rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Retester Protocol
                  </button>
                </div>
              </div>

              <div className="glass flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <span className="stat-label">Galactic Passport</span>
                  {alignment === 'Jedi' ? <div className="accent-jedi"><Shield className="w-4 h-4" /></div> : <div className="accent-sith"><Skull className="w-4 h-4" /></div>}
                </div>
                <div className={`p-8 flex-1 flex flex-col items-center justify-center gap-6 ${alignment === 'Jedi' ? 'bg-blue-500/5' : 'bg-red-500/5'}`}>
                   <div className="ascii-art accent-jedi opacity-80 scale-125 my-4">
                     {alignment === 'Jedi' ? X_WING_ASCII : TIE_FIGHTER_ASCII}
                   </div>
                   <div className="text-center w-full">
                      <div className="stat-label mb-2">Identity Verified</div>
                      <h4 className="text-xl font-bold uppercase tracking-tight">{playerName}</h4>
                      <div className="text-[11px] font-mono opacity-50 my-2">---------------------------</div>
                      <p className={`text-[11px] font-bold uppercase tracking-widest ${alignment === 'Jedi' ? 'accent-jedi' : 'accent-sith'}`}>
                        {alignment === 'Jedi' ? 'REBEL ALLIANCE PILOT' : 'IMPERIAL STARFIGHTER CORPS'}
                      </p>
                   </div>
                </div>
                <div className="p-4 bg-white/5 flex gap-2">
                   <button 
                    onClick={() => {
                      const text = `STAR WARS MASTER QUIZ PASSPORT\n\nPilot: ${playerName}\nSide: ${alignment}\nScore: ${score}\nMax Streak: ${maxStreak}\nTime: ${finalTime.toFixed(1)}s\nDifficulty: ${difficulty}\n\n${alignment === 'Jedi' ? X_WING_ASCII : TIE_FIGHTER_ASCII}`;
                      navigator.clipboard.writeText(text);
                      alert("Passport data encrypted to datapad.");
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20 p-3 rounded text-[10px] uppercase font-bold tracking-widest transition-colors"
                   >
                     Copy Badge
                   </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'ADMIN' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 flex flex-col gap-8"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-400 text-black rounded-lg">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Imperial Command Sudo</h2>
                    <p className="text-xs opacity-50 uppercase tracking-widest">Galactic Archive Management Protocol</p>
                  </div>
                </div>
                <button 
                  onClick={() => setGameState('HOME')}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-red-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="glass p-6">
                     <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><Trash2 className="w-4 h-4 accent-sith" /> Purge Sector</h3>
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs">
                           <span className="opacity-50">Target Diff:</span>
                           <select 
                            className="bg-black border border-white/20 rounded px-2 py-1 text-white"
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                           >
                             <option value="Easy">Easy</option>
                             <option value="Medium">Medium</option>
                             <option value="Hard">Hard</option>
                           </select>
                        </div>
                        <button 
                          onClick={clearLeaderboard}
                          className="w-full py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                        >
                          Wipe Selected Leaderboard
                        </button>
                        <button 
                          onClick={() => {
                            localStorage.removeItem(SESSION_EXCLUSION_KEY);
                            alert("Memory banks cleared.");
                          }}
                          className="w-full py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-colors"
                        >
                          Reset Question Memory
                        </button>
                     </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="glass p-6">
                     <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><Download className="w-4 h-4 accent-jedi" /> Archive Export/Import</h3>
                     <p className="text-xs opacity-50 mb-4 leading-relaxed italic">Download or upload the tactical JSON archive for this sector.</p>
                     <div className="flex flex-col gap-2">
                        <button 
                            onClick={exportArchive}
                            className="w-full py-3 bg-blue-500 text-black rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-400"
                          >
                            Export Sector Data
                          </button>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept=".json" 
                            onChange={importArchive}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <button className="w-full py-3 bg-white/10 text-white border border-white/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/20 flex items-center justify-center gap-2">
                            <Upload className="w-3 h-3" /> Import Sector Data
                          </button>
                        </div>
                     </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/5 opacity-30 italic text-[10px] text-center">
                <span className="admin-tag mr-2 uppercase">SUDO_MODE: ACTIVE</span>
                Protocol v2.4.0-stable // Binary Load: [COMPLETE]
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="mt-8 text-[10px] uppercase tracking-[0.3em] opacity-30 text-center font-bold">
        Intergalactic Data Transmission System // Powered by Google AI
      </footer>
    </div>
  );
}
