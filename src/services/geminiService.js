const { GoogleGenAI } = require("@google/genai")
const { query } = require("../config/database")

// Initialize Gemini AI
const ai = new GoogleGenAI({})

async function processMessageWithGemini(messageId, userMessage) {
  try {
    // Update message status to processing
    await query("UPDATE messages SET message_status = $1 WHERE id = $2", [
      "processing",
      messageId,
    ])

    // Generate response using the correct API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
    })

    const aiResponse = response.text

    // Update message with AI response
    await query(
      "UPDATE messages SET ai_response = $1, message_status = $2 WHERE id = $3",
      [aiResponse, "completed", messageId]
    )

    console.log(`✅ Message ${messageId} processed successfully`)
    return aiResponse
  } catch (error) {
    console.error(`❌ Error processing message ${messageId}:`, error)

    // Update message status to failed
    await query("UPDATE messages SET message_status = $1 WHERE id = $2", [
      "failed",
      messageId,
    ])

    throw error
  }
}

module.exports = {
  processMessageWithGemini,
}
