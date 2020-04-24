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

    // Nastavi bit izvedene poteze
    // tileValue - Bitmask, ki nastavi vrednost zadnje izvedene poteze.
    updatePlaysArr(tileValue) {
      this.playsArr += tileValue;
    }

    getPlaysArr() {
      return this.playsArr;
    }

    // Nastavi currentTurn za igralca, ki je na vrsti - osvezi tudi UI.
    setCurrentTurn(turn) {
      this.currentTurn = turn;
      const message = turn ? 'Na vrsti si' : 'Cakam nasprotnika';
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

  // roomId - id sobe kjer se igra odvija
  class Game {
    constructor(roomId) {
      this.roomId = roomId;
      this.board = [];
      this.moves = 0;
    }

    // ustvari polje za igro, doda event listenerje na gumbe
    createGameBoard() {
      function tileClickHandler() {
        const row = parseInt(this.id.split('_')[1][0], 10);
        const col = parseInt(this.id.split('_')[1][1], 10);
        if (!player.getCurrentTurn() || !game) {
          alert('Nisi na vrsti!');
          return;
        }

        if ($(this).prop('disabled')) {
          alert('To polje je ze zasedeno!');
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
    // Odstrani meni, izrise polje in pozdravi igralca
    displayBoard(message) {
      $('.menu').css('display', 'none');
      $('.gameBoard').css('display', 'block');
      $('#userHello').html(message);
      this.createGameBoard();
    }
    /**
     * Osvezi UI
     *
     * @param {string} type tip igralca(X or O)
     * @param {int} row vrstica, kjer je bila izvedena poteza
     * @param {int} col stolpec, kjer je bila izvedena poteza
     * @param {string} tile id kliknjenega tile-a (kvadratka)
     */
    updateBoard(type, row, col, tile) {
      $(`#${tile}`).text(type).prop('disabled', true);
      this.board[row][col] = type;
      this.moves++;
    }

    getRoomId() {
      return this.roomId;
    }

    // poslji update nasprotniku, da se mu osvezi UI
    playTurn(tile) {
      const clickedTile = $(tile).attr('id');

      // Emitaj event da se drugemu igralcu sporoci, da si opravil svojo potezo.
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

      const tieMessage = 'Neodloceno :(';
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

    // Razglasi zamgovalca ce je trenutni client zmagal.
    // Broadcastaj to v sobi, da drugi igralec ve, da je nasprotnik zmagal.
    announceWinner() {
      const message = `${player.getPlayerName()} je zmagal!`;
      socket.emit('gameEnded', {
        room: this.getRoomId(),
        message,
      });
      alert(message);
      location.reload();
    }

    // Koncaj igro ce je drugi igralec zmagal.
    endGame(message) {
      alert(message);
      location.reload();
    }
  }

  // Ustvari novo igro. Emitaj newGame event.
  $('#new').on('click', () => {
    const name = $('#nameNew').val();
    if (!name) {
      alert('Prosim vnesi ime.');
      return;
    }
    socket.emit('createGame', { name });
    player = new Player(name, P1);
  });

  // Pridruzi se obstojeci sobi z vnosom roomId. Emitaj joinGame event.
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

  // Novo igro je ustvaril trenutni client. Osvezi UI in ustvari novi Game var.
  socket.on('newGame', (data) => {
    const message =
      `Pozdravljen, ${data.name}. Nasportnik naj vnese ID:
      ${data.room}. Cakam nasprotnika...`;

    // Ustvari igro za igralca 1
    game = new Game(data.room);
    game.displayBoard(message);
  });

  /**
	 * Ce igralec ustvari igro, bo P1(X) in bo prvi na vrsti.
	 * Ta event se prejme ko se nasprotnik pridruzi v sobo.
	 */
  socket.on('player1', (data) => {
    const message = `Pozdravljen, ${player.getPlayerName()}`;
    $('#userHello').html(message);
    player.setCurrentTurn(true);
  });

  /**
	 * Pridruzitev k igri, zato je igralec P2(O).
	 * Event se prejme, ko se P2 uspesno pridruzi igri.
	 */
  socket.on('player2', (data) => {
    const message = `Pozdravljen, ${data.name}`;

    // Ustvari igro za igralca 2
    game = new Game(data.room);
    game.displayBoard(message);
    player.setCurrentTurn(false);
  });

  /**
	 * Nasprotnik je izvedel potezo. Osvezi UI.
	 * Trenutni igralec je na vrsti.
	 */
  socket.on('turnPlayed', (data) => {
    const row = data.tile.split('_')[1][0];
    const col = data.tile.split('_')[1][1];
    const opponentType = player.getPlayerType() === P1 ? P2 : P1;

    game.updateBoard(opponentType, row, col, data.tile);
    player.setCurrentTurn(true);
  });

  // Ce drugi igralec zmaga, se prejme ta event. Obvesti igralca, da je igra koncana.
  socket.on('gameEnd', (data) => {
    game.endGame(data.message);
    socket.leave(data.room);
  });

  /**
	 * Koncaj igro na bilo katerem err eventu.
	 */
  socket.on('err', (data) => {
    game.endGame(data.message);
  });
}());
