const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
app.use(cors({
  origin: 'http://localhost:4200',
}));
const dbURI = 'mongodb://localhost:27017/realtime-chat';

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => { ``
  console.error('Error connecting to MongoDB:', err.message);
});

const messageSchema = new mongoose.Schema({
  sender: String,
  recipient: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:4200', // Frontend URL
    methods: ['GET', 'POST'],
  },
});

const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (username) => {
    users[username] = socket.id;
    console.log('Users:', users);
  });

  socket.on('private_message', async ({ recipient, message, sender }) => {
    const recipientSocketId = users[recipient];
    const newMessage = new Message({ sender, recipient, message });
    await newMessage.save();
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('private_message', { message, sender });
    } else {
      socket.emit('error', { error: 'User not online' });
    }
  });

  socket.on('disconnect', () => {
    const username = Object.keys(users).find(key => users[key] === socket.id);
    if (username) delete users[username];
    console.log('User disconnected:', socket.id);
  });
});



server.listen(5001, () => {
  console.log('Backend server running on port 5001');
});

app.get('/messages', async (req, res) => {
  const { sender, recipient } = req.query;
  try {
    const messages = await Message.find({
      $or: [
        { sender, recipient },
        { sender: recipient, recipient: sender },
      ],
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});