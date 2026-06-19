const express = require('express');
const cors = require('cors');
const connectDB = async () => {
  const conn = require('./db');
  await conn();
};
const Contact = require('./models/Contact');
require('dotenv').config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: '*', // Allows connections from any origin (e.g. Vite dev port 5173/5174/5175 etc)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── GEMINI AI SETUP ───────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let geminiModel = null;

if (GEMINI_API_KEY) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `You are the official AI Assistant for Arshith Group — a diversified Indian corporate conglomerate.

COMPANY OVERVIEW:
Arshith Group is a leading multi-sector corporate brand headquartered in India, founded in 2019 by CEO Farook N. The group operates three main companies.

1. ARSHITH INFOTECH (IT Services & IT Consulting):
   - Provides software development, web applications, cloud solutions, and digital transformation services.
   - Offers enterprise-grade technical consulting.
   - Website: visit /infotech page on the main site.

2. ARSHITH FRESH INDIA PVT LTD (E-Commerce):
   - Inaugurated in 2025, it is the flagship e-commerce platform.
   - Connects farmers directly with consumers across India.
   - Tagline: "Rooted in nature, grown with care."
   - Website: https://arshithfresh.com/

3. SUNTECH SOLUTIONS (Business Consulting & Services):
   - Established in 2019 as the foundation of the group.
   - Provides business consulting, corporate services, digital marketing, and operational optimization.
   - Website: https://suntechorganization.com/

TIMELINE:
- 2019: Suntech Solutions founded — first business in the group.
- 2021: Suntech expanded with backend support and digital marketing services.
- 2023: Arshith Group formed as a unified corporate identity.
- 2025: Arshith Fresh India Pvt Ltd officially inaugurated.
- 2026: ArshithInfoTech expanding globally with comprehensive software solutions.

CEO: Farook N — Chief Executive Officer of Arshith Group.
Quote: "We believe growth is more than scaling a business—it's about building trust, creating opportunities, and shaping a future where progress benefits everyone."

INTERNSHIP/CAREERS:
- Internship programs are available — users can visit the /internship page.
- Applications via Google Forms.
- Online assessment available at Quizzory.

CONTACT:
- Users can reach Arshith Group through the Contact Us section on the main website.

INSTRUCTIONS:
- Be professional, friendly, concise, and helpful.
- Only answer questions related to Arshith Group and its services.
- For off-topic queries, politely redirect the user back to Arshith Group topics.
- Do NOT make up specific phone numbers, emails, or addresses that are not given above.
- Keep responses under 150 words unless the question requires more detail.
- Greet new users warmly when they first send a message.`
    });
    console.log('✅ Gemini AI initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize Gemini AI:', err.message);
  }
} else {
  console.warn('⚠️  GEMINI_API_KEY not set — AI chat will use fallback mode.');
}

// Fallback keyword-based responses
function getFallbackResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes('fresh') || msg.includes('ecommerce') || msg.includes('farm')) {
    return "Arshith Fresh India Pvt Ltd is our flagship e-commerce platform launched in 2025, connecting farmers directly to consumers. Visit https://arshithfresh.com/ to learn more!";
  }
  if (msg.includes('infotech') || msg.includes('it') || msg.includes('software') || msg.includes('tech')) {
    return "ArshithInfoTech provides IT services, software development, cloud solutions, and digital transformation. Visit the IT Services page on our website to learn more!";
  }
  if (msg.includes('suntech') || msg.includes('consulting') || msg.includes('business')) {
    return "Suntech Solutions, founded in 2019, is our business consulting arm offering corporate services, operational optimization, and digital marketing. Visit https://suntechorganization.com/";
  }
  if (msg.includes('intern') || msg.includes('job') || msg.includes('career') || msg.includes('work')) {
    return "We offer exciting internship and career opportunities at Arshith Group! Visit our Internship page on the website to apply through our Google Form and take the online assessment.";
  }
  if (msg.includes('ceo') || msg.includes('farook') || msg.includes('founder')) {
    return "Arshith Group's CEO is Farook N. He founded the group with a vision of building trust and creating opportunities, starting with Suntech Solutions in 2019.";
  }
  if (msg.includes('contact') || msg.includes('reach') || msg.includes('email')) {
    return "You can reach Arshith Group through the Contact Us section on our website. Fill in the contact form and our team will get back to you shortly!";
  }
  if (msg.includes('history') || msg.includes('journey') || msg.includes('founded') || msg.includes('year')) {
    return "Arshith Group was founded in 2019 with Suntech Solutions. In 2023 we unified under the Arshith Group identity, and in 2025 we launched Arshith Fresh. In 2026, ArshithInfoTech is expanding globally!";
  }
  return "Hello! I'm the Arshith Group AI Assistant. I can help you learn about our companies — ArshithInfoTech, Arshith Fresh, and Suntech Solutions — as well as careers, internships, and more. What would you like to know?";
}

// ─── CHAT ENDPOINT ─────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    // Use Gemini if available
    if (geminiModel) {
      // Build conversation history for multi-turn chat
      const chatHistory = history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

      const chat = geminiModel.startChat({ history: chatHistory });
      const result = await chat.sendMessage(message.trim());
      const reply = result.response.text();
      return res.json({ success: true, reply, powered_by: 'gemini' });
    }

    // Offline fallback
    const fallback = getFallbackResponse(message);
    return res.json({ success: true, reply: fallback, powered_by: 'fallback' });

  } catch (error) {
    // Handle Gemini rate-limit (429) gracefully
    if (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate'))) {
      console.warn('⚠️  Gemini rate limit hit — using fallback response.');
    } else {
      console.error('Chat error:', error.message);
    }
    const fallback = getFallbackResponse(req.body.message || '');
    return res.json({ success: true, reply: fallback, powered_by: 'fallback' });
  }
});

// Simple Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Contact Us Post Endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, company, message, source } = req.body;

    // Basic Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and message.'
      });
    }

    // Create entry in database
    const contact = await Contact.create({
      name,
      email,
      phone,
      subject,
      company,
      message,
      source
    });

    res.status(201).json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error(`Error saving contact submission: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Server Error: Could not save contact submission.'
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in development mode on port ${PORT}`);
});
