var socket = io()

document.addEventListener('DOMContentLoaded', () => {

    var onlineRooms = document.querySelector('.onlineRooms')
    var onlinePlayers = document.querySelector('.onlinePlayers')
    var questionsDiv = document.querySelector('.questions')

    socket.emit('reloadQuestions', null)

    socket.on('reloadQuestions', (data) => {
        questionsDiv.innerHTML = ""
        console.log(data)
        for(let i = 0; i < data.length; i++) {
            let content = _("div", questionsDiv, null, null, "deleteContent")
            let remove = _("p", content, "x", null, "removeQuestion")
            remove.setAttribute("id", i)
            _("p", content, data[i].question)

            remove.addEventListener('click', () => {
                socket.emit("removeQuestion", i)
            })
        }
    })

    setInterval(() => {
        socket.emit('getAllRooms', null)
    }, 1000)

    socket.on('getAllRooms', (data) => {
        onlineRooms.innerHTML = data.rooms
        onlinePlayers.innerHTML = data.players
    })

    document.querySelector('.formAdd').addEventListener('click', () => {
        let question = document.querySelector('.formQuestion')
        let radio = document.querySelector('.radioContent input:checked')
        let comment = document.querySelector('.formComment')

        if(question.value != "" && comment.value != "" && radio.value != "") {
            socket.emit("addQuestion", {"question": question.value, "answer": radio.value , "comment": comment.value})
        }
    })
})

function _(tag, parent, text=null,  id=null, classs=null) {
	let element = document.createElement(tag)
	if (text)
		element.appendChild(document.createTextNode(text))
	parent.appendChild(element)
	if (id)
		element.id = id
	if (classs)
		element.classList.add(classs)
	return element
}