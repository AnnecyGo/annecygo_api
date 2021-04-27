var webSocketsServerPort = 1330; 

var webSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {});
server.listen(webSocketsServerPort, function() {
  console.log("Server is listening on port " + webSocketsServerPort);
});

var wsServer = new webSocketServer({
  httpServer: server
});

var playersList = [];
var roomsList = [];

class Room {
    constructor() {
        this.code = generateRoomToken();
        this.playersList = [];
    }

    get playerList() {
        return this.playersList
    }

    addPlayer(player) {
        this.playersList.push(player)
    }
}

class Player {
    constructor(id, connection) {
        this.id = id;
        this.connection = connection;
        this.name = "";
        this.roomCode = "";
    }
}

wsServer.on('request', function(request) {

    console.log("request")

    var player = new Player(request.key, connection);
    var connection = request.accept(null, request.origin); 

    connection.sendUTF(JSON.stringify({action: 'connect', data: player.id}));

    connection.on('message', function(data) {

        console.log('message')
        var message = JSON.parse(data.utf8Data);

        switch(message.action){

            case 'join':
                player.name = message.data;
                BroadcastPlayersList();
                break;

            case 'createNewGame':
                // Create new player
                let nPlayer = newPlayer(player, message, connection)
                // Create new room
                let room = createNewRoom()
                // Add player to room
                addPlayerToRoom(room, nPlayer)
                // generate QR Code
                generateQRCODE(nPlayer)
                // Broadcast all players room
                BroadcastRoom(room.code)
                break;
            
        
            case 'resign':
                console.log('resigned');
                Players[player.opponentIndex]
                    .connection
                    .sendUTF(JSON.stringify({'action':'resigned'}));

                setTimeout(function(){
                    Players[player.opponentIndex].opponentIndex = player.opponentIndex = null;
                }, 0);
                break;


            case 'new_game':
                player.setOpponent(message.data);
                Players[player.opponentIndex]
                    .connection
                    .sendUTF(JSON.stringify({'action':'new_game', 'data': player.name}));
                break;

            case 'play':
                Players[player.opponentIndex]
                    .connection
                    .sendUTF(JSON.stringify({'action':'play', 'data': message.data}));
                break;
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
    // We need to remove the corresponding player
    // TODO
    });
});

// create new room
function createNewRoom() {
    let room = new Room()
    roomsList.push(room)
    return room
}

function addPlayerToRoom(room, player) {
    room.addPlayer(player)
    player.roomCode = room.code
}

// create new player
function newPlayer(player, message, connection) {
    player.name = message.data
    player.connection = connection
    console.log('nouveau joueur: ' + player.name)
    playersList.push(player)
    return player
}

function generateQRCODE(player) {
    var message = JSON.stringify({'action': 'generate_qr','data': {'code': player.roomCode }});
    player.connection.sendUTF(message);
}

// broadcast to players room
function BroadcastRoom(code) {
    let room = getRoom(code)

    var playersId = []

    for(let player of room.playersList) {
        playersId.push({"name": player.name});
    }

    var message = JSON.stringify({'action': 'players_list','data': playersId});

    for(let player of room.playersList) {
        console.log("send to " + player.name)
        console.log(player)
        player.connection.sendUTF(message);
    }
}

function getRoom(code) {
    for(let room of roomsList) {
        if(room.code == code) {
            return room
        }
    }
}
/*
// broadcast all players playersList
function BroadcastPlayersList(){

    var playersId = []

    for(let player of playersList) {
        playersId.push(player.getId());
    }

    for(let player of playersList) {
        var message = JSON.stringify({
            'action': 'players_list',
            'data': playersId
        });
    }

    for(let player of playersList) {
        console.log("send to " + player.name)
        player.connection.sendUTF(message);
    }
}
*/
function generateRoomToken() {
    var firstPart = (Math.random() * 46656) | 0;
    var secondPart = (Math.random() * 46656) | 0;
    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
}