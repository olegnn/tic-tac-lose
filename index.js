

const STATES = {
  X_TURN: 0,
  O_TURN: 1,
  X_WIN: 2,
  O_WIN: 3,
  DRAW: 4,
};

const WIN_POS = [
  0b111000000,
  0b000111000,
  0b000000111,
  0b100100100,
  0b010010010,
  0b001001001,
  0b100010001,
  0b001010100,
];

const CORNER_MOVES = [256, 64, 4, 1];

const ROW_MOVES = [128, 32, 8, 2];

const ROW_TO_CORNER = {
  [ROW_MOVES[0] | ROW_MOVES[1]]: CORNER_MOVES[0],
  [ROW_MOVES[0] | ROW_MOVES[2]]: CORNER_MOVES[1],
  [ROW_MOVES[3] | ROW_MOVES[1]]: CORNER_MOVES[2],
  [ROW_MOVES[3] | ROW_MOVES[2]]: CORNER_MOVES[3],
};

const BASE_STATE = 0b111111111;

const applyValueWithBitMask = (value, newValue, mask) => {
  return (value & ~mask) | newValue;
};

const reduceBitArray = (arr) => arr.reduce((acc, diff) => acc | diff, 0);

const ALL_CORNER_MOVES = reduceBitArray(CORNER_MOVES);

const ALL_ROW_MOVES = reduceBitArray(ROW_MOVES);

class Message {
  constructor() {
    this.element = document.createElement("p");
    this.messages = [
      "X player's turn",
      "O player's turn",
      "X is a winner",
      "O is a winner",
      "Draw",
    ];
  }

  showState(state) {
    this.setMessage(this.messages[state.getGameState()]);
  }

  setMessage(message) {
    this.element.innerText = message;
  }

  appendTo(element) {
    element.appendChild(this.element);
  }
}

// [[0,0,0],[1,0,1],[0,0,0]] => 000101000

// 3 bits per state
// 9 bits per O player
// 9 bits per X player

class State {
  constructor() {
    this.value = 0;
  }

  setGameState(state) {
    this.value = applyValueWithBitMask(this.value, state << 18, 0b111 << 18);
  }

  getGameState() {
    //console.log((this.value & (0b11 << 18)).toString(2));
    return (this.value & (0b111 << 18)) >> 18;
  }

  setOplayer(state) {
    this.value = applyValueWithBitMask(this.value, state << 9, BASE_STATE << 9);
  }

  setXPlayer(state) {
    this.value = applyValueWithBitMask(this.value, state, BASE_STATE, 9);
  }

  getXPlayer(state) {
    return this.value & BASE_STATE;
  }

  getOPlayer() {
    return (this.value & (BASE_STATE << 9)) >> 9;
  }

  getBoardState() {
    return this.getXPlayer() | this.getOPlayer();
  }
}

class Field {
  constructor(handler) {
    const table = document.createElement("table");

    for (let i = 0; i < 3; i++) {
      const tr = document.createElement("tr");
      for (let j = 0; j < 3; j++) {
        const td = document.createElement("td");
        td.innerText = " ";
        td.onclick = () => handler({ arr: [i, j] });
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    this.table = table;
  }

  fillTable(xState, oState) {
    for (let i = 0; i < 9; i++) {
      const cell = this.table.children[(i / 3) | 0].children[i % 3];
      if (xState & (1 << (8 - i))) {
        cell.innerText = "X";
      } else if (oState & (1 << (8 - i))) {
        cell.innerText = "O";
      }
    }
  }

  clearTable() {
    for (let i = 0; i < 9; i++) {
      const cell = table.children[(i / 3) | 0][i % 3];
      cell.innerText = " ";
    }
  }

  appendTo(element) {
    element.appendChild(this.table);
  }
}

const getBitCount = (value) => {
  let res = 0;
  while (value) {
    res += value & 1;
    value >>= 1;
  }
  return res;
};

const getWinningMoves = (stateA, stateB) =>
  WIN_POS.map((pos) => {
    const diff = (pos & stateA) ^ pos;
    return { win: pos, diff };
    return { win: pos, diff };
  })
    .filter(({ diff, win }) => (stateA & diff) === 0 && (stateB & win) === 0)
    .sort((a, b) => (getBitCount(a.diff) > getBitCount(b.diff) ? 1 : -1));

const isWinner = (state) => WIN_POS.find((v) => (v & state) === v) !== void 0;

const getLastBit = (value) => {
  let i = 0;
  while ((value & 1) === 0) {
    i++;
  }

  return 1 << i;
};

const isDraw = (state) =>
  state.getBoardState() === 0x1ff ||
  (!getWinningMoves(state.getOPlayer(), state.getXPlayer()).length &&
    !getWinningMoves(state.getXPlayer(), state.getOPlayer()).length);

const makeMoveWithGreaterDiff = (moves, winDiffs, enemyDiffs) => {
  let maxWinDiff = -Infinity,
    maxEnemyDiff = -Infinity,
    minEnemyLens = Infinity,
    res = null;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const winDiff = winDiffs.reduce(
      (acc, diff) => (diff & move ? Math.min(acc, getBitCount(diff)) : acc),
      3
    );
    const enemyDiff = enemyDiffs.reduce(
      (acc, diff) => (diff & move ? Math.min(acc, getBitCount(diff)) : acc),
      3
    );

    const enemyLens = enemyDiffs.filter(
      (diff) => diff & move && getBitCount(diff) === enemyDiff
    ).length;

    // const to2 = (value) => value.toString(2);
    // console.log("MMMM: ", to2(move), winDiff, enemyDiff, enemyLens);

    if (winDiff >= maxWinDiff || maxWinDiff === 1) {
      if (enemyDiff >= maxEnemyDiff || maxWinDiff === 1) {
        if (
          enemyDiff > maxEnemyDiff ||
          enemyLens <= minEnemyLens ||
          maxWinDiff === 1
        ) {
          maxWinDiff = winDiff;
          maxEnemyDiff = enemyDiff;
          minEnemyLens = enemyLens;
          res = move;
        }
      }
    }
  }

  return res;
};

const makeMove = (state) => {
  const gameState = state.getGameState();
  const xState = state.getXPlayer();
  const oState = state.getOPlayer();
  const boardState = state.getBoardState();
  const arr = [xState, oState];

  if (!boardState) return 0b010000000;

  if (gameState === STATES.O_TURN) {
    arr.reverse();
  }

  let winningMoves = getWinningMoves(...arr)
    .map(({ diff }) => diff)
    .filter((diff) => getBitCount(diff) < 3);
  let enemyMoves = getWinningMoves(...[...arr].reverse())
    .map(({ diff }) => diff)
    .filter((diff) => getBitCount(diff) < 3);

  console.log(
    gameState,
    STATES.X_TURN,
    getBitCount(arr[1]),
    ALL_ROW_MOVES & arr[1]
  );

  if (
    gameState === STATES.X_TURN &&
    getBitCount(arr[1]) === 1 &&
    ALL_ROW_MOVES & arr[1]
  ) {
    const move = ROW_MOVES[ROW_MOVES.length - 1 - ROW_MOVES.indexOf(arr[1])];
    console.log(move);
    if ((move & boardState) === 0) return move;
  }

  if (
    (ALL_ROW_MOVES & arr[1]) === arr[1] &&
    gameState === STATES.O_MOVE &&
    getBitCount(arr[1]) === 2
  ) {
    const cornerMove = ROW_TO_CORNER[arr[1]];
    if (cornerMove) {
      return cornerMove;
    }
  }
  if (
    gameState === STATES.O_MOVE &&
    getBitCount(arr[1]) === 2 &&
    ALL_ROW_MOVES & arr[1] &&
    ALL_CORNER_MOVES & arr[1]
  ) {
    if (
      ROW_MOVES.indexOf(ALL_ROW_MOVES & arr[1]) <=
      CORNER_MOVES.indexOf(ALL_CORNER_MOVES & arr[1])
    ) {
      const move =
        CORNER_MOVES[
          CORNER_MOVES.length -
            1 -
            CORNER_MOVES.indexOf(ALL_CORNER_MOVES & arr[1])
        ];
      if ((move & boardState) === 0) return move;
    }
  }

  let diffBitLimit = 3,
    possibleNotEnemy = [],
    possibleNotWins = [],
    filteredWinningMoves = winningMoves,
    filteredEnemyMoves = enemyMoves,
    res = null;

  for (;;) {
    filteredWinningMoves = filteredWinningMoves.filter(
      (diff) => getBitCount(diff) < diffBitLimit
    );
    filteredEnemyMoves = enemyMoves.filter(
      (diff) => getBitCount(diff) < diffBitLimit
    );
    const allEnemyMoves = reduceBitArray(filteredEnemyMoves);
    const allWinningMoves = reduceBitArray(filteredWinningMoves);

    let b = 0x100;
    while (b) {
      if ((boardState & b) === 0) {
        const notEnemyWin = (allEnemyMoves & b) === 0;
        const notWinMove = (allWinningMoves & b) === 0;

        if (notEnemyWin) {
          possibleNotEnemy.push(b);
        } else if (notWinMove) {
          possibleNotWins.push(b);
        }
      }
      b >>= 1;
    }

    if (!res && !possibleNotEnemy.length && !possibleNotWins.length) {
      diffBitLimit--;
    } else {
      break;
    }
  }

  return (
    res ||
    makeMoveWithGreaterDiff(
      possibleNotEnemy.concat(possibleNotWins),
      winningMoves,
      enemyMoves
    )
  );
};

class Game {
  constructor(players, headerMessage = "", delay = 500) {
    const invalidPlayer = players.find((v) => v !== 0 && v !== 1);
    if (invalidPlayer) throw new Error(`Unknown player: ${invalidPlayer}`);
    this.state = new State();
    this.field = new Field((move) => this.nextMove(move));
    this.message = new Message();
    this.header = new Message();
    this.headerMessage = headerMessage;
    this.delay = delay;

    this.players = players;
  }

  appendTo(element) {
    const div = document.createElement("div");
    this.header.appendTo(div);
    this.message.appendTo(div);
    this.field.appendTo(div);
    this.header.setMessage(
      this.players.length
        ? `Computer plays as player ${this.players.map(
            (player) => (player === 0 ? "X" : "O")
          )}.${this.headerMessage ? ` ${this.headerMessage}` : ""}`
        : this.headerMessage
    );
    element.appendChild(div);
  }

  start() {
    this.message.showState(this.state);
    if (this.players.includes(this.state.getGameState())) {
      this.playNextMove();
    }
  }

  checkState() {
    if (isWinner(this.state.getXPlayer())) {
      this.state.setGameState(STATES.X_WIN);
    } else if (isWinner(this.state.getOPlayer())) {
      this.state.setGameState(STATES.O_WIN);
    } else if (isDraw(this.state)) {
      this.state.setGameState(STATES.DRAW);
    } else {
      this.state.setGameState(+!this.state.getGameState());
    }
  }

  nextMove({ val, arr }) {
    if (this.state.getGameState() >= STATES.X_WIN) return;
    const playerState = this.state.getBoardState();
    const moveBit = val != null ? val : (0x100 >> (arr[0] * 3)) >> arr[1];
    if (playerState & moveBit) {
      return;
    } else {
      const prevX = this.state.getXPlayer(),
        prevO = this.state.getOPlayer();
      switch (this.state.getGameState()) {
        case STATES.X_TURN:
          this.state.setXPlayer(this.state.getXPlayer() | moveBit);
          break;
        case STATES.O_TURN:
          this.state.setOplayer(this.state.getOPlayer() | moveBit);
      }
      this.checkState();
      this.field.fillTable(
        prevX ^ this.state.getXPlayer(),
        prevO ^ this.state.getOPlayer()
      );
      if (this.state.getGameState() < STATES.X_WIN) {
        setTimeout(() => {
          if (this.players.includes(this.state.getGameState())) {
            this.playNextMove();
          }
        }, 0 && this.delay);
      }
      this.message.showState(this.state);
    }
  }

  playNextMove() {
    if (this.state.getGameState() < STATES.X_WIN) {
      const move = makeMove(this.state);
      this.nextMove({ val: move });
    }
  }
}

window.onload = () => {
  const messages = [
    "Always loses to player.",
    "Most of times loses to player.",
  ];
  for (let i = 1; i > -1; i--) {
    const game = new Game([i], messages[1 - i]);
    game.appendTo(document.body);
    game.start();
  }
};
