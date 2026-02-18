import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are a helpful AI assistant for the MediRunner robot control system. 
You help hospital staff understand and use this application effectively.

Key features of the MediRunner app:
- Face recognition login - Secure biometric authentication for staff access
- Robot enrollment and management
- Real-time telemetry monitoring (battery status, connection status)
- Live video feed from robot cameras
- Manual control interface (forward, backward, left, right, stop)
- Autonomous line-following mode
- Hospital zone navigation
- Multi-robot control console

When users ask questions:
- Provide clear, concise answers about how to use the application
- Explain features in simple terms suitable for hospital staff
- Guide users on troubleshooting common issues
- Highlight that the system uses face recognition for secure, hands-free login
- Be friendly and professional

Answer questions directly and keep responses focused on the MediRunner application.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    // Add system prompt to the beginning if not present
    const messagesWithSystem = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter((m: any) => m.role !== "system"),
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messagesWithSystem,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return NextResponse.json({ 
      message: response,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error("Groq API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat request" },
      { status: 500 }
    );
  }
}
