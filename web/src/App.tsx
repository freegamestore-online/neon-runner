import { GameShell, GameTopbar } from "@freegamestore/games";
import { useEffect, useRef, useState } from "react";
import { startGame } from "./game";

// The React layer is thin on purpose: it owns the SDK shell + the score readout,
// and hands a container <div> to Phaser, which creates its own <canvas> inside it
// and owns the game loop, rendering, input and arcade physics. All the game logic
// lives in ./game.ts. Phaser's Scale.FIT keeps the fixed virtual resolution
// letterboxed to whatever size this box is on the device.
export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // startGame returns a teardown fn; run it on unmount so hot-reload / route
    // changes don't leak a second Phaser.Game (and its RAF loop) onto the page.
    const stop = startGame(host, setScore);
    return stop;
  }, []);

  return (
    <GameShell topbar={<GameTopbar title="APPNAME" score={score} />}>
      {/* Phaser injects its <canvas> here and scales it to fill the box. */}
      <div ref={hostRef} className="w-full h-full touch-none" />
    </GameShell>
  );
}
