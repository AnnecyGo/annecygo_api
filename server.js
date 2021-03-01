const { randomInt } = require("crypto");
const express = require("express")
const app = express()
const fs = require('fs');

let monuments = JSON.parse(fs.readFileSync('monuments.json'));
let annecyMonuments = JSON.parse(fs.readFileSync('annecy.json'));

app.get("/randomMonuments", (req, res) => {
    getRandomMonument(monuments, res)
})

app.get("/annecyRandomMonuments", (req, res) => {
    getRandomMonument(annecyMonuments, res)
})

function getRandomMonument(monuments, res) {
    generateAnnecyMonuments()
    var monumentsLength = Object.keys(monuments).length;
    var results = []
    var inside = []
    let count = 0

    var test = []

    while(count < 3) {
        let randomInt;
        do {
            randomInt = getRandomInt(monumentsLength)
        } while(inside.includes(monuments[randomInt].geometry.coordinates[0]))
        inside.push(monuments[randomInt].geometry.coordinates[0])
        test.push(monuments[randomInt].geometry.coordinates[0])
        results.push(monuments[randomInt])     
        count ++   
    }

    console.log(test);

    res.json(results)
}

function generateAnnecyMonuments() {
    let annecy = []
    for(let mon of monuments) {
        if(mon.fields.commune == "Annecy" && mon.geometry != undefined) {
            annecy.push(mon)
        }
    }

    let annecyContent = JSON.stringify(annecy);
    fs.writeFile('./annecy.json', annecyContent, function (err) {
        if (err) throw err;
    });
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

app.listen(1331)
