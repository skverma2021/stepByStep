const express = require('express');
const app = express();
const memRoutes = require('./routes/memRoutes');

const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/mem', memRoutes);

app.listen(PORT, () =>
  console.log(`The server started running the API on port: ${PORT}`)
);