# NodeJS-Mltiplayer-Asteroids

Browser based multiplayer asteroids game

Written using NodeJS purerly because I was bored and wanted to learn NodeJS.

This project is a great example of how to:
	-Not structure code. Everything is in 2 files, a client HTML file and a server nodejs file. :(
	-NOT use NodeJS. All the game computation is done on the server side, by Node. These calculations block the node event loop, causing the game
	 to quickly crawl to a snails pace as the number of asteroids increase.
	 
Started writing some node c++ addons which could run asyn to handle the physics computations, but thats unlikely to every get done.

