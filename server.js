
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const crc32 = require('crc32');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// MySQL connection setup (replace with your actual MySQL connection details)
const pool = mysql.createPool({
    host: 'localhost',
    port:3307,
    user: 'root',
    password: 'Saavn@123',
    database: 'url_shortener_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Sample Authentication Middleware
const authenticateUser = async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    try {
      const decoded = jwt.verify(token, 'your_secret_key');
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  app.post('/api/signup', async (req, res) => {
    try {
        
      console.log(req);
      const { username, email, password } = req.body;
  
      // Create a connection from the pool
      const connection = await pool.getConnection();
  
      // Insert new user into the database
      await connection.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
  
      // Release the connection
      connection.release();
  
      res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
      res.status(500).json({ error });
    }
  });
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      // Create a connection from the pool
      const connection = await pool.getConnection();
  
      // Find the user by username and password
      const [results] = await connection.execute('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  
      // Release the connection
      connection.release();
  
      const user = results[0];
  
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      const token = jwt.sign({ userId: user.id }, 'your_secret_key');
      res.status(200).json({ token });
    } catch (error) {
        console.log(error)
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/url',authenticateUser,  async (req, res) => {
    try {
        
      const { longURL } = req.body;
      
    //   console.log(req)

      const shortURL = await generateUniqueShortURL(longURL); // Implement your short URL generation logic
      const userId = req.userId;
  
      // Create a connection from the pool
      const connection = await pool.getConnection();

      console.log(longURL, shortURL, userId)
  
      // Insert new URL into the database
      await connection.execute('INSERT INTO urls (longURL, shortURL, userId) VALUES (?, ?, ?)', [longURL, shortURL, userId]);
  
      // Release the connection
      connection.release();
  
      res.status(201).json({ shortURL });
    } catch (error) {
        console.log( error)
      res.status(500).json({ error });
    }
  });
  app.get('/api/url/:shortURL', async (req, res) => {
    try {
      const { shortURL } = req.params;
  
      // Create a connection from the pool
      const connection = await pool.getConnection();
  
      // Find the URL by shortURL
      const [results] = await connection.execute('SELECT * FROM urls WHERE shortURL = ?', [shortURL]);
  
      // Release the connection
      connection.release();
  
      const url = results[0];
  
      if (!url) {
        return res.status(404).json({ error: 'URL not found' });
      }
  
      res.redirect(url.longURL);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
    
  app.get('/api/user/:userId/urls', authenticateUser, async (req, res) => {
    try {
      const userId = req.params.userId;
  
      // Create a connection from the pool
      const connection = await pool.getConnection();
  
      // Find all URLs for the given userId
      const [results] = await connection.execute('SELECT * FROM urls WHERE userId = ?', [userId]);
  
      // Release the connection
      connection.release();
  
      const urls = results;
  
      res.status(200).json({ urls });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  async function generateUniqueShortURL(longURL) {
    const uniqueIdentifier = Date.now()
    const shortURL = generateShortURL(longURL,uniqueIdentifier);
    
    // Check if the generated short URL is already in use
    const isUnique = await isShortURLUnique(shortURL);
  
    if (isUnique) {
      return shortURL;
    } else {
      // If not unique, recursively generate another short URL
      return generateUniqueShortURL(longURL);
    }
  }
  
  function generateShortURL(longURL,uniqueIdentifier) {
    const hash = crc32(longURL+ uniqueIdentifier.toString());
  
    // Use the hash as part of the short URL
    return hash.toString(36).substring(0, 6); // Adjust the length as needed
  }
  
  async function isShortURLUnique(shortURL) {
    const connection = await pool.getConnection();
  
    try {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM urls WHERE shortURL = ?', [shortURL]);
  
      // If count is 0, the short URL is unique
      return rows[0].count === 0;
    } catch (error) {
      console.error('Error checking short URL uniqueness:', error);
      return false; // Consider it not unique in case of an error
    } finally {
      connection.release();
    }
  }
  // Endpoint to get all short and long URLs for a user
app.get('/api/user/urls', async (req, res) => {
    const userId = req.user.userId; // Assuming the user ID is stored in the token
  
    try {
      const connection = await pool.getConnection();
  
      // Query to get all short and long URLs for a user
      const query = 'SELECT shortURL, longURL FROM urls WHERE userId = ?';
      const [rows] = await connection.execute(query, [userId]);
  
      connection.release();
  
      res.json({ urls: rows });
    } catch (error) {
      console.error('Error fetching user URLs:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

  app.listen(3000,()=>
  {
    console.log('server started on port 3000')
  })