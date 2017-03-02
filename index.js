'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const schedule = require('node-schedule')
const fs = require('fs')
const links =  JSON.parse(fs.readFileSync('links.json', 'utf8'))
const client = require('redis').createClient(process.env.REDIS_URL)
const app = express()
const token = process.env.FB_PAGE_ACCESS_TOKEN


app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: false
}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
  setmenu();
  var d = new Date();
		var day = d.getDay();
		var hour = d.getHours();
		console.log(day);
		console.log(hour);

		var d = new Date();
		var day = d.getDay();
		var hour = d.getHours();
		console.log(day);
		console.log(hour);
		for (var city in links) {
			for(var event in links[city]) {
				console.log("EVENT:");
				console.log(links[city][event].name);
				console.log("The Day:");
				console.log(links[city][event].day);
				if (links[city][event].day === day) {
                    console.log("match");
					var sendcity = city;
					var sendevent = event;
					client.keys('*', function (err, keys) {
						if (err) return console.log(err);
						var datakeys = keys;
						for(var i = 0, len = datakeys.length; i < len; i++) {
                            var tempi = i;
							var senderid = datakeys[tempi];
							sendmessagesfromlocal(senderid, sendcity, sendevent);
						}
					}); 
				}
			}
		}
		console.log('Time for tea!');
	

	res.send("Up And Running, This app sends out messages to the facbook bot, You just need this to load once to feel free to close it. Have a nice day!");
})

function sendmessagesfromlocal(sendername, sendcity, sendevent) {
	client.smembers(sendername, function(err, reply) {
		console.log(sendername);
        console.log("THE REPLY FOR THAT NAME");
		console.dir(reply);
		let theeventname = sendcity+"-"+links[sendcity][sendevent].name;
		let theeventlink = links[sendcity][sendevent].link;
		
		
		if (reply.indexOf(theeventname) !== -1) {
			if (theeventlink === " ") {
				var message = "Its union day!! Dont forget to buy your "+theeventname+" tickets and have a great time! 😃";
			}
			else {
				var message = "Its union day!! Dont forget to buy your "+theeventname+" tickets! 😃\n\nClick the link to buy tickets "+theeventlink;	
			}
			sendTextMessage(sendername, message);
		}
	});
}
// for Facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
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
			if (event.message.quick_reply && event.message.quick_reply.payload) {
				let payload = event.message.quick_reply.payload;
				if (payload === "user_wants_to_go_home") {
					sendTextMessage(sender, "Fair enough, if you fancy being reminded for more events in the future just come back and select them👌\n Have an amazing night and don't do anything I wouldn't do! 🙈")
					continue
				}
				if (links.hasOwnProperty(text)) {
					if (payload === 'CITY_GIVEN') {
						askCityEvents(sender, text, "I do love a good party in "+text+" 💃💃💃", "What club events in "+text+" would you like me to remind you for? 🙌🙌")
					}
					continue
				}
				if (links.hasOwnProperty(payload)) {
					for (var a = 0; a < links[payload].length; a++) {
						if (links[payload][a].name === text) {
							let days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saterday"];
							let theirday = days[links[payload][a].day];
							client.sadd([sender, payload+"-"+links[payload][a].name ], function(err, reply) {
								console.log(reply); // 3
							});
							askCityEvents(sender, payload, "Fab, I'll remind you "+theirday+" to get a ticket for the "+links[payload][a].name+"  event! 😃", "If you're a true sessioner I'm sure there might be other events I can remind you for?😜");
							break;
						}
					}
					continue
				}
			}
			sendStarterButtons(sender)
		}
		if (event.postback) {
			if (event.postback.payload === "remove_from_database") {
				client.del(sender, function(err, reply) {
					console.log(reply);
					sendTextMessage(sender, "Okay! You've been unsubscribed from our service, I hope you come back and use us later!")
				});
				continue
			}
			if (event.postback.payload === "DEVELOPER_DEFINED_PAYLOAD_FOR_HELP") {
				sendStarterButtons(sender);
				continue
			}
			continue
		}
	}
	res.sendStatus(200)
})


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

function askCityEvents(sender, city, first, second) {
	let messageDataFirst = {
		"text":first,
	}
	let messageData = {
		"text":second,
		"quick_replies":[
			{
				"content_type":"text",
				"title":'No Thanks',
				"payload":'user_wants_to_go_home'
			}

		]
	}


	client.exists(sender, function(err, reply) {
		if (reply === 1) {
			client.smembers(sender, function(err, thedata) {
				console.log("client found sorting links");
				for(var i = 0; i < links[city].length; i++) {
					console.log(links[city][i]);
					console.log(thedata);
					if (thedata.indexOf(city+"-"+links[city][i].name) === -1) {
						let obj = {
							"content_type":"text",
							"title":links[city][i].name,
							"payload":city
						};
						messageData.quick_replies.push(obj);
					}
				}
				if (messageData.quick_replies.length === 1) {
					messageData.text = "Wow! It looks like you've signed up for all the "+city+" events already! 🙌🙌 You can click another city below, otherwise I'll hit you up the day of your events!";
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
				}
			});
		} else {
			console.log("client not found sorting links");
			for(var i = 0; i < links[city].length; i++) {
				let obj = {
					"content_type":"text",
					"title":links[city][i].name,
					"payload":city
				};
				messageData.quick_replies[i] = obj;	
			}
		}
	});
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
			message: messageDataFirst,
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
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


	})

}

function askCityEventsTwo(sender, city, first) {
	let messageDataFirst = {
		"text":first,
	}
	let messageData = {
		"text":"If you're a true sessioner I'm sure there might be other events I can remind you for?😜",
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
			message: messageDataFirst,
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
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

function setmenu() {
	request({
		url: 'https://graph.facebook.com/v2.6/me/thread_settings',
		qs: {
			access_token: token
		},
		method: 'POST',
		json: {
			"setting_type" : "call_to_actions",
			"thread_state" : "existing_thread",
			"call_to_actions":[
				{
					"type":"postback",
					"title":"Restart Conversation",
					"payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_HELP"
				},
				{
					"type":"postback",
					"title":"Unsubscribe",
					"payload":"remove_from_database"
				}
			]
		}
	}, function (error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
		console.log("MENU UPDATED YOU PUNK ASS LISTENERS");
		console.log(response);
	})
}