var webSocketsServerPort = 1222; 

var webSocketServer = require('websocket').server;
var http = require('http');
const axios = require('axios').default

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
    constructor(data, code = null) {
        if(code == null) {
            this.code = generateRoomToken();
        } else {
            this.code = code
        }
        this.playersList = [];
        this.randomMonuments = data;
        this.finishArray = [];
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
        this.admin = false;
        this.score = 0;
        this.avatar = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/OOjs_UI_icon_userAvatar-constructive.svg/1200px-OOjs_UI_icon_userAvatar-constructive.svg.png";
        this.position = [0,0]
    }
}

/*
var testRoom = new Room("room01")
roomsList.push(testRoom)
var playerOne = new Player("A123", null)
playerOne.name = "PlayerOne"
addPlayerToRoom(testRoom, playerOne)
console.log(roomsList)
*/

wsServer.on('request', function(request) {

    var player = new Player(request.key, connection);
    var connection = request.accept(null, request.origin); 

    connection.sendUTF(JSON.stringify({action: 'connect', data: player.id}));

    connection.on('message', function(data) {
        var message = JSON.parse(data.utf8Data);

        switch(message.action){

            case 'createNewGame':
                // Create new player
                let nPlayer = newPlayer(player, message.data, connection)
                nPlayer.admin = true
                savePlayer(nPlayer)

                createNewRoom().then((room) => {
                    // console.log(room)
                    // Add player to room
                    addPlayerToRoom(room, nPlayer)
                    // generate QR Code
                    generateQRCODE(nPlayer)
                    // Broadcast all players room
                    sendPlayersList(room.code)
                    // console.log(room)
                    sendMonuments(room.code)
                })

                break;

            case 'joinGame':
                
                // console.log(message)
                let resRoom = getRoom(message.data.code)
               // let resRoom = getRoom("room01")
                if(resRoom) {
                    let nPlayer = newPlayer(player, message.data.name, connection)
                    addPlayerToRoom(resRoom, nPlayer)

                    var message = JSON.stringify({'action': 'roomFound','data': nPlayer.name});

                    if(nPlayer.connection != null) {
                        savePlayer(nPlayer)
                        nPlayer.connection.sendUTF(message);
                    }

                    sendPlayersList(resRoom.code)
                    // console.log(resRoom)
                } else {
                    console.log("no room found")
                }
                break;

            case 'getPlayerList': 
                if(message.data != null) {
                    sendPlayersList(getRoom(message.data).code)
                }
                break;

            case 'getRoom':
                if(message.data != null) {
                    sendMonuments(getRoom(message.data).code)
                }
                break;

            case 'startGame': 
                if(message.data != null) {
                    let gRoom = getRoom(message.data)
                    setFinishArray(gRoom)
                    startAllPlayerGame(gRoom)
                }
                break;

            case "newGPSPosition":
                //console.log(message.data)
                refreshPlayerPosition(getRoom(message.data.code), message.data.player, message.data.position)
                break;
        }
    });

    connection.on('close', function(connection) {
        console.log("disconnected")
    // TODO
    });
});

function setFinishArray(room) {
    for(let i = 0; i < room.playerList.length; i++) {

        let actualPlayer = room.playerList[i]
        room.finishArray[actualPlayer.id] = []
        let pMon = room.finishArray[actualPlayer.id]

        for(let j = 0; j < room.randomMonuments.length; j++) {
            let actualMon = room.randomMonuments[j]
            pMon[actualMon.recordid] = false
        }
    }
}

function refreshPlayerPosition(room, player, position) {

    for(let rPlayer of room.playersList) {
        if(rPlayer.id == player) {
            rPlayer.position = [position.latitude, position.longitude]
        }
    }

    var message = JSON.stringify({'action': 'refreshPlayerPost','data': room.randomMonuments});

    sendPlayersPosition(room.playersList)
}

function sendPlayersPosition(playersList) {
    var posList = []

    for(let player of playersList) {
        posList.push({"name": player.name, "id": player.id, "position": player.position});
    }

    var message = JSON.stringify({'action': 'refreshPlayersPosition','data': posList});

    for(let player of playersList) {
        if(player.connection != null) {
            player.connection.sendUTF(message);
        }
    }
}

function getRoom(code) {
    for(let room of roomsList) {
        if(room.code == code) {
            return room
        }
    }
}

// create new room
async function  createNewRoom() {
    try {
        let res = await axios.get('http://86.200.111.40:1332/annecyRandomMonuments')
        let room = new Room(res.data)
        roomsList.push(room)
        return room
    } catch (err) {
        console.error(err);
    }
}

function addPlayerToRoom(room, player) {
    room.addPlayer(player)
    player.roomCode = room.code
    
    if(player.connection != null) {
        player.connection.sendUTF(JSON.stringify({action: 'joinRoom', code: room.code}));
    }
}

// create new player
function newPlayer(player, name, connection) {
    player.name = name
    player.connection = connection
    console.log('nouveau joueur: ' + player.name)
    playersList.push(player)
    return player
}

function generateQRCODE(player) {
    var message = JSON.stringify({'action': 'generate_qr','data': {'code': player.roomCode }});
    player.connection.sendUTF(message);
}

function savePlayer(player) {
    var playerJson = {"name": player.name, "admin": player.admin, "id": player.id, "avatar": player.avatar}
    var message = JSON.stringify({'action': 'savePlayer','data': playerJson});

    console.log("player " + player.name + " saved")
    if(player.connection != null) {
        player.connection.sendUTF(message);
    }
}

function sendMonuments(code) {
    console.log("send monuments")
    let room = getRoom(code)

    var message = JSON.stringify({'action': 'saveRoom','data': room.randomMonuments});

    for(let player of room.playersList) {
        if(player.connection != null) {
            player.connection.sendUTF(message);
        }
    }
}

function sendPlayersList(code) {
    let room = getRoom(code)

    var playersId = []

    for(let player of room.playersList) {
        playersId.push({"name": player.name, "admin": player.admin, "id": player.id, "score": player.score});
    }

    var message = JSON.stringify({'action': 'players_list','data': playersId});

    for(let player of room.playersList) {
        console.log("send to " + player.name + " // room: " + code)
        if(player.connection != null) {
            player.connection.sendUTF(message);
        }
    }
}

function startAllPlayerGame(room) {
    for(let player of room.playerList) {
        if(player.connection != null) {
            var message = JSON.stringify({'action': 'startGame','data': null});
            player.connection.sendUTF(message);
        }
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