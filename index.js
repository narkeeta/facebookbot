'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const schedule = require('node-schedule')
const fs = require('fs')
const links =  JSON.parse(fs.readFileSync('links.json', 'utf8'))
const users =  JSON.parse(fs.readFileSync('users.json', 'utf8'))
const app = express()


app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: false
}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
	let cities = [];
	for (var key in links) {
		if (links.hasOwnProperty(key)) {
			cities.push(key);
		}
	}
	res.send(links['Lincoln'][1]);
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === '2347234dds772347234') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function () {
	console.log('running on port', app.get('port'))
})

//
//
// A majority of the bot code here
//
//

app.post('/webhook/', function (req, res) {
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = req.body.entry[0].messaging[i];
		let sender = event.sender.id;
		if (event.message && event.message.text) {
			let text = event.message.text;
			let payload = event.message.quick_reply.payload;
			if (links.hasOwnProperty(text)) {
				if (payload === 'CITY_GIVEN') {
					askCityEvents(sender, text)
				}
				continue
			}
			if (links.hasOwnProperty(payload)) {
				for (event in links.payload) {
					if (links.payload.hasOwnProperty(event)) {
						if (links.payload.event.name === text) {
							sendTextMessage(sender, "Awesome we'll remind you soon to get a ticket for that event!")
						}
					}
				}
			}
			else {
				sendStarterButtons(sender)
			}
		}
		if (event.postback) {
			let text = JSON.stringify(event.postback)
			sendTextMessage(sender, "Postback received: " + text.substring(0, 200), token)
			continue
		}
	}
	res.sendStatus(200)
})
const token = process.env.FB_PAGE_ACCESS_TOKEN

//
//
// THESE ARE THE MESSAGE FUNCTIONS
//
//

function sendTextMessage(sender, text) {
	let messageData = {
		text: text
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {
			access_token: token
		},
		method: 'POST',
		json: {
			recipient: {
				id: sender
			},
			message: messageData,
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function askCityEvents(sender, city) {
	let messageData = {
		"text":"What club events in "+city+" would you like me to remind you for? 🙌🙌",
		"quick_replies":[]
	}
	for(var i = 0; i < links[city].length; i++) {
		if (users.hasOwnProperty(sender)) {
			if (users.sender.hasOwnProperty(city)) {
				if (users.sender.city.indexOf(links[city][i].name) !== -1) {
				}
				else {
					var obj = {
						"content_type":"text",
						"title":links[city][i].name,
						"payload":"USER_EVENT_"+city+"_" + links[city][i].name
					};
					messageData.quick_replies[i] = obj;	
				}
			}
		}
		else {
			var obj = {
				"content_type":"text",
				"title":links[city][i].name,
				"payload":city
			};
			messageData.quick_replies[i] = obj;
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {
			access_token: token
		},
		method: 'POST',
		json: {
			recipient: {
				id: sender
			},
			message: messageData,
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendStarterButtons(sender) {
	let messageData = {
		"text":"Hi there🙋 I'm here to make sure you never miss out on an absolutely banging time! 😎 I'll do this by reminding you to buy tickets for your fave events! Let me know what city you're in and let's get onnit 🍻",
		"quick_replies":[]
	}
	for (var key in links) {
		if (links.hasOwnProperty(key)) {
			let obj = {
				"content_type":"text",
				"title":key,
				"payload":"CITY_GIVEN"
			};
			messageData.quick_replies.push(obj);
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {
			access_token: token
		},
		method: 'POST',
		json: {
			recipient: {
				id: sender
			},
			message: messageData,
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}