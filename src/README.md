# Real-time Chat Application

A modern, real-time chat application built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- Real-time messaging
- User join/leave notifications
- Typing indicators
- Dark/Light mode toggle
- Message timestamps
- Responsive design
- Modern UI with animations

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Start MongoDB server (if running locally)

4. Start the application:
```bash
node server.js
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

```
chat-app/
├── public/
│   ├── css/
│   │   ├── chat.css
│   │   └── homepage.css
│   ├── chat.html
│   └── homepage.html
├── models/
│   └── User.js
├── server.js
├── package.json
└── README.md
```

## Technologies Used

- Node.js
- Express.js
- Socket.IO
- MongoDB
- HTML5
- CSS3
- JavaScript (ES6+)

## License

MIT License 