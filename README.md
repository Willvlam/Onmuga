# Onmuga
Play with friends — simple multiplayer games you can run on Replit.

This project includes:

- Tic-Tac-Toe (2 players)
- Connect Four (2 players)
- Draw It Out (multiplayer drawing & guessing)

Notes:
- Draw It Out supports up to **8 players** per room; other games remain 2-player.

Replay feature:

- Every game now has a **Replay** button in the UI that resets the current room's game state so you can start a fresh round.

How Draw It Out works:

- Create a `Draw It Out` room and share the room code.
- When at least two players join, one player is chosen as the drawer and shown a secret word.
- The drawer draws on the canvas while others type guesses; correct guesses end the round.
- Any player can click `New Round` to rotate the drawer and start a new word.

Run locally:

1. Install dependencies: `npm install`
2. Start: `npm start`
3. Visit `http://localhost:3000` and create a room or join with a friend.

Run on Replit:

1. Create a new Replit and import this repository.
2. Replit will run `npm start` automatically (or set the Run command to `node server.js`).
3. Open the webview and share the room code with a friend.

Share feedback or request more games and I'll add them.
