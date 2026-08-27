# 🌾 PonsHarvest

A cozy on-chain farm game on Robinhood Chain. Plant seeds, grow your farm, level up from 1 → 30, and reach **level 10** to join the reward pool. Your share of the pool scales with your level. Trade levels for **Boost ⚡** to climb the leaderboard.

## Stack
Vite + React + TypeScript.

## Develop
```bash
npm install
npm run dev
```

## Build
```bash
npm run build      # output in dist/
```

## Deploy on Vercel
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## Notes
This is the frontend. Wallet connection is currently a mock (see `src/store.ts` → `connectWallet()`); swap with wagmi/ethers to connect a real wallet. Smart contracts (HarvestGame.sol, BoostCoin.sol) live in a separate repo.
# harvest
