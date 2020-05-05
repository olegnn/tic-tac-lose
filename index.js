const STATES = {
  X_TURN: 0,
  O_TURN: 1,
  X_WIN: 2,
  O_WIN: 3,
  DRAW: 4
};

const WIN_POS = [
  0b111000000,
  0b000111000,
  0b000000111,
  0b100100100,
  0b010010010,
  0b001001001,
  0b100010001,
  0b001010100
];

const CORNER_MOVES = [256, 64, 4, 1];

const ROW_MOVES = [128, 32, 8, 2];

const BASE_STATE = 0b111111111;

const ROW_TO_CORNER = {
  [ROW_MOVES[0] | ROW_MOVES[1]]: CORNER_MOVES[0],
  [ROW_MOVES[0] | ROW_MOVES[2]]: CORNER_MOVES[1],
  [ROW_MOVES[3] | ROW_MOVES[1]]: CORNER_MOVES[2],
  [ROW_MOVES[3] | ROW_MOVES[2]]: CORNER_MOVES[3]
};

const reduceBitArray = arr => arr.reduce((acc, diff) => acc | diff, 0);

const ALL_CORNER_MOVES = reduceBitArray(CORNER_MOVES);

const ALL_ROW_MOVES = reduceBitArray(ROW_MOVES);

const applyValueWithBitMask = (value, newValue, mask) =>
  (value & ~mask) | newValue;

const getBitCount = value => {
  let res = 0;
  while (value) {
    res += value & 1;
    value >>= 1;
  }

  return res;
};

class Message {
  constructor(messages) {
    this.element = document.createElement("p");
    this.messages = [].concat(messages);
  }

  showMessage(index = 0) {
    this.setInnerText(this.messages[index]);
  }

  setInnerText(message) {
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
    return (this.value >> 18) & 0b111;
  }

  setOPlayer(state) {
    this.value = applyValueWithBitMask(this.value, state << 9, BASE_STATE << 9);
  }

  getOPlayer() {
    return (this.value >> 9) & BASE_STATE;
  }

  setXPlayer(state) {
    this.value = applyValueWithBitMask(this.value, state, BASE_STATE, 9);
  }

  getXPlayer(state) {
    return this.value & BASE_STATE;
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
      const cell = this.table.children[(i / 3) | 0].children[i % 3];
      cell.innerText = " ";
    }
  }

  appendTo(element) {
    element.appendChild(this.table);
  }
}

const getWinningMoves = (stateA, stateB) =>
  WIN_POS.map(win => ({ win: win, diff: (win & stateA) ^ win })).filter(
    ({ diff, win }) => (stateA & diff) === 0 && (stateB & win) === 0
  );

const isWinner = stateVal => WIN_POS.some(v => (v & stateVal) === v);

const isDraw = state =>
  state.getBoardState() === 0x1ff ||
  (!getWinningMoves(state.getOPlayer(), state.getXPlayer()).length &&
    !getWinningMoves(state.getXPlayer(), state.getOPlayer()).length);

const chooseMoveWithGreaterDiff = (moves, winDiffs, enemyDiffs) => {
  let maxWinDiff = -Infinity,
    maxEnemyDiff = -Infinity,
    minEnemyLens = Infinity,
    minWinLens = Infinity,
    res = null;

  for (const move of moves) {
    const winDiff = winDiffs.reduce(
      (acc, diff) => (diff & move ? Math.min(acc, getBitCount(diff)) : acc),
      3
    );
    const enemyDiff = enemyDiffs.reduce(
      (acc, diff) => (diff & move ? Math.min(acc, getBitCount(diff)) : acc),
      3
    );

    const winLens = winDiffs.filter(
      diff => diff & move && getBitCount(diff) === winDiff
    ).length;

    const enemyLens = enemyDiffs.filter(
      diff => diff & move && getBitCount(diff) === enemyDiff
    ).length;

    // const to2 = value => value.toString(2);
    // console.log("MOVE: ", to2(move), winDiff, winLens, enemyDiff, enemyLens);

    if (winDiff >= maxWinDiff || maxWinDiff === 1) {
      if (winLens <= minWinLens || winDiff > maxWinDiff || maxWinDiff === 1) {
        if (enemyDiff >= maxEnemyDiff || maxWinDiff === 1) {
          if (
            enemyDiff > maxEnemyDiff ||
            enemyLens <= minEnemyLens ||
            maxWinDiff === 1
          ) {
            maxWinDiff = winDiff;
            maxEnemyDiff = enemyDiff;
            minEnemyLens = enemyLens;
            minWinLens = winLens;
            res = move;
          }
        }
      }
    }
  }

  return res;
};

const makeMove = state => {
  const gameState = state.getGameState();
  const xState = state.getXPlayer();
  const oState = state.getOPlayer();
  const boardState = state.getBoardState();
  const arr = [xState, oState];

  if (!boardState) return 0b010000000;

  if (gameState === STATES.O_TURN) {
    arr.reverse();
  }

  let move;

  if (gameState === STATES.X_TURN) {
    if (ALL_ROW_MOVES & arr[1] && getBitCount(arr[1]) === 1) {
      move = ROW_MOVES[ROW_MOVES.length - 1 - ROW_MOVES.indexOf(arr[1])];
    } else if (
      (ALL_CORNER_MOVES & arr[1]) === arr[1] &&
      (ALL_CORNER_MOVES & arr[0]) === 0
    ) {
      move = CORNER_MOVES.find((v) => (v & boardState) === 0);
    }
  } else {
    if (ALL_ROW_MOVES & arr[1] && getBitCount(arr[1]) === 1) {
      const rowIndex = ROW_MOVES.indexOf(arr[1]);
      if (rowIndex < 1 || rowIndex > 2) {
        move = CORNER_MOVES[CORNER_MOVES.length - 1 - rowIndex];
      } else {
        move = CORNER_MOVES[2 - rowIndex];
      }
    } else if ((ALL_ROW_MOVES & arr[1]) === arr[1] && getBitCount(arr[1]) === 2) {
      const cornerMove = ROW_TO_CORNER[arr[1]];
      if (
        cornerMove != null &&
        !WIN_POS.some(v => getBitCount(v & (arr[0] | cornerMove)) === 2)
      ) {
        move = cornerMove;
      }
    } else if (ALL_ROW_MOVES & arr[1] && ALL_CORNER_MOVES & arr[1] && getBitCount(arr[1]) === 2) {
      const cornerMoveIndex = CORNER_MOVES.length - 1 - CORNER_MOVES.indexOf(arr[0]);
      move = CORNER_MOVES[cornerMoveIndex];
    }
  }

  if (move != null && (boardState & move) === 0) return move;

  const movesLeft = Math.round(getBitCount(~boardState & BASE_STATE) / 2);
  const enemyMovesLeft = getBitCount(~boardState & BASE_STATE) >> 1;
  let diffBitLimit = 3;

  const winningMoves = getWinningMoves(...arr)
    .map(({ diff }) => diff)
    .filter((diff) => {
      const count = getBitCount(diff);
      return count < diffBitLimit && count <= movesLeft;
    });
  const enemyMoves = getWinningMoves(...[...arr].reverse())
    .map(({ diff }) => diff)
    .filter((diff) => {
      const count = getBitCount(diff);
      return count < diffBitLimit && count <= enemyMovesLeft;
    });

  let possibleNotEnemy = [],
    possibleNotWins = [],
    restMoves = [],
    filteredWinningMoves = winningMoves,
    filteredEnemyMoves = enemyMoves;

  for (
    ;
    !possibleNotEnemy.length && !possibleNotWins.length && diffBitLimit;
    diffBitLimit--
  ) {
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
        } else  {
          restMoves.push(b);
        }
      }
      b >>= 1;
    }

    filteredWinningMoves = filteredWinningMoves.filter(
      diff => getBitCount(diff) < diffBitLimit
    );
    filteredEnemyMoves = enemyMoves.filter(
      diff => getBitCount(diff) < diffBitLimit
    );
  }

  const moves = possibleNotEnemy.concat(possibleNotWins);

  return moves.length ? chooseMoveWithGreaterDiff(moves, winningMoves, enemyMoves): restMoves[0];
};

class Game {
  constructor(players, headerMessages = [], delay = 500) {
    players.forEach(v => {
      if (v !== 0 && v !== 1)
        throw new Error(`Unknown player: ${invalidPlayer}`);
    });
    this.state = new State();
    this.field = new Field(move => this.nextMove(move));
    this.message = new Message([
      "X player's turn",
      "O player's turn",
      "X is a winner",
      "O is a winner",
      "Draw"
    ]);
    this.header = new Message(
      []
        .concat(headerMessages)
        .map(
          headerMessage =>
            players.length
              ? `Computer plays as a player ${players.map(
                  player => (player === 0 ? "X" : "O")
                )}.${headerMessage ? ` ${headerMessage}` : ""}`
              : headerMessage
        )
    );
    this.delay = delay;
    this.players = players;
  }

  appendTo(element) {
    const div = document.createElement("div");
    this.header.appendTo(div);
    this.message.appendTo(div);
    this.field.appendTo(div);
    this.header.showMessage();
    element.appendChild(div);
  }

  start() {
    this.message.showMessage(this.state.getGameState());
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
    const boardState = this.state.getBoardState();
    const moveBit = val != null ? val : (0x100 >> (arr[0] * 3)) >> arr[1];
    if (boardState & moveBit) {
      return;
    } else {
      const prevX = this.state.getXPlayer(),
        prevO = this.state.getOPlayer();
      switch (this.state.getGameState()) {
        case STATES.X_TURN:
          this.state.setXPlayer(this.state.getXPlayer() | moveBit);
          break;
        case STATES.O_TURN:
          this.state.setOPlayer(this.state.getOPlayer() | moveBit);
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
        }, this.delay);
      }
      this.message.showMessage(this.state.getGameState());
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
    "Always loses to the player.",
    "Most of times loses to the player."
  ];
  for (let i = 1; i > -1; i--) {
    const game = new Game([i], messages[1 - i], 0);
    game.appendTo(document.body);
    game.start();
  }
};
