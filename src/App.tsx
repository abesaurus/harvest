import { useState } from "react";
import { useGame } from "./store";
import Login from "./Login";
import Game from "./Game";

export default function App() {
  const game = useGame();
  // route: show game only after wallet connected AND user chose to enter
  const [entered, setEntered] = useState(false);

  const showGame = game.address && entered;

  return showGame ? (
    <Game onLogout={() => setEntered(false)} />
  ) : (
    <Login onEnter={() => setEntered(true)} />
  );
}
