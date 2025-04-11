require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Route to fetch tweets by username
app.get('/api/tweets/:username', async (req, res) => {
  try {
    const username = req.params.username.replace('@', ''); // Remove @ if present
    console.log(`Attempting to fetch tweets for username: ${username}`);

    // Get user information and their tweets in a single call
    const user = await twitterClient.v2.userByUsername(username, {
      'user.fields': ['description', 'profile_image_url'],
      'expansions': ['pinned_tweet_id'],
      'tweet.fields': ['created_at', 'public_metrics']
    });

    if (!user.data) {
      throw new Error(`User '${username}' not found`);
    }

    console.log('User found:', user.data);

    // Get recent tweets
    const tweetsResponse = await twitterClient.v2.userTimeline(user.data.id, {
      max_results: 5,
      exclude: ['retweets', 'replies'],
      'tweet.fields': ['created_at', 'public_metrics']
    });

    // Log the full tweets response for debugging
    console.log('Raw tweets response:', JSON.stringify(tweetsResponse, null, 2));

    // Extract tweets from the response
    let tweets = [];
    if (tweetsResponse && tweetsResponse.data) {
      tweets = tweetsResponse.data;
    } else if (tweetsResponse && tweetsResponse._realData && tweetsResponse._realData.data) {
      tweets = tweetsResponse._realData.data;
    }

    console.log(`Found ${tweets.length} tweets:`, JSON.stringify(tweets, null, 2));

    res.json({
      user: user.data,
      tweets: tweets
    });

  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      data: error.data,
      stack: error.stack
    });

    // Handle different types of errors
    if (error.code === 429) {
      // Calculate reset time (15 minutes from now)
      const resetTime = new Date(Date.now() + 15 * 60 * 1000);
      res.status(429).json({
        error: 'Rate limit exceeded',
        details: 'Please try again in a few minutes',
        resetTime: resetTime.toISOString()
      });
    } else if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not found',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch tweets',
        details: error.message
      });
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
