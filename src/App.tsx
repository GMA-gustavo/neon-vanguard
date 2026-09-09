import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import './App.css';

type Screen = 'loading' | 'title' | 'playing' | 'over';

const HIGH_SCORE_KEY = 'neon-vanguard.highscore';

function readHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function writeHighScore(value: number) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    /* storage may be unavailable (private mode) — ignore */
  }
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);

  const [screen, setScreen] = useState<Screen>('loading');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState<number>(readHighScore);

  useEffect(() => {
    let cancelled = false;
    const game = new Game({
      onScore: setScore,
      onWave: setWave,
      onLives: setLives,
      onGameOver: (finalScore: number) => {
        setHighScore((prev) => {
          const next = Math.max(prev, finalScore);
          if (next !== prev) writeHighScore(next);
          return next;
        });
        setScreen('over');
      },
    });

    game.init(mountRef.current!).then(() => {
      if (cancelled) {
        game.destroy();
        return;
      }
      gameRef.current = game;
      setScreen('title');
    });

    return () => {
      cancelled = true;
      gameRef.current = null;
      game.destroy();
    };
  }, []);

  const startRun = () => {
    setScore(0);
    setWave(1);
    setLives(3);
    gameRef.current?.start();
    setScreen('playing');
  };

  return (
    <div className="app">
      <div className="game-mount" ref={mountRef} />

      {screen === 'playing' && (
        <div className="hud" aria-hidden>
          <div className="hud-item">
            <span className="hud-label">PONTOS</span>
            <span className="hud-value">{score.toLocaleString('pt-BR')}</span>
          </div>
          <div className="hud-item hud-center">
            <span className="hud-label">ONDA</span>
            <span className="hud-value">{wave}</span>
          </div>
          <div className="hud-item hud-right">
            <span className="hud-label">NAVES</span>
            <span className="hud-value hud-lives">{'▲'.repeat(Math.max(0, lives))}</span>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <div className="overlay">
          <p className="loading-text">carregando…</p>
        </div>
      )}

      {screen === 'title' && (
        <div className="overlay">
          <h1 className="title">
            NEON<span className="title-accent">VANGUARD</span>
          </h1>
          <p className="subtitle">Sobreviva às ondas. Suba no ranking.</p>
          <button className="btn" onClick={startRun}>
            INICIAR
          </button>
          <p className="hint">
            Mouse ou <kbd>WASD</kbd>/<kbd>setas</kbd> para mover · tiro automático · no celular, arraste
          </p>
          {highScore > 0 && (
            <p className="record">RECORDE · {highScore.toLocaleString('pt-BR')}</p>
          )}
        </div>
      )}

      {screen === 'over' && (
        <div className="overlay">
          <h2 className="gameover">FIM DE JOGO</h2>
          <p className="final-score">{score.toLocaleString('pt-BR')} pontos</p>
          <p className="record">
            {score >= highScore ? 'NOVO RECORDE! 🏆' : `Recorde · ${highScore.toLocaleString('pt-BR')}`}
          </p>
          <button className="btn" onClick={startRun}>
            JOGAR DE NOVO
          </button>
        </div>
      )}

      <footer className="credit">
        React · TypeScript · PixiJS — por Gustavo Mascarenhas
      </footer>
    </div>
  );
}
