(function init() {
  const P1 = 'X';
  const P2 = 'O';
  let player;
  let game;

  // ustvarimo socket
  const socket = io.connect('http://localhost:5000');

  class Player {
    constructor(name, type) {
      this.name = name;
      this.type = type;
      this.currentTurn = true;
      this.playsArr = 0;
    }

    static get wins() {
      return [7, 56, 448, 73, 146, 292, 273, 84];
    }

    updatePlaysArr(tileValue) {
      this.playsArr += tileValue;
    }

    getPlaysArr() {
      return this.playsArr;
    }

    // Sets currentTurn for player - refreshes the UI.
    setCurrentTurn(turn) {
      this.currentTurn = turn;
      const message = turn ? 'Your turn' : 'Waiting for opponent';
      $('#turn').text(message);
    }

    getPlayerName() {
      return this.name;
    }

    getPlayerType() {
      return this.type;
    }

    getCurrentTurn() {
      return this.currentTurn;
    }
  }

  // roomId - id of the room
  class Game {
    constructor(roomId) {
      this.roomId = roomId;
      this.board = [];
      this.moves = 0;
    }

    // creates the game board, adds event listeners to buttons
    createGameBoard() {
      function tileClickHandler() {
        const row = parseInt(this.id.split('_')[1][0], 10);
        const col = parseInt(this.id.split('_')[1][1], 10);
        if (!player.getCurrentTurn() || !game) {
          alert('Not your turn!');
          return;
        }

        if ($(this).prop('disabled')) {
          alert('Already taken!');
          return;
        }

        // osvezi polje
        game.playTurn(this);
        game.updateBoard(player.getPlayerType(), row, col, this.id);

        player.setCurrentTurn(false);
        player.updatePlaysArr(1 << ((row * 3) + col));

        game.checkWinner();
      }

      for (let i = 0; i < 3; i++) {
        this.board.push(['', '', '']);
        for (let j = 0; j < 3; j++) {
          $(`#button_${i}${j}`).on('click', tileClickHandler);
        }
      }
    }
    // Removes the menu, outputs the game board and says hello to the player
    displayBoard(message) {
      $('.menu').css('display', 'none');
      $('.gameBoard').css('display', 'block');
      $('#userHello').html(message);
      this.createGameBoard();
    }
    /**
     * UI refresh
     *
     * @param {string} type player type (X or O)
     * @param {int} row row in which the move was made
     * @param {int} col column in which the move was made
     * @param {string} tile id of the selected tile (kvadratka)
     */
    updateBoard(type, row, col, tile) {
      $(`#${tile}`).text(type).prop('disabled', true);
      this.board[row][col] = type;
      this.moves++;
    }

    getRoomId() {
      return this.roomId;
    }

    // send update to the opponent to refresh his UI
    playTurn(tile) {
      const clickedTile = $(tile).attr('id');

      // emits the event in lets the other player know you've made your move
      socket.emit('playTurn', {
        tile: clickedTile,
        room: this.getRoomId(),
      });
    }
    /**
     *
     *     273                 84
     *        \               /
     *          1 |   2 |   4  = 7
     *       -----+-----+-----
     *          8 |  16 |  32  = 56
     *       -----+-----+-----
     *         64 | 128 | 256  = 448
     *       =================
     *         73   146   292
     *
     */
    checkWinner() {
      const currentPlayerPositions = player.getPlaysArr();

      Player.wins.forEach((winningPosition) => {
        if ((winningPosition & currentPlayerPositions) === winningPosition) {
          game.announceWinner();
        }
      });

      const tieMessage = 'Draw :(';
      if (this.checkTie()) {
        socket.emit('gameEnded', {
          room: this.getRoomId(),
          message: tieMessage,
        });
        alert(tieMessage);
        location.reload();
      }
    }

    checkTie() {
      return this.moves >= 9;
    }

    // announces the winner of the current client has won
    // broadcasts to the room and let the other player know
    announceWinner() {
      const message = `${player.getPlayerName()} has won!`;
      socket.emit('gameEnded', {
        room: this.getRoomId(),
        message,
      });
      alert(message);
      location.reload();
    }

    // ends the game if the other player has won
    endGame(message) {
      alert(message);
      location.reload();
    }
  }

  // creates new game
  $('#new').on('click', () => {
    const name = $('#nameNew').val();
    if (!name) {
      alert('Prosim vnesi ime.');
      return;
    }
    socket.emit('createGame', { name });
    player = new Player(name, P1);
  });

  // joins a room
  $('#join').on('click', () => {
    const name = $('#nameJoin').val();
    const roomID = $('#room').val();
    if (!name || !roomID) {
      alert('Prosim vnesi svoje ime in ID sobe.');
      return;
    }
    socket.emit('joinGame', { name, room: roomID });
    player = new Player(name, P2);
  });

  socket.on('newGame', (data) => {
    const message =
      `Pozdravljen, ${data.name}. Nasportnik naj vnese ID:
      ${data.room}. Cakam nasprotnika...`;

    // creates game for player 1
    game = new Game(data.room);
    game.displayBoard(message);
  });

  socket.on('player1', (data) => {
    const message = `Pozdravljen, ${player.getPlayerName()}`;
    $('#userHello').html(message);
    player.setCurrentTurn(true);
  });

  socket.on('player2', (data) => {
    const message = `Pozdravljen, ${data.name}`;

    // Ustvari igro za igralca 2
    game = new Game(data.room);
    game.displayBoard(message);
    player.setCurrentTurn(false);
  });

  socket.on('turnPlayed', (data) => {
    const row = data.tile.split('_')[1][0];
    const col = data.tile.split('_')[1][1];
    const opponentType = player.getPlayerType() === P1 ? P2 : P1;

    game.updateBoard(opponentType, row, col, data.tile);
    player.setCurrentTurn(true);
  });

  socket.on('gameEnd', (data) => {
    game.endGame(data.message);
    socket.leave(data.room);
  });

  socket.on('err', (data) => {
    game.endGame(data.message);
  });
}());
