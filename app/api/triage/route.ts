import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    // Validate request
    const { logs } = await req.json()
    if (!logs?.trim()) {
      return NextResponse.json({ error: 'No logs provided' }, { status: 400 })
    }

    // Validate API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
    }

    // Call Groq
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are a senior SRE/DevOps engineer with 10+ years experience.
Analyze the provided server logs and respond ONLY with a valid JSON object.
No markdown, no code fences, no explanation — pure JSON only.

Required format:
{
  "severity": "critical|warning|info",
  "title": "short incident title max 8 words",
  "root_cause": "one clear sentence explaining the root cause",
  "impact": "one sentence describing the user or system impact",
  "fix": "1. first step\n2. second step\n3. third step",
  "component": "name of the affected service or component"
}

Severity rules:
- critical: data loss, full outage, cascading failures, security breach
- warning: degraded performance, partial failure, approaching limits
- info: normal operational events, successful completions, scaling events`
        },
        {
          role: 'user',
          content: `Analyze these logs and return JSON only:\n\n${logs}`
        }
      ]
    })

    // Extract response text
    const raw = completion.choices[0]?.message?.content || ''

    // Clean and extract JSON
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()

    // Find JSON object in response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', raw)
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 500 }
      )
    }

    // Parse JSON
    const result = JSON.parse(jsonMatch[0])

    // Validate required fields
    const required = ['severity', 'title', 'root_cause', 'impact', 'fix', 'component']
    for (const field of required) {
      if (!result[field]) {
        result[field] = field === 'severity' ? 'info' : 'Not available'
      }
    }

    // Validate severity value
    if (!['critical', 'warning', 'info'].includes(result.severity)) {
      result.severity = 'info'
    }

    return NextResponse.json(result)

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Triage API error:', msg)

    // Handle specific error types
    if (msg.includes('API key')) {
      return NextResponse.json({ error: 'Invalid Groq API key' }, { status: 401 })
    }
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }
    if (msg.includes('rate limit')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 })
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}