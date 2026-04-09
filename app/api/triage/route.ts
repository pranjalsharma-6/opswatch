import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { logs } = await req.json()

    if (!logs?.trim()) {
      return NextResponse.json({ error: 'No logs provided' }, { status: 400 })
    }

    const message = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `You are a senior SRE/DevOps engineer. Analyze the provided logs and respond ONLY with valid JSON (no markdown fences, no explanation) in this exact format:
{
  "severity": "critical|warning|info",
  "title": "short incident title, max 8 words",
  "root_cause": "one sentence explaining the root cause",
  "impact": "one sentence describing user or system impact",
  "fix": "2-3 numbered concrete steps to resolve this",
  "component": "name of the affected service or component"
}`
        },
        {
          role: 'user',
          content: `Analyze these logs:\n\n${logs}`
        }
      ]
    })

    const text = message.choices[0]?.message?.content || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Triage error:', error)
    return NextResponse.json({ error: 'Failed to analyze logs' }, { status: 500 })
  }
}