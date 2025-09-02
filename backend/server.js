// backend/server.js (updated excerpt)
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const cors = require('cors');

dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(cors());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/group'));
app.use('/api/expenses', require('./routes/expense'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/settleup', require('./routes/settleup'));

const groupTransactionsRouter = require('./routes/groupTransactions');
app.use('/api/groupTransactions', groupTransactionsRouter);

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB connected to ${process.env.MONGO_URI}`);
});
