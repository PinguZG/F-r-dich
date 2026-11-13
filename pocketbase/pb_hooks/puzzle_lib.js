// Stufen für wir_puzzle.pb.js (Route-Handler sehen keine äußeren Konstanten, daher per require).
const PZ = {
  easy: { cols: 3, rows: 4, tol: 0.6, coins: 10 }, mid: { cols: 6, rows: 8, tol: 0.45, coins: 20 },
  hard: { cols: 10, rows: 15, tol: 0.3, coins: 35 }, pro: { cols: 15, rows: 20, tol: 0.2, coins: 60 },
};
const HINT_COST = 5;
module.exports = { PZ, HINT_COST };
