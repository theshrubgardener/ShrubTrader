const axios = require('axios');
const winston = require('winston');
const config = require('./config');

// Setup logging
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Call Grok API with prompt
 * @param {string} prompt - The prompt to send
 * @returns {string} JSON response from Grok
 */
async function callGrok(prompt) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      logger.info('Calling Grok API', { attempt: attempt + 1 });

      const response = await axios.post(config.GROK_API_URL, {
        model: 'grok-1', // Adjust model name as needed
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${config.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      });

      const content = response.data.choices[0].message.content;
      logger.info('Grok response received', { content });

      // Validate JSON
      JSON.parse(content); // Throw if invalid

      return content;
    } catch (error) {
      attempt++;
      logger.error('Error calling Grok API', { attempt, error: error.message });

      if (attempt >= maxRetries) {
        throw new Error(`Failed to call Grok API after ${maxRetries} attempts: ${error.message}`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

module.exports = {
  callGrok
};