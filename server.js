var webSocketsServerPort = 1645; 

let editJsonFile = require("edit-json-file");

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
var questions = [];

let questionsFile = editJsonFile(`${__dirname}/questions.json`);
questions = questionsFile.get("questions")

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
                    //console.log(room)
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
                // console.log(message.data)
                refreshPlayerPosition(getRoom(message.data.code), message.data.player, message.data.position)
                break;

            case "newUserScore":
                // console.log(message.data)
                updateScorePlayer(message.data)
                break;

            case "newMonumentQuizz":
                newMonumentQuizz(message.data)
                break;
            case "validateMonument":
                validateMonument(message.data)
                break;
        }
    });

    connection.on('close', function(connection) {
        console.log("disconnected")
    // TODO
    });
});

function updateScorePlayer(data) {
    let nRoom = getRoom(data.room)
    //console.log(nRoom.finishArray)

    let player = getPlayer(data.room, data.id)
    player.score += getNewScore(data.answer)
    //console.log(nRoom.finishArray)
}


function validateMonument(data) {
    let nRoom = getRoom(data.room)
    let player = getPlayer(data.room, data.id)
    
    nRoom.finishArray[data.id][data.monumentId] = true
}

/**
 * 
 * TODO ADD DETECTION PLAYER GPS // MONUMENT GPS
 */
function newMonumentQuizz(player,monument) {
    let question = questions[getRndInteger(0, questions.length - 1)]

    var monumentJson = {"monumentId": monument.recordid, "quizz": question}

    var message = JSON.stringify({'action': 'newMonumentQuizz','data': monumentJson});

    // console.log(player)
    if(player.connection != null) {
        player.connection.sendUTF(message);
    }
}

function getPlayer(code, id) {
    let room = getRoom(code)
    for(let player of room.playerList) {
        if(player.id == id) {
            return player
        }
    }
}

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

function getNewScore(answer) {
    if(answer) {
        return 100
    }else {
        return 0
    }
}

function refreshPlayerPosition(room, player, position) {
    for(let rPlayer of room.playersList) {
        if(rPlayer.id == player) {
            rPlayer.position = [position.latitude, position.longitude]
            checkDistanceMonuPlayer(rPlayer, room)
        }
    }

    var message = JSON.stringify({'action': 'refreshPlayerPost','data': room.randomMonuments});

    sendPlayersPosition(room.playersList)

}

function checkDistanceMonuPlayer(player, room){
    for(let rMonument of room.randomMonuments) {
       var result = distanceMonuPlayer(rMonument.geometry.coordinates[1],rMonument.geometry.coordinates[0],player.position[0],player.position[1])
       if(result){
        if(!room.finishArray[player.id][rMonument.recordid]){
            //console.log("PAF")
            newMonumentQuizz(player,rMonument)
        }
       }
    }
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

//Comparaison GPS point monument et player
function distanceMonuPlayer(latMonu, lonMonu, latPlayer, lonPlayer) {
    //les calculs sont en miles

	if ((latMonu == latPlayer) && (lonMonu == lonPlayer)) {
		return 0;
	}
	else {
		var radlat1 = Math.PI * latMonu/180
		var radlat2 = Math.PI * latPlayer/180
		var theta = lonMonu-lonPlayer
		var radtheta = Math.PI * theta/180
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta)
		if (dist > 1) {
			dist = 1
		}
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI
		dist = dist * 60 * 1.1515
        //transformation en kilometres
		dist = dist * 1.609344
        if (dist < 0.03 )
            return true

        // console.log("Monument: "+latMonu + " "+ lonMonu)
        // console.log("Player: "+latPlayer + " "+ lonPlayer)
        // console.log(dist)
        return false
	}
}
//---------

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

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

// Node JS

let express = require("express")
let socketio = require("socket.io")

let app = express()
let serverNode = http.Server(app)
let io = socketio(serverNode)


app.use("/css", express.static( __dirname))
app.use("/js", express.static( __dirname))

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html")
})

io.on("connect", (socket) => { 

    socket.on("reloadQuestions", (data) => {
        socket.emit("reloadQuestions", questions)
    })

    socket.on("getAllRooms", (data) => {

        let count = 0

        for(let room of roomsList) {
            count += room.playerList.length
        }

        socket.emit("getAllRooms", {"rooms": roomsList.length, "players": count})
    })

    socket.on("addQuestion", (data) => {
        questionsFile.append("questions", data)
        questionsFile.save()
        //questions = questionsFile.toObject()
        socket.emit("reloadQuestions", questions)
    })

    socket.on("removeQuestion", (nb) => {
        questionsFile.get("questions").splice(nb, 1)
        questionsFile.save()
        socket.emit("reloadQuestions", questions)
    })
})

serverNode.listen(1646)